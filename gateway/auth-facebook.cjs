"use strict";
// Facebook OAuth — One-Click Connect for Facebook Page + Instagram + Ads
// Flow: User clicks "Connect" → Facebook OAuth → Token stored → Ready to publish
const axios = require("axios");
const db = require("../core/db.cjs");
const log = require("../core/logger.cjs").make("fb-oauth");

const FB_API = "https://graph.facebook.com/v25.0";
const APP_ID = process.env.FB_APP_ID || "";
const APP_SECRET = process.env.FB_APP_SECRET || "";
const REDIRECT_URI = process.env.FB_REDIRECT_URI || "http://localhost:4100/auth/facebook/callback";
const SCOPES = (process.env.FB_OAUTH_SCOPES || "pages_manage_posts,pages_read_engagement,pages_show_list").split(",");

// Step 1: Generate OAuth URL (user clicks this to start connect)
function getOAuthUrl(brandId, userId) {
  if (!APP_ID) return { error: "FB_APP_ID not configured in .env" };
  const state = Buffer.from(JSON.stringify({ brandId, userId, ts: Date.now() })).toString("base64url");
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(","),
    response_type: "code",
    state,
  });
  return { url: `https://www.facebook.com/v25.0/dialog/oauth?${params}`, state };
}

// Step 2: Exchange code for User Access Token
async function exchangeCode(code) {
  const { data } = await axios.get(`${FB_API}/oauth/access_token`, {
    params: {
      client_id: APP_ID,
      client_secret: APP_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    },
    timeout: 15000,
  });
  return data.access_token;
}

