"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const db = require("../../core/db.cjs");
const svc = require("./service.cjs");

router.get("/enrollments", rbac.require("sdr:read"), async (req, res, next) => {
  try {
    const limit = +req.query.limit || 50;
    const offset = +req.query.offset || 0;
    const status = req.query.status || null;
    const VALID_STATUSES = new Set(['active', 'paused', 'done']);
    const safeStatus = status && VALID_STATUSES.has(status) ? status : null;
    const rows = await db.many(
      `select e.*, l.full_name as lead_name, c.name as company, l.email, l.status as lead_status,
              s.name as sequence_name
       from ait_enrollments e
       join ait_leads l on l.id = e.lead_id and l.brand_id = e.brand_id
       left join ait_companies c on c.id = l.company_id
       left join ait_sequences s on s.id = e.sequence_id
       where e.brand_id = $1 and ($4::text is null or e.status = $4)
       order by e.next_run_at asc
       limit $2 offset $3`,
      [req.brandId, limit, offset, safeStatus]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/enroll", rbac.require("sdr:write"), async (req, res, next) => {
  try { res.json(await svc.enroll(req.brandId, +req.body.leadId, req.body.sequenceId)); } catch (e) { next(e); }
});

router.post("/enrollments/:id/run", rbac.require("sdr:write"), async (req, res, next) => {
  try { res.json(await svc.runStep(req.brandId, +req.params.id)); } catch (e) { next(e); }
});

router.post("/leads/:id/reply", rbac.require("sdr:write"), async (req, res, next) => {
  try { res.json(await svc.handleReply(req.brandId, +req.params.id, req.body.text || "")); } catch (e) { next(e); }
});

router.post("/leads/:id/book", rbac.require("sdr:write"), async (req, res, next) => {
  try { res.json(await svc.bookMeeting(req.brandId, +req.params.id, req.body.notes, req.body.when)); } catch (e) { next(e); }
});

module.exports = router;
