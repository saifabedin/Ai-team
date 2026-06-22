"use strict";
// Proposal orchestration: generate -> store -> (optional) PDF.
const db = require("../../core/db.cjs");
const crm = require("../../core/crm.cjs");
const { ProposalAgent } = require("./agent.cjs");
const { toPDF } = require("./pdf.cjs");
const log = require("../../core/logger.cjs").make("proposal");

const agent = new ProposalAgent();

async function create(brandId, { leadId, kind = "proposal", brief = {}, pdf = true }) {
  return agent.run(brandId, `generate-${kind}`, async () => {
    const lead = leadId ? await crm.getLead(brandId, leadId) : null;
    const co = lead?.company_id ? await db.one(`select * from ait_companies where id=$1`, [lead.company_id]) : null;
    const { body, amount } = await agent.generate(kind, lead, co, brief);
    const title = `${cap(kind)} — ${co?.name || "Prospect"}`;
    const row = await db.one(
      `insert into ait_proposals (brand_id, lead_id, kind, title, body, amount, currency, status)
       values ($1,$2,$3,$4,$5,$6,'INR','draft') returning *`,
      [brandId, leadId || null, kind, title, body, amount]
    );
    let pdfPath = null;
    if (pdf && kind !== "followup") {
      try {
        pdfPath = await toPDF(row.id, title, body);
        await db.query(`update ait_proposals set pdf_path=$3 where brand_id=$1 and id=$2`, [brandId, row.id, pdfPath]);
      } catch (e) {
        log.warn(`PDF generation failed for proposal ${row.id}: ${e.message}`);
        // Proposal is saved; PDF can be regenerated later. Return pdfPath as null.
      }
    }
    return { id: row.id, kind, title, amount, pdfPath, body };
  });
}

async function send(brandId, id) {
  await db.query(`update ait_proposals set status='sent' where brand_id=$1 and id=$2`, [brandId, id]);
  return { id, status: "sent" };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
module.exports = { create, send };
