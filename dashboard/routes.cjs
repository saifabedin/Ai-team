"use strict";
const router = require("express").Router();
const rbac = require("../core/rbac.cjs");
const audit = require("../core/audit.cjs");
const metrics = require("./metrics.cjs");

router.get("/overview", rbac.require("dashboard:read"), async (req, res, next) => {
  try { res.json(await metrics.overview(req.brandId)); } catch (e) { next(e); }
});

router.get("/today", rbac.require("dashboard:read"), async (req, res, next) => {
  try { res.json(await metrics.today(req.brandId)); } catch (e) { next(e); }
});

router.get("/team", rbac.require("dashboard:read"), async (req, res, next) => {
  try { res.json(await metrics.teamPerformance(req.brandId)); } catch (e) { next(e); }
});

router.get("/agents", rbac.require("dashboard:read"), async (req, res, next) => {
  try { res.json(await metrics.agents(req.brandId)); } catch (e) { next(e); }
});

router.get("/feed", rbac.require("dashboard:read"), async (req, res, next) => {
  try { res.json(await metrics.feed(req.brandId, Math.min(+req.query.limit || 25, 500))); } catch (e) { next(e); }
});

router.get("/leads", rbac.require("dashboard:read"), async (req, res, next) => {
  try { res.json(await metrics.recentLeads(req.brandId, Math.min(+req.query.limit || 12, 200))); } catch (e) { next(e); }
});

router.get("/audit", rbac.require("audit:read"), async (req, res, next) => {
  try { res.json(await audit.recent(req.brandId, Math.min(+req.query.limit || 100, 1000))); } catch (e) { next(e); }
});

module.exports = router;
