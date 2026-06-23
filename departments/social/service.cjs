"use strict";
const db = require("../../core/db.cjs");
const calendar = require("../calendar/service.cjs");
const { SocialAgent } = require("./agent.cjs");
const agent = new SocialAgent();

async function createPost(brandId, { clientId, campaignId, platform, caption, postType, hashtags, scheduledAt }) {
  return agent.run(brandId, "create-post", async () => {
    const post = await db.one(
      `insert into ait_social_posts (brand_id, client_id, campaign_id, platform, post_type, caption, hashtags, scheduled_at, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'draft') returning *`,
      [brandId, clientId || null, campaignId || null, platform, postType || "image",
       caption, JSON.stringify(hashtags || []), scheduledAt || null]
    );
    return { postId: post.id };
  });
}

async function schedulePost(brandId, postId, scheduledAt) {
  await db.query(
    `update ait_social_posts set scheduled_at=$3, status='scheduled' where brand_id=$1 and id=$2`,
    [brandId, postId, scheduledAt]
  );
  return { scheduled: true };
}

async function listPosts(brandId, { status, platform, clientId, limit = 50, offset = 0 } = {}) {
  let q = `select * from ait_social_posts where brand_id=$1`;
  const p = [brandId]; let i = 2;
  if (status) { q += ` and status=$${i++}`; p.push(status); }
  if (platform) { q += ` and platform=$${i++}`; p.push(platform); }
  if (clientId) { q += ` and client_id=$${i++}`; p.push(clientId); }
  q += ` order by created_at desc limit $${i++} offset $${i++}`;
  p.push(Math.min(limit, 500), offset);
  return db.many(q, p);
}

async function connectAccount(brandId, { clientId, platform, accountId, accessToken }) {
  const acc = await db.one(
    `insert into ait_social_accounts (brand_id, client_id, platform, account_id, access_token, status)
     values ($1,$2,$3,$4,$5,'active') returning *`,
    [brandId, clientId, platform, accountId, accessToken]
  );
  return { accountId: acc.id };
}

// Delegate to calendar service (single source of truth)
const getCalendar = calendar.getCalendar;

module.exports = { createPost, schedulePost, listPosts, connectAccount, getCalendar };
