"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

router.post("/posts", rbac.require("social:write"), async (req, res, next) => {
  try { res.status(201).json(await svc.createPost(req.brandId, req.body)); } catch (e) { next(e); }
});
router.post("/posts/:id/schedule", rbac.require("social:write"), async (req, res, next) => {
  try { res.json(await svc.schedulePost(req.brandId, +req.params.id, req.body.scheduledAt)); } catch (e) { next(e); }
});
router.get("/posts", rbac.require("social:read"), async (req, res, next) => {
  try { res.json({ posts: await svc.listPosts(req.brandId, req.query) }); } catch (e) { next(e); }
});
router.post("/accounts", rbac.require("social:write"), async (req, res, next) => {
  try { res.status(201).json(await svc.connectAccount(req.brandId, req.body)); } catch (e) { next(e); }
});
router.get("/calendar", rbac.require("social:read"), async (req, res, next) => {
  try { res.json({ calendar: await svc.getCalendar(req.brandId, req.query) }); } catch (e) { next(e); }
});
module.exports = router;
