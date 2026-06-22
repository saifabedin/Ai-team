"use strict";
// Append-only audit log for every meaningful action across the company.
const db = require("./db.cjs");
const log = require("./logger.cjs").make("audit");

let auditFailCount = 0;

async function record({ brandId, actor, action, entity, entityId, meta }) {
  try {
    await db.query(
      `insert into ait_audit_log (brand_id, actor, action, entity, entity_id, meta)
       values ($1,$2,$3,$4,$5,$6)`,
      [brandId, actor || "system", action, entity || null, entityId || null, meta || {}]
    );
  } catch (e) {
    auditFailCount++;
    log.warn(`audit write failed (total: ${auditFailCount})`, e.message);
    if (auditFailCount % 10 === 0) {
      log.error(`ALERT: ${auditFailCount} audit writes have failed — check DB connection`);
    }
  }
}

async function recent(brandId, limit = 100) {
  return db.many(
    `select * from ait_audit_log where brand_id=$1 order by created_at desc limit $2`,
    [brandId, limit]
  );
}

module.exports = { record, recent };
