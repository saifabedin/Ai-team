"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const svc = require("./service.cjs");

router.get("/", rbac.require("calendar:read"), async (req, res, next) => {
  try { res.json({ calendar: await svc.getCalendar(req.brandId, req.query) }); } catch (e) { next(e); }
});
router.get("/week", rbac.require("calendar:read"), async (req, res, next) => {
  try { res.json({ calendar: await svc.getWeekView(req.brandId, req.query.date || new Date().toISOString()) }); } catch (e) { next(e); }
});
router.get("/month", rbac.require("calendar:read"), async (req, res, next) => {
  try { const { year, month } = req.query; res.json({ calendar: await svc.getMonthView(req.brandId, +year || new Date().getFullYear(), +month || new Date().getMonth() + 1) }); } catch (e) { next(e); }
});
module.exports = router;
