"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

router.get("/", rbac.require("content:read"), async (req, res, next) => {
  try {
    const limit = +req.query.limit || 50;
    const offset = +req.query.offset || 0;
    res.json(await svc.list(req.brandId, { limit, offset }));
  } catch (e) { next(e); }
});

router.post("/generate", rbac.require("content:write"), async (req, res, next) => {
  try { res.json(await svc.create(req.brandId, req.body || {})); } catch (e) { next(e); }
});

router.post("/:id/approve", rbac.require("content:write"), async (req, res, next) => {
  try { res.json(await svc.approve(req.brandId, +req.params.id)); } catch (e) { next(e); }
});

module.exports = router;
