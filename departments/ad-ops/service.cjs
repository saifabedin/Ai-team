"use strict";
const db = require("../../core/db.cjs");
const { AdOpsAgent } = require("./agent.cjs");
const agent = new AdOpsAgent();

async function createCampaign(brandId, { clientId, campaignId, platform, name, objective, dailyBudget, totalBudget, targeting, startDate, endDate }) {
  return agent.run(brandId, "create-ad", async () => {
    const ad = await db.one(
      `insert into ait_ad_campaigns (brand_id, client_id, campaign_id, platform, name, objective, status, daily_budget, total_budget, targeting, start_date, end_date)
       values ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10,$11) returning *`,
      [brandId, clientId || null, campaignId || null, platform, name, objective || "conversions",
       dailyBudget || null, totalBudget || null, JSON.stringify(targeting || {}), startDate || null, endDate || null]
    );
    return { adCampaignId: ad.id };
  });
}

async function recordMetrics(brandId, adCampaignId, { date, impressions, clicks, spend, conversions }) {
  const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : 0;
  const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : 0;
  const cpa = conversions > 0 ? (spend / conversions).toFixed(2) : 0;
  await db.query(
    `insert into ait_ad_metrics (brand_id, ad_campaign_id, date, impressions, clicks, ctr, cpc, spend, conversions, cpa)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (ad_campaign_id, date) do update set
       impressions=$4, clicks=$5, ctr=$6, cpc=$7, spend=$8, conversions=$9, cpa=$10`,
    [brandId, adCampaignId, date, impressions, clicks, ctr, cpc, spend, conversions, cpa]
  );
  return { recorded: true };
}

async function getMetrics(brandId, adCampaignId, { startDate, endDate } = {}) {
  let q = `select * from ait_ad_metrics where brand_id=$1 and ad_campaign_id=$2`;
  const p = [brandId, adCampaignId]; let i = 3;
  if (startDate) { q += ` and date >= $${i++}`; p.push(startDate); }
  if (endDate) { q += ` and date <= $${i++}`; p.push(endDate); }
  q += ` order by date asc`;
  return db.many(q, p);
}

async function listCampaigns(brandId, { status, clientId, limit = 50, offset = 0 } = {}) {
  let q = `select * from ait_ad_campaigns where brand_id=$1`;
  const p = [brandId]; let i = 2;
  if (status) { q += ` and status=$${i++}`; p.push(status); }
  if (clientId) { q += ` and client_id=$${i++}`; p.push(clientId); }
  q += ` order by created_at desc limit $${i++} offset $${i++}`;
  p.push(Math.min(limit, 500), offset);
  return db.many(q, p);
}

async function updateStatus(brandId, adCampaignId, status) {
  await db.query(`update ait_ad_campaigns set status=$3 where brand_id=$1 and id=$2`, [brandId, adCampaignId, status]);
  return { updated: true };
}

module.exports = { createCampaign, recordMetrics, getMetrics, listCampaigns, updateStatus };
