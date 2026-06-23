"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

// Allowed status values for ad campaigns
const VALID_CAMPAIGN_STATUSES = new Set(["draft", "pending", "active", "paused", "completed", "cancelled"]);

router.post("/campaigns", rbac.require("ad-ops:write"), async (req, res, next) => {
  try { res.status(201).json(await svc.createCampaign(req.brandId, req.body)); } catch (e) { next(e); }
});
router.get("/campaigns", rbac.require("ad-ops:read"), async (req, res, next) => {
  try { res.json({ campaigns: await svc.listCampaigns(req.brandId, req.query) }); } catch (e) { next(e); }
});
router.post("/campaigns/:id/metrics", rbac.require("ad-ops:write"), async (req, res, next) => {
  try { res.json(await svc.recordMetrics(req.brandId, +req.params.id, req.body)); } catch (e) { next(e); }
});
router.get("/campaigns/:id/metrics", rbac.require("ad-ops:read"), async (req, res, next) => {
  try { res.json({ metrics: await svc.getMetrics(req.brandId, +req.params.id, req.query) }); } catch (e) { next(e); }
});
router.put("/campaigns/:id/status", rbac.require("ad-ops:write"), async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!status || !VALID_CAMPAIGN_STATUSES.has(status)) {
      return res.status(400).json({ error: "bad_request", detail: `Invalid status. Allowed: ${[...VALID_CAMPAIGN_STATUSES].join(", ")}` });
    }
    res.json(await svc.updateStatus(req.brandId, +req.params.id, status));
  } catch (e) { next(e); }
});
module.exports = router;
