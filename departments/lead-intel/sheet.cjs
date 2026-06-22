"use strict";
// Sheet/CSV ingest helpers. Pulls rows from a public Google Sheet (CSV export)
// or any CSV URL, and normalizes arbitrary column names into our lead shape.
// Free: no API key — relies on the sheet being shared "anyone with link".
const axios = require("axios");
const log = require("../../core/logger.cjs").make("sheet");

// Turn a Google Sheets "edit" URL into a CSV URL. Uses the gviz endpoint, which
// serves public ("anyone with link") sheets directly without the auth redirect
// that /export?format=csv hits. Pass-through for plain .csv links.
function toCsvUrl(url) {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (!m) return url;
  const id = m[1];
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

// Minimal RFC-ish CSV parser (handles quoted fields, commas, newlines, "" escape).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// header alias → canonical field
const ALIASES = {
  full_name: ["name", "full name", "fullname", "contact", "contact name", "person", "owner name"],
  title: ["title", "job title", "designation", "role", "position"],
  email: ["email", "e-mail", "mail", "email address"],
  phone: ["phone", "mobile", "contact number", "phone number", "whatsapp", "number", "tel"],
  company: ["company", "company name", "business", "business name", "organisation", "organization", "firm"],
  website: ["website", "url", "site", "web"],
  industry: ["industry", "category", "niche", "sector", "vertical"],
  city: ["city", "location", "place", "area"],
  linkedin_url: ["linkedin", "linkedin url", "linkedin profile", "linkedin profile link", "linkedin prpfile link" /* intentional typo alias */, "link"],
  source: ["source", "lead source", "channel"],
};

function buildHeaderMap(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const key = String(h || "").trim().toLowerCase();
    for (const [canon, aliases] of Object.entries(ALIASES)) {
      if (canon === key || aliases.includes(key)) { map[i] = canon; break; }
    }
  });
  return map;
}

// Normalize one object/array row into our lead shape (flexible column names).
function normalizeRow(raw, headerMap) {
  const out = {};
  if (Array.isArray(raw)) {
    raw.forEach((v, i) => { if (headerMap[i]) out[headerMap[i]] = String(v ?? "").trim(); });
  } else {
    for (const [k, v] of Object.entries(raw)) {
      const key = k.trim().toLowerCase();
      const canon = Object.keys(ALIASES).find((c) => c === key || ALIASES[c].includes(key));
      if (canon) out[canon] = String(v ?? "").trim();
    }
  }
  return out;
}

// Fetch + parse a sheet/CSV URL into normalized rows.
async function fetchRows(url) {
  const csvUrl = toCsvUrl(url);
  log.info("pulling sheet", csvUrl);
  const { data } = await axios.get(csvUrl, { timeout: 20000, responseType: "text" });
  const grid = parseCsv(typeof data === "string" ? data : String(data));
  if (grid.length < 2) return [];
  const headerMap = buildHeaderMap(grid[0]);
  return grid.slice(1).map((r) => normalizeRow(r, headerMap)).filter((r) => r.email || r.phone || r.company);
}

module.exports = { toCsvUrl, parseCsv, buildHeaderMap, normalizeRow, fetchRows };
