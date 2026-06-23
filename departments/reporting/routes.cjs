"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

router.post("/generate", rbac.require("reporting:write"), async (req, res, next) => {
  try { res.status(201).json(await svc.generateReport(req.brandId, req.body)); } catch (e) { next(e); }
});
router.get("/", rbac.require("reporting:read"), async (req, res, next) => {
  try { res.json({ reports: await svc.listReports(req.brandId, req.query) }); } catch (e) { next(e); }
});
router.get("/:id", rbac.require("reporting:read"), async (req, res, next) => {
  try { res.json({ report: await svc.getReport(req.brandId, +req.params.id) }); } catch (e) { next(e); }
});
router.get("/:id/pdf", rbac.require("reporting:read"), async (req, res, next) => {
  try {
    const result = await svc.generateReportPdf(req.brandId, +req.params.id);
    res.download(result.filePath, `report-${req.params.id}.pdf`);
  } catch (e) { next(e); }
});
module.exports = router;
