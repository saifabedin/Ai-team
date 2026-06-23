"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

router.post("/", rbac.require("campaign:write"), async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.brandId, req.body)); } catch (e) { next(e); }
});
router.get("/", rbac.require("campaign:read"), async (req, res, next) => {
  try { res.json({ campaigns: await svc.listCampaigns(req.brandId, req.query) }); } catch (e) { next(e); }
});
router.get("/stats", rbac.require("campaign:read"), async (req, res, next) => {
  try { res.json({ stats: await svc.getStats(req.brandId) }); } catch (e) { next(e); }
});
router.get("/:id", rbac.require("campaign:read"), async (req, res, next) => {
  try { res.json({ campaign: await svc.getCampaign(req.brandId, +req.params.id) }); } catch (e) { next(e); }
});
router.put("/:id", rbac.require("campaign:write"), async (req, res, next) => {
  try { res.json(await svc.update(req.brandId, +req.params.id, req.body)); } catch (e) { next(e); }
});
module.exports = router;
