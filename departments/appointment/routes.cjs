"use strict";
// FML Health — Appointment Engine REST routes.
const router = require("express").Router();
const rbac = require("../../core/rbac.cjs");
const service = require("./service.cjs");

// Get available slots for a doctor
router.get("/slots/:doctorId", rbac.require("appointment:read"), async (req, res, next) => {
  try {
    const { days } = req.query;
    const slots = await service.getSlots(req.brandId, +req.params.doctorId, +days || 7);
    res.json({ slots, count: slots.length });
  } catch (e) { next(e); }
});

// Book an appointment
router.post("/book", rbac.require("appointment:write"), async (req, res, next) => {
  try {
    const { patientId, doctorId, datetime, type, notes } = req.body;
    if (!patientId || !doctorId || !datetime) {
      return res.status(400).json({ error: "patientId, doctorId, datetime required" });
    }
    const result = await service.book(req.brandId, { patientId, doctorId, datetime, type, notes });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Reschedule an appointment
router.post("/:id/reschedule", rbac.require("appointment:write"), async (req, res, next) => {
  try {
    const { newDatetime } = req.body;
    if (!newDatetime) return res.status(400).json({ error: "newDatetime required" });
    const result = await service.reschedule(req.brandId, +req.params.id, newDatetime);
    res.json(result);
  } catch (e) { next(e); }
});

// Confirm an appointment
router.post("/:id/confirm", rbac.require("appointment:write"), async (req, res, next) => {
  try {
    const result = await service.confirmAppointment(req.brandId, +req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});

// Cancel an appointment
router.post("/:id/cancel", rbac.require("appointment:write"), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await service.cancelAppointment(req.brandId, +req.params.id, reason);
    res.json(result);
  } catch (e) { next(e); }
});

// Mark as no-show and send follow-up
router.post("/:id/no-show", rbac.require("appointment:write"), async (req, res, next) => {
  try {
    const result = await service.handleNoShow(req.brandId, +req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});

// Get doctor schedule for a date
router.get("/doctor/:doctorId/schedule", rbac.require("appointment:read"), async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date query param required" });
    const schedule = await service.getDoctorSchedule(req.brandId, +req.params.doctorId, date);
    res.json({ schedule });
  } catch (e) { next(e); }
});

// List appointments
router.get("/", rbac.require("appointment:read"), async (req, res, next) => {
  try {
    const { status, doctorId, date, limit, offset } = req.query;
    const appointments = await service.listAppointments(req.brandId, {
      status, doctorId: doctorId ? +doctorId : undefined,
      date, limit: +limit || 50, offset: +offset || 0,
    });
    res.json({ appointments });
  } catch (e) { next(e); }
});

// Get appointment stats
router.get("/stats", rbac.require("appointment:read"), async (req, res, next) => {
  try {
    const { days } = req.query;
    const stats = await service.getStats(req.brandId, +days || 30);
    res.json({ stats });
  } catch (e) { next(e); }
});

// Process due reminders (cron endpoint)
router.post("/reminders/process", rbac.require("appointment:write"), async (req, res, next) => {
  try {
    const results = await service.processReminders(req.brandId);
    res.json({ results, processed: results.length });
  } catch (e) { next(e); }
});

module.exports = router;
