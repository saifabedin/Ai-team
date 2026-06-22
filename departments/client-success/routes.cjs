"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

router.get("/clients", rbac.require("success:read"), async (req, res, next) => {
  try {
    const limit = +req.query.limit || 50;
    const offset = +req.query.offset || 0;
    res.json(await svc.listClients(req.brandId, { limit, offset }));
  } catch (e) { next(e); }
});

router.post("/onboard", rbac.require("success:write"), async (req, res, next) => {
  try { res.json(await svc.onboard(req.brandId, req.body || {})); } catch (e) { next(e); }
});

router.get("/clients/:id/status", rbac.require("success:read"), async (req, res, next) => {
  try { res.json(await svc.status(req.brandId, +req.params.id)); } catch (e) { next(e); }
});

router.post("/clients/:id/upsell", rbac.require("success:write"), async (req, res, next) => {
  try { res.json(await svc.upsell(req.brandId, +req.params.id)); } catch (e) { next(e); }
});

module.exports = router;
