"use strict";
// Seeds a demo brand, owner user, a default email sequence, and sample leads
// so the system is demoable end-to-end immediately. Safe to re-run.
const db = require("../core/db.cjs");
const config = require("../core/config.cjs");
const log = require("../core/logger.cjs").make("seed");
const bcrypt = require("bcryptjs");

const BRAND = config.defaultBrandId;

async function main() {
  // owner user — api_key set to env var or "changeme123" for demo
  const DEMO_API_KEY = process.env.SEED_API_KEY || "changeme123";
  const apiKeyHash = await bcrypt.hash(DEMO_API_KEY, 10);
  await db.query(
    `insert into ait_users (brand_id, email, name, role, api_key_hash)
     values ($1,$2,$3,'owner',$4)
     on conflict (brand_id, email) do update
     set api_key_hash = excluded.api_key_hash
     where ait_users.api_key_hash is null`,
    [BRAND, "owner@fixmyleads.in", "FixMyLeads Owner", apiKeyHash]
  );
  log.info(`owner login: email=owner@fixmyleads.in api_key="${DEMO_API_KEY}" — change in production!`);

  // default multi-channel sequence: WA instant → email Day1,3,7,14
  const seq = await db.one(
    `insert into ait_sequences (brand_id, name, channel)
     values ($1,'Default Outbound','email')
     on conflict do nothing returning id`,
    [BRAND]
  );
  let seqId = seq?.id;
  if (!seqId) {
    const ex = await db.one(
      `select id from ait_sequences where brand_id=$1 and name='Default Outbound'`,
      [BRAND]
    );
    seqId = ex.id;
  }
  // Step 1: instant WhatsApp (<60s), Steps 2-5: email on Day 1,3,7,14
  const steps = [
    [1, 0,   "whatsapp", "Instant first-touch: brief intro, who we are, soft CTA. Include booking link if available."],
    [2, 24,  "email",    "Day 1 email: personalized first-touch referencing their business and industry challenges."],
    [3, 72,  "email",    "Day 3 email: value bump — a quick relevant idea/insight for their industry, soft CTA to a 15-min call."],
    [4, 168, "email",    "Day 7 email: case-study angle — similar client result in their industry, ask for 15-min slot."],
    [5, 336, "email",    "Day 14 breakup email: last outreach, leave door open, wish them well."],
  ];
  for (const [no, delay, ch, tmpl] of steps) {
    await db.query(
      `insert into ait_sequence_steps (sequence_id, step_no, delay_hours, channel, template)
       values ($1,$2,$3,$4,$5)
       on conflict do nothing`,
      [seqId, no, delay, ch, tmpl]
    );
  }

  // sample leads
  const samples = [
    ["Acme Realty", "acmerealty.in", "real estate", "Riya Mehta", "Marketing Head", "riya@acmerealty.in", "+919800000001", "gmaps"],
    ["FitZone Gyms", "fitzone.co", "fitness", "Arjun Rao", "Founder", "arjun@fitzone.co", "+919800000002", "web"],
    ["Sunrise Dental", "sunrisedental.in", "healthcare", "Dr. Neha Shah", "Owner", "neha@sunrisedental.in", "+919800000003", "directory"],
  ];
  for (const [co, domain, ind, name, title, email, phone, src] of samples) {
    const company = await db.one(
      `insert into ait_companies (brand_id, name, domain, website, industry, source)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (brand_id, domain) do update set name=excluded.name
       returning id`,
      [BRAND, co, domain, `https://${domain}`, ind, src]
    );
    await db.query(
      `insert into ait_leads (brand_id, company_id, full_name, title, email, phone, website, source, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'new')`,
      [BRAND, company.id, name, title, email, phone, `https://${domain}`, src]
    );
  }

  log.info(`seeded brand='${BRAND}' (owner, sequence, ${samples.length} leads)`);
  await db.pool.end();
}

main().catch((e) => {
  log.error("seed failed", e.message);
  process.exit(1);
});
