"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const crm = require("../../core/crm.cjs");
const svc = require("./service.cjs");

// list leads
router.get("/leads", rbac.require("lead-intel:read"), async (req, res, next) => {
  try {
    res.json(await crm.listLeads(req.brandId, { status: req.query.status, limit: +req.query.limit || 50, offset: +req.query.offset || 0 }));
  } catch (e) { next(e); }
});

// source new leads
router.post("/source", rbac.require("lead-intel:write"), async (req, res, next) => {
  try { res.json(await svc.source(req.brandId, req.body || {})); } catch (e) { next(e); }
});

// enrich one
router.post("/leads/:id/enrich", rbac.require("lead-intel:write"), async (req, res, next) => {
  try { res.json(await svc.enrich(req.brandId, +req.params.id)); } catch (e) { next(e); }
});

// score one
router.post("/leads/:id/score", rbac.require("lead-intel:write"), async (req, res, next) => {
  try { res.json(await svc.score(req.brandId, +req.params.id)); } catch (e) { next(e); }
});

// full pipeline (source + enrich + score inline)
router.post("/run", rbac.require("lead-intel:write"), async (req, res, next) => {
  try { res.json(await svc.sourceAndProcess(req.brandId, req.body || {})); } catch (e) { next(e); }
});

// ingest rows from n8n (sheet upload → webhook). Body: array of rows, or
// { rows:[...], src, inline }. Flexible column names; auto enrich+score.
router.post("/ingest", rbac.require("lead-intel:write"), async (req, res, next) => {
  try {
    const b = req.body || {};
    const rows = Array.isArray(b) ? b : b.rows || b.data || b.leads || [];
    res.json(await svc.ingest(req.brandId, rows, { src: b.src || "n8n-sheet", inline: !!b.inline }));
  } catch (e) { next(e); }
});

// pull leads directly from a public Google Sheet / CSV URL.
router.post("/pull-sheet", rbac.require("lead-intel:write"), async (req, res, next) => {
  try {
    const b = req.body || {};
    res.json(await svc.pullSheet(req.brandId, { url: b.url, src: b.src || "sheet", inline: !!b.inline, limit: +b.limit || 0 }));
  } catch (e) { next(e); }
});

module.exports = router;
