"use strict";
const db = require("../../core/db.cjs");
const { HealthAgent } = require("./agent.cjs");
const agent = new HealthAgent();

async function calculateHealth(brandId, clientId) {
  return agent.run(brandId, "calc-health", async () => {
    const client = await db.one(`select * from ait_clients where brand_id=$1 and id=$2`, [brandId, clientId]);
    // Gather factors
    const projects = await db.many(`select * from ait_projects where brand_id=$1 and client_id=$2`, [brandId, clientId]);
    const deliverables = await db.one(`select count(*) as total, count(*) filter (where status='delivered') as delivered from ait_deliverables where brand_id=$1 and client_id=$2`, [brandId, clientId]);
    const socialPosts = await db.one(`select count(*) as total, count(*) filter (where status='published') as published from ait_social_posts where brand_id=$1 and client_id=$2`, [brandId, clientId]);
    const health = await agent.calculateHealth(client, {
      deliverables,
      socialPosts,
      projectCount: projects.length,
      mrr: client.mrr,
    });

    // Save/Update health
    const existing = await db.oneOrNone(`select id from ait_client_health where brand_id=$1 and client_id=$2`, [brandId, clientId]);
    if (existing) {
      await db.query(
        `update ait_client_health set score=$3, grade=$4, factors=$5, churn_risk=$6, recommendations=$7, calculated_at=now() where brand_id=$1 and client_id=$2`,
        [brandId, clientId, health.score, health.grade, JSON.stringify(health.factors), health.churn_risk, JSON.stringify(health.recommendations)]
      );
    } else {
      await db.query(
        `insert into ait_client_health (brand_id, client_id, score, grade, factors, churn_risk, recommendations) values ($1,$2,$3,$4,$5,$6,$7)`,
        [brandId, clientId, health.score, health.grade, JSON.stringify(health.factors), health.churn_risk, JSON.stringify(health.recommendations)]
      );
    }
    return health;
  });
}

async function getHealth(brandId, clientId) {
  return db.oneOrNone(`select * from ait_client_health where brand_id=$1 and client_id=$2`, [brandId, clientId]);
}

async function listHealth(brandId, { grade, limit = 50, offset = 0 } = {}) {
  let q = `select h.*, cl.name as client_name from ait_client_health h left join ait_clients cl on cl.id=h.client_id where h.brand_id=$1`;
  const p = [brandId]; let i = 2;
  if (grade) { q += ` and h.grade=$${i++}`; p.push(grade); }
  q += ` order by h.score asc limit $${i++} offset $${i++}`;
  p.push(Math.min(limit, 500), offset);
  return db.many(q, p);
}

module.exports = { calculateHealth, getHealth, listHealth };
