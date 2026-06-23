"use strict";
// FML Health — Pre-appointment Prep REST routes.
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const service = require("./service.cjs");

// Generate prep workflow for an appointment
router.post("/generate/:appointmentId", rbac.require("prep:write"), async (req, res, next) => {
  try {
    const result = await service.generatePrep(req.brandId, +req.params.appointmentId);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Send prep instructions
router.post("/:id/send", rbac.require("prep:write"), async (req, res, next) => {
  try {
    const { stepIndex, sendAll } = req.body;
    const result = await service.sendPrep(req.brandId, +req.params.id, { stepIndex, sendAll });
    res.json(result);
  } catch (e) { next(e); }
});

// Get prep workflow for an appointment
router.get("/appointment/:appointmentId", rbac.require("prep:read"), async (req, res, next) => {
  try {
    const prep = await service.getPrep(req.brandId, +req.params.appointmentId);
    if (!prep) return res.status(404).json({ error: "prep workflow not found" });
    res.json({ prep });
  } catch (e) { next(e); }
});

// List prep workflows
router.get("/", rbac.require("prep:read"), async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const preps = await service.listPreps(req.brandId, {
      status, limit: +limit || 50, offset: +offset || 0,
    });
    res.json({ preps });
  } catch (e) { next(e); }
});

// Auto-generate and send prep for upcoming appointments
router.post("/auto", rbac.require("prep:write"), async (req, res, next) => {
  try {
    const results = await service.autoPrep(req.brandId);
    res.json({ results, processed: results.length });
  } catch (e) { next(e); }
});

module.exports = router;
