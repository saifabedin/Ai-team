"use strict";
const db = require("../../core/db.cjs");

async function getConfig(brandId) {
  return db.oneOrNone(`select * from ait_white_label where brand_id=$1`, [brandId]);
}

async function saveConfig(brandId, config) {
  const existing = await getConfig(brandId);
  if (existing) {
    const fields = []; const params = [brandId]; let i = 2;
    for (const [k, v] of Object.entries(config)) {
      if (["agency_name","logo_url","primary_color","secondary_color","custom_domain","email_from_name","email_from_addr","favicon_url","css_overrides"].includes(k)) {
        fields.push(`${k}=$${i++}`);
        params.push(typeof v === "object" ? JSON.stringify(v) : v);
      }
    }
    if (fields.length > 0) { await db.query(`update ait_white_label set ${fields.join(", ")} where brand_id=$1`, params); }
  } else {
    await db.query(
      `insert into ait_white_label (brand_id, agency_name, logo_url, primary_color, secondary_color, custom_domain, email_from_name, email_from_addr)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [brandId, config.agency_name || "My Agency", config.logo_url || null,
       config.primary_color || "#2563eb", config.secondary_color || "#1e40af",
       config.custom_domain || null, config.email_from_name || null, config.email_from_addr || null]
    );
  }
  return { saved: true };
}

module.exports = { getConfig, saveConfig };
