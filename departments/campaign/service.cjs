"use strict";
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const { CampaignAgent } = require("./agent.cjs");
const agent = new CampaignAgent();

async function create(brandId, { clientId, name, type, budget, startDate, endDate, channels, targetAudience, goals }) {
  return agent.run(brandId, "create-campaign", async () => {
    const campaign = await db.one(
      `insert into ait_campaigns (brand_id, client_id, name, type, status, budget, start_date, end_date, channels, target_audience, goals)
       values ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10) returning *`,
      [brandId, clientId || null, name, type || "lead_gen", budget || 0,
       startDate || null, endDate || null, JSON.stringify(channels || []),
       JSON.stringify(targetAudience || {}), JSON.stringify(goals || {})]
    );
    return { campaignId: campaign.id };
  });
}

async function update(brandId, campaignId, updates) {
  const fields = [];
  const params = [brandId, campaignId];
  let idx = 3;
  for (const [k, v] of Object.entries(updates)) {
    if (["name","type","status","budget","start_date","end_date","channels","target_audience","goals"].includes(k)) {
      const val = typeof v === "object" ? JSON.stringify(v) : v;
      fields.push(`${k}=$${idx++}`);
      params.push(val);
    }
  }
  if (fields.length === 0) return { updated: false };
  fields.push("updated_at=now()");
  await db.query(`update ait_campaigns set ${fields.join(", ")} where brand_id=$1 and id=$2`, params);
  return { updated: true };
}

async function getCampaign(brandId, campaignId) {
  return db.one(`select * from ait_campaigns where brand_id=$1 and id=$2`, [brandId, campaignId]);
}

async function listCampaigns(brandId, { status, clientId, limit = 50, offset = 0 } = {}) {
  let q = `select c.*, cl.name as client_name from ait_campaigns c left join ait_clients cl on cl.id=c.client_id where c.brand_id=$1`;
  const p = [brandId]; let i = 2;
  if (status) { q += ` and c.status=$${i++}`; p.push(status); }
  if (clientId) { q += ` and c.client_id=$${i++}`; p.push(clientId); }
  q += ` order by c.created_at desc limit $${i++} offset $${i++}`;
  p.push(Math.min(limit, 500), offset);
  return db.many(q, p);
}

async function getStats(brandId) {
  return db.one(
    `select count(*) as total, count(*) filter (where status='active') as active,
            coalesce(sum(budget),0) as total_budget, coalesce(sum(spend),0) as total_spend
     from ait_campaigns where brand_id=$1`, [brandId]
  );
}

module.exports = { create, update, getCampaign, listCampaigns, getStats };
