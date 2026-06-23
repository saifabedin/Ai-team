"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

router.post("/calculate/:clientId", rbac.require("client-health:write"), async (req, res, next) => {
  try { res.json(await svc.calculateHealth(req.brandId, +req.params.clientId)); } catch (e) { next(e); }
});
router.get("/client/:clientId", rbac.require("client-health:read"), async (req, res, next) => {
  try { res.json({ health: await svc.getHealth(req.brandId, +req.params.clientId) }); } catch (e) { next(e); }
});
router.get("/", rbac.require("client-health:read"), async (req, res, next) => {
  try { res.json({ health: await svc.listHealth(req.brandId, req.query) }); } catch (e) { next(e); }
});
module.exports = router;
