"use strict";
// FML Health — Aftercare REST routes.
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const service = require("./service.cjs");

// Generate aftercare for an appointment
router.post("/generate/:appointmentId", rbac.require("aftercare:write"), async (req, res, next) => {
  try {
    const { doctorNotes } = req.body;
    const result = await service.generate(req.brandId, +req.params.appointmentId, doctorNotes);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Handle patient reply to follow-up
router.post("/reply/:appointmentId", rbac.require("aftercare:write"), async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });
    const result = await service.handleReply(req.brandId, +req.params.appointmentId, message);
    res.json(result);
  } catch (e) { next(e); }
});

// Get aftercare for an appointment
router.get("/appointment/:appointmentId", rbac.require("aftercare:read"), async (req, res, next) => {
  try {
    const aftercare = await service.getAftercare(req.brandId, +req.params.appointmentId);
    if (!aftercare) return res.status(404).json({ error: "aftercare not found" });
    res.json({ aftercare });
  } catch (e) { next(e); }
});

// Get aftercare for a patient
router.get("/patient/:patientId", rbac.require("aftercare:read"), async (req, res, next) => {
  try {
    const aftercare = await service.getPatientAftercare(req.brandId, +req.params.patientId);
    res.json({ aftercare });
  } catch (e) { next(e); }
});

// List all aftercare
router.get("/", rbac.require("aftercare:read"), async (req, res, next) => {
  try {
    const { compliance, limit, offset } = req.query;
    const aftercare = await service.listAftercare(req.brandId, {
      compliance, limit: +limit || 50, offset: +offset || 0,
    });
    res.json({ aftercare });
  } catch (e) { next(e); }
});

// Process due follow-ups (cron endpoint)
router.post("/follow-ups/process", rbac.require("aftercare:write"), async (req, res, next) => {
  try {
    const results = await service.processFollowUps(req.brandId);
    res.json({ results, processed: results.length });
  } catch (e) { next(e); }
});

// Get aftercare stats
router.get("/stats", rbac.require("aftercare:read"), async (req, res, next) => {
  try {
    const stats = await service.getStats(req.brandId);
    res.json({ stats });
  } catch (e) { next(e); }
});

module.exports = router;