// Step 3: Exchange short-lived token for long-lived token (60 days)
async function exchangeLongLived(shortToken) {
  const { data } = await axios.get(`${FB_API}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: shortToken,
    },
    timeout: 15000,
  });
  return data.access_token;
}

// Step 4: Get all Pages the user manages (with page access tokens)
async function getPages(userToken) {
  const { data } = await axios.get(`${FB_API}/me/accounts`, {
    params: { access_token: userToken, fields: "id,name,access_token,category,fan_count", limit: 100 },
    timeout: 15000,
  });
  return data.data || [];
}

// Step 5: Get Instagram Business accounts linked to pages
async function getInstagramAccounts(userToken, pages) {
  const accounts = [];
  for (const page of pages) {
    try {
      const { data } = await axios.get(`${FB_API}/${page.id}/instagram_accounts`, {
        params: { access_token: page.access_token, fields: "id,username,name,biography,followers_count" },
        timeout: 10000,
      });
      if (data.data?.length) {
        for (const ig of data.data) {
          accounts.push({ ...ig, page_id: page.id, page_name: page.name, page_token: page.access_token });
        }
      }
    } catch (e) {
      // Page might not have Instagram connected
    }
  }
  return accounts;
}

// Step 6: Get Ad Accounts the user manages
async function getAdAccounts(userToken) {
  try {
    const { data } = await axios.get(`${FB_API}/me/adaccounts`, {
      params: { access_token: userToken, fields: "id,name,account_status,currency,amount_spent,spend_cap", limit: 100 },
      timeout: 15000,
    });
    return data.data || [];
  } catch (e) {
    return [];
  }
}

// Store tokens in database
async function storeTokens(brandId, userId, userToken, pages, igAccounts, adAccounts) {
  // Delete existing connections for this brand/user
  await db.query(
    `DELETE FROM ait_social_accounts WHERE brand_id=$1 AND platform IN ('facebook','instagram')`,
    [brandId]
  );

  const stored = [];

  // Store Facebook Pages
  for (const page of pages) {
    const result = await db.one(
      `INSERT INTO ait_social_accounts
       (brand_id, client_id, platform, account_name, account_id, access_token, status, meta)
       VALUES ($1, $2, 'facebook', $3, $4, $5, 'active', $6)
       RETURNING id`,
      [
        brandId,
        userId || null,
        page.name,
        page.id,
        page.access_token,
        JSON.stringify({
          category: page.category,
          fan_count: page.fan_count,
          userToken: userToken,
          connectedAt: new Date().toISOString(),
        }),
      ]
    );
    stored.push({ type: "facebook", id: result.id, name: page.name, pageId: page.id });
  }

  // Store Instagram Accounts
  for (const ig of igAccounts) {
    const result = await db.one(
      `INSERT INTO ait_social_accounts
       (brand_id, client_id, platform, account_name, account_id, access_token, status, meta)
       VALUES ($1, $2, 'instagram', $3, $4, $5, 'active', $6)
       RETURNING id`,
      [
        brandId,
        userId || null,
        ig.username,
        ig.id,
        ig.page_token,
        JSON.stringify({
          name: ig.name,
          biography: ig.biography,
          followers_count: ig.followers_count,
          pageId: ig.page_id,
          pageName: ig.page_name,
          connectedAt: new Date().toISOString(),
        }),
      ]
    );
    stored.push({ type: "instagram", id: result.id, username: ig.username, pageName: ig.page_name });
  }

  // Store Ad Accounts
  for (const ad of adAccounts) {
    const result = await db.one(
      `INSERT INTO ait_social_accounts
       (brand_id, client_id, platform, account_name, account_id, access_token, status, meta)
       VALUES ($1, $2, 'facebook-ads', $3, $4, $5, 'active', $6)
       RETURNING id`,
      [
        brandId,
        userId || null,
        ad.name,
        ad.id,
        userToken, // Ad accounts use the user token
        JSON.stringify({
          account_status: ad.account_status,
          currency: ad.currency,
          amount_spent: ad.amount_spent,
          spend_cap: ad.spend_cap,
          connectedAt: new Date().toISOString(),
        }),
      ]
    );
    stored.push({ type: "ads", id: result.id, name: ad.name, accountId: ad.id });
  }

  return stored;
}

// Full OAuth callback handler
async function handleCallback(code, state) {
  // Parse state
  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch (e) {
    throw new Error("Invalid OAuth state");
  }

  const { brandId, userId } = stateData;

  // Exchange code for user token
  const shortToken = await exchangeCode(code);
  log.info("exchanged code for short-lived token");

  // Get long-lived token (60 days)
  const longToken = await exchangeLongLived(shortToken);
  log.info("exchanged for long-lived token");

  // Get all pages
  const pages = await getPages(longToken);
  log.info(`found ${pages.length} Facebook pages`);

  // Get Instagram accounts
  const igAccounts = await getInstagramAccounts(longToken, pages);
  log.info(`found ${igAccounts.length} Instagram accounts`);

  // Get Ad accounts
  const adAccounts = await getAdAccounts(longToken);
  log.info(`found ${adAccounts.length} ad accounts`);

  // Store everything in database
  const stored = await storeTokens(brandId, userId, longToken, pages, igAccounts, adAccounts);

  return {
    success: true,
    brandId,
    pages: pages.map(p => ({ id: p.id, name: p.name, category: p.category })),
    instagram: igAccounts.map(ig => ({ id: ig.id, username: ig.username, pageName: ig.page_name })),
    ads: adAccounts.map(ad => ({ id: ad.id, name: ad.name })),
    stored,
  };
}

// Get stored connections for a brand
async function getConnections(brandId) {
  const accounts = await db.many(
    `SELECT id, platform, account_name, account_id, status, meta, created_at
     FROM ait_social_accounts WHERE brand_id=$1 ORDER BY platform, account_name`,
    [brandId]
  );

  return accounts.map(a => ({
    id: a.id,
    platform: a.platform,
    name: a.account_name,
    accountId: a.account_id,
    status: a.status,
    connectedAt: a.created_at,
    ...(a.meta || {}),
  }));
}

// Disconnect a social account
async function disconnect(brandId, accountId) {
  await db.query(
    `DELETE FROM ait_social_accounts WHERE brand_id=$1 AND id=$2`,
    [brandId, accountId]
  );
  return { disconnected: true };
}

// Get the active Facebook Page token for a brand (used by Engine 5)
async function getActivePageToken(brandId, pageId) {
  const account = await db.oneOrNone(
    `SELECT access_token, meta FROM ait_social_accounts
     WHERE brand_id=$1 AND platform='facebook' AND account_id=$2 AND status='active'`,
    [brandId, pageId]
  );
  if (!account) return null;
  return {
    pageToken: account.access_token,
    userToken: account.meta?.userToken || null,
  };
}

module.exports = {
  getOAuthUrl,
  handleCallback,
  getConnections,
  disconnect,
  getActivePageToken,
  getPages,
  getInstagramAccounts,
  getAdAccounts,
};
