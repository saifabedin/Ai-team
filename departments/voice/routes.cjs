"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const db = require("../../core/db.cjs");
const svc = require("./service.cjs");

router.get("/meetings", rbac.require("voice:read"), async (req, res, next) => {
  try {
    const limit = +req.query.limit || 50;
    const offset = +req.query.offset || 0;
    const rows = await db.many(
      `select m.*, l.full_name as lead_name, c.name as company, l.email
       from ait_meetings m
       join ait_leads l on l.id = m.lead_id and l.brand_id = m.brand_id
       left join ait_companies c on c.id = l.company_id
       where m.brand_id = $1
       order by m.scheduled_at desc
       limit $2 offset $3`,
      [req.brandId, limit, offset]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/leads/:id/call", rbac.require("voice:write"), async (req, res, next) => {
  try { res.json(await svc.callLead(req.brandId, +req.params.id, req.body.purpose)); } catch (e) { next(e); }
});

router.post("/meetings/:id/confirm", rbac.require("voice:write"), async (req, res, next) => {
  try { res.json(await svc.confirmMeeting(req.brandId, +req.params.id)); } catch (e) { next(e); }
});

module.exports = router;
