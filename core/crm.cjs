"use strict";
// CRM helpers shared by all departments. Multi-tenant by brand_id.
const db = require("./db.cjs");

const crm = {
  async upsertCompany(brandId, c) {
    const row = await db.one(
      `insert into ait_companies (brand_id, name, domain, website, industry, size, country, city, socials, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (brand_id, domain) do update set
         name=coalesce(excluded.name, ait_companies.name),
         industry=coalesce(excluded.industry, ait_companies.industry),
         socials=ait_companies.socials || excluded.socials,
         updated_at=now()
       returning *`,
      [brandId, c.name, c.domain || null, c.website || null, c.industry || null,
       c.size || null, c.country || null, c.city || null, c.socials || {}, c.source || null]
    );
    return row;
  },

  async insertLead(brandId, l) {
    return db.one(
      `insert into ait_leads (brand_id, company_id, full_name, title, email, phone, linkedin_url, website, source, status, raw)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,'new'),$11)
       returning *`,
      [brandId, l.companyId || null, l.fullName || null, l.title || null, l.email || null,
       l.phone || null, l.linkedinUrl || null, l.website || null, l.source || null,
       l.status || null, l.raw || {}]
    );
  },

  getLead(brandId, id) {
    return db.one(`select * from ait_leads where brand_id=$1 and id=$2`, [brandId, id]);
  },

  async listLeads(brandId, { status, limit = 50, offset = 0 } = {}) {
    const rows = status
      ? await db.many(
          `select *, count(*) over()::int as total
           from ait_leads where brand_id=$1 and status=$2
           order by updated_at desc limit $3 offset $4`,
          [brandId, status, limit, offset]
        )
      : await db.many(
          `select *, count(*) over()::int as total
           from ait_leads where brand_id=$1
           order by updated_at desc limit $2 offset $3`,
          [brandId, limit, offset]
        );
    const total = rows[0]?.total ?? 0;
    return { leads: rows, total, limit, offset };
  },

  async setStatus(brandId, id, status) {
    await db.query(
      `update ait_leads set status=$3, updated_at=now() where brand_id=$1 and id=$2`,
      [brandId, id, status]
    );
  },

  async logActivity(brandId, leadId, a) {
    return db.one(
      `insert into ait_activities (brand_id, lead_id, type, direction, channel, subject, body, meta)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [brandId, leadId, a.type, a.direction || "out", a.channel || null,
       a.subject || null, a.body || null, a.meta || {}]
    );
  },

  async saveScore(brandId, leadId, s) {
    const row = await db.one(
      `insert into ait_lead_scores (brand_id, lead_id, score, grade, reasons, scored_by)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [brandId, leadId, s.score, s.grade, JSON.stringify(s.reasons || []), s.scoredBy || "lead-intel"]
    );
    await db.query(
      `update ait_leads set status='scored', updated_at=now()
       where brand_id=$1 and id=$2 and status in ('new','enriched')`,
      [brandId, leadId]
    );
    return row;
  },
};

module.exports = crm;
