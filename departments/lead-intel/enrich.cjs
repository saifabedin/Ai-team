"use strict";
// Lead enrichment. Free-first: derives what it can from the data we already
// have + a cheap website probe. Live mode can call enrichment APIs.
const sources = require("./sources.cjs");

async function enrichLead(lead, company) {
  const enriched = { ...lead };
  // Derive email pattern if missing and we have a domain.
  const domain = company?.domain;
  if (!enriched.email && domain && enriched.fullName) {
    const parts = enriched.fullName.split(" ").filter(Boolean);
    const first = (parts[0] || "").toLowerCase();
    const last = (parts[1] || "").toLowerCase();
    // first.last@domain is the most common business email format
    enriched.email = last ? `${first}.${last}@${domain}` : `${first}@${domain}`;
    enriched.emailGuessed = true;
    enriched.emailConfidence = "low";
  }
  // Probe website for phone/socials if we have one and lack a phone.
  if (company?.website && !enriched.phone) {
    const probe = await sources.website(company.website).catch(() => []);
    if (probe[0]?.phone) enriched.phone = probe[0].phone;
  }
  return enriched;
}

module.exports = { enrichLead };
