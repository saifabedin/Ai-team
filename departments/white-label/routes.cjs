"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

router.get("/", rbac.require("white-label:read"), async (req, res, next) => {
  try { res.json({ config: await svc.getConfig(req.brandId) }); } catch (e) { next(e); }
});
router.post("/", rbac.require("white-label:write"), async (req, res, next) => {
  try { res.json(await svc.saveConfig(req.brandId, req.body)); } catch (e) { next(e); }
});
module.exports = router;
