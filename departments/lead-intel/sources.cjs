"use strict";
// Lead sources. PROVIDER_MODE=mock returns realistic synthetic leads (free,
// zero-risk, demoable). PROVIDER_MODE=live wires real scrapers/APIs — each
// has a clearly-marked TODO for the credential/endpoint to plug in.
const axios = require("axios");
const cheerio = require("cheerio");
const config = require("../../core/config.cjs");
const log = require("../../core/logger.cjs").make("lead-sources");

// --- MOCK generators (deterministic-ish, varied by query) ---
function mockBatch(kind, query, n = 5) {
  const industries = ["real estate", "fitness", "healthcare", "hospitality", "education", "retail"];
  const cities = ["Mumbai", "Bengaluru", "Delhi", "Pune", "Hyderabad"];
  const out = [];
  for (let i = 0; i < n; i++) {
    const ind = industries[(query.length + i) % industries.length];
    const city = cities[(query.length + i) % cities.length];
    const slug = `${kind}${i}-${query.replace(/\W+/g, "").slice(0, 6).toLowerCase() || "biz"}`;
    out.push({
      company: { name: `${cap(slug)} ${cap(ind.split(" ")[0])}`, domain: `${slug}.example.com`,
        website: `https://${slug}.example.com`, industry: ind, city, country: "India", source: kind },
      fullName: `Owner ${i + 1}`,
      title: ["Founder", "Marketing Head", "Owner", "CEO"][(i) % 4],
      email: `contact@${slug}.example.com`,
      phone: `+9198${String(10000000 + i + query.length).slice(0, 8)}`,
      website: `https://${slug}.example.com`,
      source: kind,
    });
  }
  return out;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --- Source: Google Maps ---
async function googleMaps(query, n) {
  if (!config.isLive) return mockBatch("gmaps", query, n);
  // TODO(live): plug a free scraper (e.g. self-hosted nominatim + places HTML),
  // or SERP_API_URL. Must respect ToS / rate limits.
  log.warn("live gmaps not configured — falling back to mock");
  return mockBatch("gmaps", query, n);
}

// --- Source: generic website / directory crawl (free, cheerio) ---
async function website(url) {
  try {
    const { data } = await axios.get(url, { timeout: 15000, headers: { "User-Agent": "FixMyLeads-AI-Team/1.0" } });
    const $ = cheerio.load(data);
    const text = $("body").text();
    const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || null;
    const phone = (text.match(/\+?\d[\d ()-]{8,}\d/) || [])[0]?.trim() || null;
    const title = $("title").first().text().trim() || null;
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return [{
      company: { name: title || domain, domain, website: url, source: "web" },
      fullName: null, title: null, email, phone, website: url, source: "web",
    }];
  } catch (e) {
    log.warn(`website scrape failed ${url}`, e.message);
    return [];
  }
}

// --- Source: LinkedIn (live needs LINKEDIN_COOKIE; mock otherwise) ---
async function linkedin(query, n) {
  if (!config.isLive || !config.linkedinCookie) return mockBatch("linkedin", query, n);
  // TODO(live): authenticated session via LINKEDIN_COOKIE. Heavy ToS risk —
  // prefer official partner APIs or manual export. Stubbed to mock by default.
  log.warn("live linkedin disabled by policy — using mock");
  return mockBatch("linkedin", query, n);
}

// --- Source: directory (mock) ---
async function directory(query, n) {
  return mockBatch("directory", query, n);
}

module.exports = { googleMaps, website, linkedin, directory };
