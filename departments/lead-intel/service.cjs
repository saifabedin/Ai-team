"use strict";
// Lead Intelligence orchestration: source -> store -> enrich -> score -> CRM.
const crm = require("../../core/crm.cjs");
const { enqueue } = require("../../core/queue.cjs");
const { LeadIntelAgent } = require("./agent.cjs");
const sources = require("./sources.cjs");
const { enrichLead } = require("./enrich.cjs");
const sheet = require("./sheet.cjs");
const db = require("../../core/db.cjs");

const agent = new LeadIntelAgent();

// Pull raw leads from a source and persist them (status=new).
async function source(brandId, { source: src = "gmaps", query = "", url, limit = 5 }) {
  let raw = [];
  if (src === "gmaps") raw = await sources.googleMaps(query, limit);
  else if (src === "linkedin") raw = await sources.linkedin(query, limit);
  else if (src === "directory") raw = await sources.directory(query, limit);
  else if (src === "web" && url) raw = await sources.website(url);
  else throw new Error(`bad source '${src}' (need query, or url for web)`);

  const created = [];
  for (const r of raw) {
    const company = await crm.upsertCompany(brandId, r.company || {});
    const lead = await crm.insertLead(brandId, {
      companyId: company.id,
      fullName: r.fullName,
      title: r.title,
      email: r.email,
      phone: r.phone,
      linkedinUrl: r.linkedinUrl,
      website: r.website,
      source: r.source || src,
      raw: r,
    });
    created.push(lead);
    // pipeline: enqueue enrich+score (workers pick up); also runnable inline.
    await enqueue("enrich", "enrich-lead", { brandId, leadId: lead.id }).catch(() => {});
  }
  return { sourced: created.length, leads: created };
}

// Enrich a single lead (fills email/phone), status -> enriched.
async function enrich(brandId, leadId) {
  const lead = await crm.getLead(brandId, leadId);
  if (!lead) throw new Error("lead not found");
  const company = lead.company_id
    ? await db.one(`select * from ait_companies where id=$1`, [lead.company_id])
    : null;
  const e = await enrichLead(lead, company);
  await db.query(
    `update ait_leads set email=coalesce($3,email), phone=coalesce($4,phone),
       status=case when status='new' then 'enriched' else status end, updated_at=now()
     where brand_id=$1 and id=$2`,
    [brandId, leadId, e.email || null, e.phone || null]
  );
  await enqueue("score", "score-lead", { brandId, leadId }).catch(() => {});
  return { leadId, email: e.email, phone: e.phone, guessed: !!e.emailGuessed };
}

// Score a single lead with the agent, save to ait_lead_scores.
async function score(brandId, leadId) {
  return agent.run(brandId, "score-lead", async () => {
    const lead = await crm.getLead(brandId, leadId);
    if (!lead) throw new Error("lead not found");
    const company = lead.company_id
      ? await db.one(`select * from ait_companies where id=$1`, [lead.company_id])
      : null;
    const s = await agent.score(lead, company);
    await crm.saveScore(brandId, leadId, { ...s, scoredBy: "scout" });
    return { leadId, ...s };
  });
}

// Convenience: full pipeline inline (no queue) — used by smoke test.
async function sourceAndProcess(brandId, opts) {
  const { leads } = await source(brandId, opts);
  const results = [];
  for (const l of leads) {
    await enrich(brandId, l.id);
    results.push(await score(brandId, l.id));
  }
  return results;
}

// Free-mail / social domains must NOT be used as a company key, else many
// distinct businesses (all with gmail / linkedin links) collapse into one row.
const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com",
  "live.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "rediffmail.com",
  "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com", "t.me",
]);

function deriveDomain(r) {
  let d = null;
  if (r.website) { try { d = new URL(/^https?:/.test(r.website) ? r.website : `https://${r.website}`).hostname.replace(/^www\./, ""); } catch {} }
  if (!d && r.email && r.email.includes("@")) d = r.email.split("@")[1].toLowerCase();
  // null out generic providers so each business stays its own company row.
  return d && !GENERIC_DOMAINS.has(d) ? d : null;
}

// Persist one normalized lead row (from a sheet/webhook) into the CRM.
async function ingestOne(brandId, r, src = "sheet") {
  const companyName = r.company || r.full_name || r.email || "Unknown";
  const domain = deriveDomain(r);
  const company = await crm.upsertCompany(brandId, {
    name: companyName, domain, website: domain ? `https://${domain}` : (r.website || null),
    industry: r.industry || null, city: r.city || null, source: src,
  });
  const lead = await crm.insertLead(brandId, {
    companyId: company.id, fullName: r.full_name || null, title: r.title || null,
    email: r.email || null, phone: r.phone || null, linkedinUrl: r.linkedin_url || null,
    website: r.website || null, source: r.source || src, raw: r,
  });
  return lead;
}

// Ingest an array of raw rows (from n8n webhook). Flexible column names are
// normalized; each new lead is queued for enrich+score (or run inline).
async function ingest(brandId, rows = [], { src = "sheet", inline = false } = {}) {
  const list = (Array.isArray(rows) ? rows : [rows]).map((r) => sheet.normalizeRow(r, {}));
  const created = [];
  for (const r of list) {
    if (!r.email && !r.phone && !r.company) continue;
    const lead = await ingestOne(brandId, r, src);
    created.push(lead);
    if (inline) { await enrich(brandId, lead.id); await score(brandId, lead.id); }
    else await enqueue("enrich", "enrich-lead", { brandId, leadId: lead.id }).catch(() => {});
  }
  return { ingested: created.length, leadIds: created.map((l) => l.id) };
}

// Pull rows directly from a public Google Sheet / CSV URL, then ingest them.
// `limit` caps how many rows are ingested per call (controlled batches).
async function pullSheet(brandId, { url, src = "sheet", inline = false, limit = 0 } = {}) {
  if (!url) throw new Error("url required (public Google Sheet or CSV link)");
  const rows = await sheet.fetchRows(url);
  let list = rows.filter((r) => r.email || r.phone || r.company);
  if (limit > 0) list = list.slice(0, limit);
  const created = [];
  for (const r of list) {
    const lead = await ingestOne(brandId, r, src);
    created.push(lead);
    if (inline) { await enrich(brandId, lead.id); await score(brandId, lead.id); }
    else await enqueue("enrich", "enrich-lead", { brandId, leadId: lead.id }).catch(() => {});
  }
  return { pulled: rows.length, ingested: created.length, leadIds: created.map((l) => l.id) };
}

module.exports = { source, enrich, score, sourceAndProcess, ingest, pullSheet };
