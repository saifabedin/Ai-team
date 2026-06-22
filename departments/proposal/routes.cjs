"use strict";
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const db = require("../../core/db.cjs");
const svc = require("./service.cjs");

router.get("/", rbac.require("proposal:read"), async (req, res, next) => {
  try {
    const limit = +req.query.limit || 50;
    const offset = +req.query.offset || 0;
    res.json(await db.many(
      `select id,kind,title,amount,status,pdf_path,created_at
       from ait_proposals where brand_id=$1
       order by id desc limit $2 offset $3`,
      [req.brandId, Math.min(limit, 200), offset]
    ));
  } catch (e) { next(e); }
});

router.post("/generate", rbac.require("proposal:write"), async (req, res, next) => {
  try { res.json(await svc.create(req.brandId, req.body || {})); } catch (e) { next(e); }
});

router.post("/:id/send", rbac.require("proposal:write"), async (req, res, next) => {
  try { res.json(await svc.send(req.brandId, +req.params.id)); } catch (e) { next(e); }
});

module.exports = router;
