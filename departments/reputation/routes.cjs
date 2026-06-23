"use strict";
// FML Health — Reputation Manager REST routes.
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const service = require("./service.cjs");

// Request review after appointment
router.post("/request/:appointmentId", rbac.require("reputation:write"), async (req, res, next) => {
  try {
    const { platform } = req.body;
    const result = await service.requestReview(req.brandId, +req.params.appointmentId, platform);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Process incoming review
router.post("/process", rbac.require("reputation:write"), async (req, res, next) => {
  try {
    const { patientId, appointmentId, platform, rating, text } = req.body;
    if (!patientId || !rating || !text) {
      return res.status(400).json({ error: "patientId, rating, text required" });
    }
    const result = await service.processReview(req.brandId, { patientId, appointmentId, platform, rating, text });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Respond to a review
router.post("/:id/respond", rbac.require("reputation:write"), async (req, res, next) => {
  try {
    const { response } = req.body;
    if (!response) return res.status(400).json({ error: "response required" });
    const result = await service.respondToReview(req.brandId, +req.params.id, response);
    res.json(result);
  } catch (e) { next(e); }
});

// List reviews
router.get("/", rbac.require("reputation:read"), async (req, res, next) => {
  try {
    const { sentiment, platform, limit, offset } = req.query;
    const reviews = await service.listReviews(req.brandId, {
      sentiment, platform, limit: +limit || 50, offset: +offset || 0,
    });
    res.json({ reviews });
  } catch (e) { next(e); }
});

// Get review stats
router.get("/stats", rbac.require("reputation:read"), async (req, res, next) => {
  try {
    const stats = await service.getStats(req.brandId);
    res.json({ stats });
  } catch (e) { next(e); }
});

// Auto-request reviews for recent appointments
router.post("/auto-request", rbac.require("reputation:write"), async (req, res, next) => {
  try {
    const results = await service.autoRequestReviews(req.brandId);
    res.json({ results, processed: results.length });
  } catch (e) { next(e); }
});

module.exports = router;
