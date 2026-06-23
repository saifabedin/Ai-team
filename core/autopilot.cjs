"use strict";
// 24/7 Autopilot — the heartbeat that keeps the AI team working without a human.
// Each cycle:
//   0. (optional) pull fresh leads from a Google Sheet / CSV (AUTOPILOT_SHEET_URL)
//   1. enrich any 'new' leads
//   2. score any 'enriched' leads
//   3. enroll fresh A/B-grade leads into the default sequence
//   4. advance any enrollment whose next step is due (outreach send)
//   5. FML Health: process appointment reminders, aftercare follow-ups
// Free + safe in PROVIDER_MODE=mock (sends are simulated). Multi-tenant by brand.
const config = require("./config.cjs");
const db = require("./db.cjs");
const log = require("./logger.cjs").make("autopilot");
const leadIntel = require("../departments/lead-intel/service.cjs");
const sdr = require("../departments/sdr/service.cjs");
const reminders = require("../departments/appointment/reminders.cjs");
const aftercare = require("../departments/aftercare/service.cjs");
const reputation = require("../departments/reputation/service.cjs");
const prep = require("../departments/prep/service.cjs");

const BRAND = config.defaultBrandId;
const INTERVAL_MS = parseInt(process.env.AUTOPILOT_INTERVAL_MS || "60000", 10); // 60s
const BATCH = parseInt(process.env.AUTOPILOT_BATCH || "5", 10);
const SHEET_URL = process.env.AUTOPILOT_SHEET_URL || "";
const SHEET_EVERY = parseInt(process.env.AUTOPILOT_SHEET_EVERY_CYCLES || "30", 10); // ~every 30 cycles

let cycle = 0;
let running = false;

async function pullSheetMaybe(brandId) {
  if (!SHEET_URL || cycle % SHEET_EVERY !== 0) return 0;
  try {
    const r = await leadIntel.pullSheet(brandId, { url: SHEET_URL, src: "sheet-autopilot" });
    if (r.ingested) log.info(`sheet pull: +${r.ingested} new leads`);
    return r.ingested;
  } catch (e) { log.warn("sheet pull failed", e.message); return 0; }
}

async function step(brandId) {
  const out = { sheet: 0, enriched: 0, scored: 0, enrolled: 0, outreach: 0, reengaged: 0 };
  out.sheet = await pullSheetMaybe(brandId);

  // 1. enrich 'new'
  const fresh = await db.many(
    `select id from ait_leads where brand_id=$1 and status='new' order by created_at limit $2`, [brandId, BATCH]);
  for (const l of fresh) { try { await leadIntel.enrich(brandId, l.id); out.enriched++; } catch (e) { log.warn("enrich", e.message); } }

  // 2. score 'enriched'
  const enriched = await db.many(
    `select id from ait_leads where brand_id=$1 and status='enriched' order by updated_at limit $2`, [brandId, BATCH]);
  for (const l of enriched) { try { await leadIntel.score(brandId, l.id); out.scored++; } catch (e) { log.warn("score", e.message); } }

  // 3. enroll fresh A/B leads (scored, not yet enrolled) — instant first touch
  const hot = await db.many(
    `select distinct l.id from ait_leads l
       join ait_lead_scores s on s.lead_id=l.id and s.grade in ('A','B')
       left join ait_enrollments e on e.lead_id=l.id
      where l.brand_id=$1 and l.status='scored' and e.id is null
      order by l.id limit $2`, [brandId, BATCH]);
  for (const l of hot) {
    try { const enr = await sdr.enroll(brandId, l.id); await sdr.runStep(brandId, enr.id); out.enrolled++; out.outreach++; }
    catch (e) { log.warn("enroll", e.message); }
  }

  // 4. advance due enrollments (active, next_run_at in the past)
  const due = await db.many(
    `select id from ait_enrollments where brand_id=$1 and status='active'
       and next_run_at is not null and next_run_at <= now() order by next_run_at limit $2`,
    [brandId, BATCH]);
  for (const e of due) {
    try { const r = await sdr.runStep(brandId, e.id); if (r && (r.step || r.done)) out.outreach++; }
    catch (err) { log.warn("step", err.message); }
  }

  // 5. re-engage cold leads: contacted/engaged, no activity for 30 days, no active enrollment
  const cold = await db.many(
    `select distinct l.id from ait_leads l
       left join ait_enrollments e on e.lead_id=l.id
      where l.brand_id=$1
        and l.status in ('contacted','engaged')
        and l.updated_at < now() - interval '30 days'
        and e.id is null
      order by l.updated_at limit $2`,
    [brandId, BATCH]);
  for (const l of cold) {
    try {
      const enr = await sdr.enroll(brandId, l.id);
      await sdr.runStep(brandId, enr.id);
      out.reengaged++;
    } catch (e) { log.warn("reengage", e.message); }
  }

  return out;
}

