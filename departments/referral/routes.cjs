"use strict";
// FML Health — Referral System REST routes.
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const service = require("./service.cjs");

// Generate referral code for a patient
router.post("/generate/:patientId", rbac.require("referral:write"), async (req, res, next) => {
  try {
    const result = await service.generateCode(req.brandId, +req.params.patientId);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Create a referral (when someone uses a code)
router.post("/create", rbac.require("referral:write"), async (req, res, next) => {
  try {
    const { referralCode, referredName, referredPhone } = req.body;
    if (!referralCode || !referredName || !referredPhone) {
      return res.status(400).json({ error: "referralCode, referredName, referredPhone required" });
    }
    const result = await service.createReferral(req.brandId, { referralCode, referredName, referredPhone });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Mark referral as converted
router.post("/:id/convert", rbac.require("referral:write"), async (req, res, next) => {
  try {
    const { referredPatientId } = req.body;
    const result = await service.convertReferral(req.brandId, +req.params.id, referredPatientId);
    res.json(result);
  } catch (e) { next(e); }
});

// Get share link and message for a patient
router.get("/share/:patientId", rbac.require("referral:read"), async (req, res, next) => {
  try {
    const result = await service.getShareLink(req.brandId, +req.params.patientId);
    res.json(result);
  } catch (e) { next(e); }
});

// List referrals
router.get("/", rbac.require("referral:read"), async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const referrals = await service.listReferrals(req.brandId, {
      status, limit: +limit || 50, offset: +offset || 0,
    });
    res.json({ referrals });
  } catch (e) { next(e); }
});

// Get referral stats
router.get("/stats", rbac.require("referral:read"), async (req, res, next) => {
  try {
    const stats = await service.getStats(req.brandId);
    res.json({ stats });
  } catch (e) { next(e); }
});

// Get top referrers
router.get("/top", rbac.require("referral:read"), async (req, res, next) => {
  try {
    const { limit } = req.query;
    const topReferrers = await service.getTopReferrers(req.brandId, +limit || 10);
    res.json({ topReferrers });
  } catch (e) { next(e); }
});

module.exports = router;
