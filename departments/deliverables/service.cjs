"use strict";
const db = require("../../core/db.cjs");

async function createDeliverable(brandId, { clientId, campaignId, type, title, description, quantity, unit, dueDate }) {
  const d = await db.one(
    `insert into ait_deliverables (brand_id, client_id, campaign_id, type, title, description, quantity, unit, due_date, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'planned') returning *`,
    [brandId, clientId, campaignId || null, type, title, description || null, quantity || 1, unit || "posts", dueDate || null]
  );
  return { deliverableId: d.id };
}

async function updateStatus(brandId, deliverableId, status) {
  const extras = status === "delivered" ? ", delivered_at=now()" : status === "approved" ? ", approved_at=now()" : "";
  await db.query(`update ait_deliverables set status=$3${extras} where brand_id=$1 and id=$2`, [brandId, deliverableId, status]);
  return { updated: true };
}

async function listDeliverables(brandId, { status, clientId, campaignId, limit = 50, offset = 0 } = {}) {
  let q = `select d.*, cl.name as client_name from ait_deliverables d left join ait_clients cl on cl.id=d.client_id where d.brand_id=$1`;
  const p = [brandId]; let i = 2;
  if (status) { q += ` and d.status=$${i++}`; p.push(status); }
  if (clientId) { q += ` and d.client_id=$${i++}`; p.push(clientId); }
  if (campaignId) { q += ` and d.campaign_id=$${i++}`; p.push(campaignId); }
  q += ` order by d.created_at desc limit $${i++} offset $${i++}`;
  p.push(Math.min(limit, 500), offset);
  return db.many(q, p);
}

async function getStats(brandId, clientId) {
  let q = `select count(*) as total, count(*) filter (where status='delivered') as delivered, count(*) filter (where status='approved') as approved, count(*) filter (where status='in_progress') as in_progress from ait_deliverables where brand_id=$1`;
  const p = [brandId]; let i = 2;
  if (clientId) { q += ` and client_id=$${i++}`; p.push(clientId); }
  return db.one(q, p);
}

module.exports = { createDeliverable, updateStatus, listDeliverables, getStats };