// FML Health autopilot steps
async function fmlStep(brandId) {
  const out = { reminders: 0, aftercare: 0, reviews: 0, prep: 0 };

  // 6. Process appointment reminders (24h, 2h, 30min before)
  try {
    const reminderResults = await reminders.processReminders(brandId);
    out.reminders = reminderResults.filter(r => r.status === "sent").length;
  } catch (e) { log.warn("fml:reminders", e.message); }

  // 7. Process aftercare follow-ups
  try {
    const aftercareResults = await aftercare.processFollowUps(brandId);
    out.aftercare = aftercareResults.filter(r => r.status === "sent").length;
  } catch (e) { log.warn("fml:aftercare", e.message); }

  // 8. Auto-generate prep for upcoming appointments (next 24h)
  try {
    const prepResults = await prep.autoPrep(brandId);
    out.prep = prepResults.filter(r => r.status === "sent").length;
  } catch (e) { log.warn("fml:prep", e.message); }

  // 9. Auto-request reviews for completed appointments (last 24h)
  try {
    const completedAppts = await db.many(
      `select a.id from fmlh_appointments a
       left join fmlh_reviews r on r.appointment_id = a.id
       where a.brand_id=$1 and a.status='completed'
       and a.completed_at >= now() - interval '24 hours'
       and r.id is null
       order by a.completed_at desc limit $2`,
      [brandId, BATCH]
    );
    for (const appt of completedAppts) {
      try {
        await reputation.requestReview(brandId, appt.id);
        out.reviews++;
      } catch (e) { log.warn("fml:review", e.message); }
    }
  } catch (e) { log.warn("fml:reviews", e.message); }

  return out;
}

async function tick() {
  if (running) return;
  running = true;
  cycle++;
  try {
    const brands = await db.many(`select distinct brand_id from ait_users`);
    for (const { brand_id } of brands) {
      try {
        const r = await step(brand_id);
        const touched = r.sheet + r.enriched + r.scored + r.enrolled + r.outreach + r.reengaged;
        if (touched) log.info(`cycle ${cycle} brand=${brand_id}:`, r);
        else log.debug(`cycle ${cycle} brand=${brand_id}: idle`);

        // FML Health autopilot (reminders, aftercare, reviews)
        const fml = await fmlStep(brand_id);
        const fmlTouched = fml.reminders + fml.aftercare + fml.reviews + fml.prep;
        if (fmlTouched) log.info(`cycle ${cycle} brand=${brand_id} fml:`, fml);
      } catch (e) {
        log.error(`cycle failed for brand=${brand_id}`, e.message);
      }
    }
  } catch (e) {
    log.error("tick failed", e.message);
  } finally {
    running = false;
  }
}

function start() {
  log.info(`autopilot online — multi-tenant every ${INTERVAL_MS / 1000}s, batch=${BATCH}, mode=${config.providerMode}${SHEET_URL ? ", sheet-pull on" : ""}`);
  tick();
  const timer = setInterval(tick, INTERVAL_MS);
  process.on("SIGTERM", () => { clearInterval(timer); process.exit(0); });
  return timer;
}

module.exports = { start, tick, step };

if (require.main === module) start();
