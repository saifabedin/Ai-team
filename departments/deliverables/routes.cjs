"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

// Allowed status values for deliverables
const VALID_DELIVERABLE_STATUSES = new Set(["pending", "in_progress", "review", "delivered", "approved", "revision"]);

router.post("/", rbac.require("deliverables:write"), async (req, res, next) => {
  try { res.status(201).json(await svc.createDeliverable(req.brandId, req.body)); } catch (e) { next(e); }
});
router.put("/:id/status", rbac.require("deliverables:write"), async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!status || !VALID_DELIVERABLE_STATUSES.has(status)) {
      return res.status(400).json({ error: "bad_request", detail: `Invalid status. Allowed: ${[...VALID_DELIVERABLE_STATUSES].join(", ")}` });
    }
    res.json(await svc.updateStatus(req.brandId, +req.params.id, status));
  } catch (e) { next(e); }
});
router.get("/", rbac.require("deliverables:read"), async (req, res, next) => {
  try { res.json({ deliverables: await svc.listDeliverables(req.brandId, req.query) }); } catch (e) { next(e); }
});
router.get("/stats", rbac.require("deliverables:read"), async (req, res, next) => {
  try { res.json({ stats: await svc.getStats(req.brandId, req.query.clientId ? +req.query.clientId : undefined) }); } catch (e) { next(e); }
});
module.exports = router;
