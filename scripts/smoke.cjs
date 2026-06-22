"use strict";
// End-to-end smoke test (mock providers, live DB). Exercises the revenue path:
// source -> enrich -> score -> outreach -> proposal -> dashboard.
const config = require("../core/config.cjs");
const db = require("../core/db.cjs");
const leadIntel = require("../departments/lead-intel/service.cjs");
const sdr = require("../departments/sdr/service.cjs");
const proposal = require("../departments/proposal/service.cjs");
const content = require("../departments/content/service.cjs");
const success = require("../departments/client-success/service.cjs");
const metrics = require("../dashboard/metrics.cjs");

const B = config.defaultBrandId;
const ok = (m) => console.log("  ✔", m);

async function main() {
  console.log("== FixMyLeads AI Team smoke test (mode:", config.providerMode, ") ==");

  console.log("[1] Lead Intelligence: source + enrich + score");
  const scored = await leadIntel.sourceAndProcess(B, { source: "gmaps", query: "fitness mumbai", limit: 2 });
  scored.forEach((s) => ok(`lead #${s.leadId} → score ${s.score} (${s.grade})`));
  const leadId = scored[0].leadId;

  console.log("[2] SDR: enroll + send step 1 + handle reply");
  const enr = await sdr.enroll(B, leadId);
  const step = await sdr.runStep(B, enr.id);
  ok(`outreach sent: ${step.channel} → ${step.to}`);
  const reply = await sdr.handleReply(B, leadId, "Sounds interesting, can we talk this week?");
  ok(`reply intent: ${reply.intent} (book=${reply.book_meeting})`);

  console.log("[3] Proposal: generate");
  const prop = await proposal.create(B, { leadId, kind: "proposal" });
  ok(`proposal #${prop.id} amount=${prop.amount}`);

  console.log("[4] Content: social post");
  const c = await content.create(B, { kind: "social", topic: "AI video marketing for gyms" });
  ok(`content #${c.id} generated`);

  console.log("[5] Client Success: onboard");
  const cl = await success.onboard(B, { leadId, name: "Smoke Test Client", mrr: 75000 });
  ok(`client #${cl.clientId}, ${cl.tasks} onboarding tasks`);

  console.log("[6] CEO Dashboard: overview");
  const o = await metrics.overview(B);
  ok(`revenue ₹${o.revenue_mrr} · pipeline ₹${o.pipeline_value} · leads ${o.leads_total} · meetings ${o.meetings_booked}`);

  console.log("\n✅ SMOKE PASSED");
  await db.pool.end();
}

main().catch((e) => {
  console.error("\n❌ SMOKE FAILED:", e.message);
  console.error(e.stack);
  process.exit(1);
});
