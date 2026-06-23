"use strict";
// Fast single-call check: one real agent LLM call end-to-end through the stack,
// with a timeout. Proves brain + agentBase + DB run-tracking + score persistence.
const db = require("../core/db.cjs");
const config = require("../core/config.cjs");
const crm = require("../core/crm.cjs");
const leadIntel = require("../departments/lead-intel/service.cjs");

const B = config.defaultBrandId;

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms))]);

async function main() {
  console.log("== fast check (LLM:", config.llm.provider, config.llm.model, ") ==");
  const { leads } = await crm.listLeads(B, { limit: 1 });
  if (!leads || !leads.length) throw new Error("no seed leads — run npm run seed");
  const lead = leads[0];
  console.log("scoring lead #" + lead.id, lead.full_name);
  const res = await withTimeout(leadIntel.score(B, lead.id), 90000);
  console.log("✔ score:", res.score, res.grade, "| reasons:", (res.reasons || []).slice(0, 2));
  const run = await db.one(
    `select agent, department, status, ms from ait_agent_runs where brand_id=$1 order by id desc limit 1`,
    [B]
  );
  console.log("✔ agent_run tracked:", run);
  const saved = await db.one(`select score, grade from ait_lead_scores where lead_id=$1 order by id desc limit 1`, [lead.id]);
  console.log("✔ score persisted:", saved);
  console.log("\n✅ FAST CHECK PASSED — brain + agent + DB working end-to-end");
  await db.pool.end();
}
main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
