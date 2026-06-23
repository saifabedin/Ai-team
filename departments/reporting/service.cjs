"use strict";
const db = require("../../core/db.cjs");
const { ReportingAgent } = require("./agent.cjs");
const agent = new ReportingAgent();

async function generateReport(brandId, { clientId, reportType, periodStart, periodEnd }) {
  return agent.run(brandId, "generate-report", async () => {
    const client = await db.one(`select * from ait_clients where brand_id=$1 and id=$2`, [brandId, clientId]);
    // Aggregate metrics
    const socialPosts = await db.one(`select count(*) as total, count(*) filter (where status='published') as published from ait_social_posts where brand_id=$1 and client_id=$2 and created_at between $3 and $4`, [brandId, clientId, periodStart, periodEnd]);
    const adSpend = await db.one(`select coalesce(sum(spend),0) as total_spend, coalesce(sum(conversions),0) as conversions from ait_ad_metrics am join ait_ad_campaigns ac on ac.id=am.ad_campaign_id where ac.brand_id=$1 and ac.client_id=$2 and am.date between $3 and $4`, [brandId, clientId, periodStart, periodEnd]);
    const deliverables = await db.one(`select count(*) as total, count(*) filter (where status='delivered') as delivered from ait_deliverables where brand_id=$1 and client_id=$2 and created_at between $3 and $4`, [brandId, clientId, periodStart, periodEnd]);

    const metrics = { social: socialPosts, ads: adSpend, deliverables };
    const summary = await agent.generateSummary(client, metrics, reportType || "weekly");

    const report = await db.one(
      `insert into ait_client_reports (brand_id, client_id, report_type, period_start, period_end, summary, metrics, highlights, recommendations, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') returning *`,
      [brandId, clientId, reportType || "weekly", periodStart, periodEnd,
       summary.summary, JSON.stringify(metrics), JSON.stringify(summary.highlights),
       JSON.stringify(summary.recommendations)]
    );
    return { reportId: report.id, summary: summary.summary };
  });
}

// Generate PDF for a report
async function generateReportPdf(brandId, reportId) {
  const report = await getReport(brandId, reportId);
  if (!report) throw new Error("report not found");

  const PDFDocument = require("pdfkit");
  const path = require("path");
  const fs = require("fs");

  const outputDir = path.join(__dirname, "../../output/reports");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const filePath = path.join(outputDir, `report-${report.id}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.fontSize(20).text(`Client Report: ${report.client_name || "Unknown"}`, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Report Type: ${report.report_type}`);
    doc.text(`Period: ${new Date(report.period_start).toLocaleDateString()} - ${new Date(report.period_end).toLocaleDateString()}`);
    doc.moveDown();

    // Summary
    doc.fontSize(16).text("Summary");
    doc.fontSize(12).text(report.summary || "No summary available");
    doc.moveDown();

    // Metrics
    const metrics = report.metrics || {};
    doc.fontSize(16).text("Metrics");
    if (metrics.social) {
      doc.fontSize(12).text(`Social Posts: ${metrics.social.total} total, ${metrics.social.published} published`);
    }
    if (metrics.ads) {
      doc.text(`Ad Spend: ₹${metrics.ads.total_spend}, Conversions: ${metrics.ads.conversions}`);
    }
    if (metrics.deliverables) {
      doc.text(`Deliverables: ${metrics.deliverables.total} total, ${metrics.deliverables.delivered} delivered`);
    }
    doc.moveDown();

    // Highlights
    const highlights = report.highlights || [];
    if (highlights.length > 0) {
      doc.fontSize(16).text("Highlights");
      for (const h of highlights) doc.fontSize(12).text(`• ${h}`);
      doc.moveDown();
    }

    // Recommendations
    const recommendations = report.recommendations || [];
    if (recommendations.length > 0) {
      doc.fontSize(16).text("Recommendations");
      for (const r of recommendations) doc.fontSize(12).text(`• ${r}`);
    }

    doc.end();
    stream.on("finish", () => resolve({ filePath, reportId: report.id }));
    stream.on("error", reject);
  });
}

async function listReports(brandId, { clientId, reportType, limit = 50, offset = 0 } = {}) {
  let q = `select r.*, cl.name as client_name from ait_client_reports r left join ait_clients cl on cl.id=r.client_id where r.brand_id=$1`;
  const p = [brandId]; let i = 2;
  if (clientId) { q += ` and r.client_id=$${i++}`; p.push(clientId); }
  if (reportType) { q += ` and r.report_type=$${i++}`; p.push(reportType); }
  q += ` order by r.created_at desc limit $${i++} offset $${i++}`;
  p.push(Math.min(limit, 500), offset);
  return db.many(q, p);
}

async function getReport(brandId, reportId) {
  return db.one(`select r.*, cl.name as client_name from ait_client_reports r left join ait_clients cl on cl.id=r.client_id where r.brand_id=$1 and r.id=$2`, [brandId, reportId]);
}

module.exports = { generateReport, generateReportPdf, listReports, getReport };
