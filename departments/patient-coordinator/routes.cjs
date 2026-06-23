"use strict";
// FML Health — Patient Coordinator REST routes.
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const service = require("./service.cjs");

// List patients
router.get("/patients", rbac.require("coordinator:read"), async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const result = await service.listPatients(req.brandId, { limit: +limit || 50, offset: +offset || 0 });
    res.json({ patients: result });
  } catch (e) { next(e); }
});

// Get patient by ID
router.get("/patients/:id", rbac.require("coordinator:read"), async (req, res, next) => {
  try {
    const patient = await service.getPatient(req.brandId, +req.params.id);
    if (!patient) return res.status(404).json({ error: "patient not found" });
    res.json({ patient });
  } catch (e) { next(e); }
});

// Get patient journey
router.get("/patients/:id/journey", rbac.require("coordinator:read"), async (req, res, next) => {
  try {
    const journey = await service.getJourney(req.brandId, +req.params.id);
    res.json({ journey });
  } catch (e) { next(e); }
});

// Intake a new patient (from WhatsApp webhook or manual)
router.post("/patients/intake", rbac.require("coordinator:write"), async (req, res, next) => {
  try {
    const { phone, name, email, language, source } = req.body;
    if (!phone) return res.status(400).json({ error: "phone required" });
    const patient = await service.intakePatient(req.brandId, { phone, name, email, language, source });
    res.status(201).json({ patient });
  } catch (e) { next(e); }
});

// Handle incoming WhatsApp message (webhook endpoint - requires brand auth)
router.post("/message", rbac.require("coordinator:write"), async (req, res, next) => {
  try {
    const { patientId, phone, message } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    // Intake if new patient
    let pid = patientId;
    if (!pid && phone) {
      const patient = await service.intakePatient(req.brandId, { phone, source: "whatsapp" });
      pid = patient.id;
    }
    if (!pid) return res.status(400).json({ error: "patientId or phone required" });

    const result = await service.handleMessage(req.brandId, pid, message);
    res.json(result);
  } catch (e) { next(e); }
});

// Get available slots for a doctor
router.get("/doctors/:id/slots", rbac.require("coordinator:read"), async (req, res, next) => {
  try {
    const { days } = req.query;
    const slots = await service.getAvailableSlots(req.brandId, +req.params.id, +days || 3);
    res.json({ slots });
  } catch (e) { next(e); }
});

// Book an appointment
router.post("/appointments/book", rbac.require("coordinator:write"), async (req, res, next) => {
  try {
    const { patientId, doctorId, slotDatetime, type } = req.body;
    if (!patientId || !doctorId || !slotDatetime) {
      return res.status(400).json({ error: "patientId, doctorId, slotDatetime required" });
    }
    const result = await service.bookAppointment(req.brandId, patientId, doctorId, slotDatetime, type);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

module.exports = router;
