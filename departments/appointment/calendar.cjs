"use strict";
// Google Calendar integration for FML Health — slot sync, event creation.
const db = require("../../core/db.cjs");
const config = require("../../core/config.cjs");
const log = require("../../core/logger.cjs").make("fmlh:calendar");

/**
 * Get available slots for a doctor on a given date.
 * Uses doctor's available_slots config (from DB) + checks existing bookings.
 */
async function getFreeSlots(doctor, date, db) {
  const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const daySlots = doctor.available_slots[dayName] || [];
  const bufferMin = doctor.buffer_min || 15;
  const slotMin = doctor.slot_duration_min || 15;
  const freeSlots = [];

  const dateObj = new Date(date);
  const now = new Date();

  for (const range of daySlots) {
    const [startH, startM] = range.start.split(":").map(Number);
    const [endH, endM] = range.end.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    for (let m = startMin; m < endMin; m += slotMin + bufferMin) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const slotTime = new Date(dateObj);
      slotTime.setHours(h, min, 0, 0);

      if (slotTime <= now) continue;

      // Check if already booked
      const booked = await db.oneOrNone(
        `select id from fmlh_appointments
         where brand_id=$1 and doctor_id=$2 and scheduled_at=$3
         and status not in ('cancelled')`,
        [doctor.brand_id, doctor.id, slotTime.toISOString()]
      );

      if (!booked) {
        freeSlots.push({
          time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
          datetime: slotTime.toISOString(),
          display: slotTime.toLocaleDateString("en-IN", {
            weekday: "short", month: "short", day: "numeric",
          }) + ` at ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
        });
      }
    }
  }
  return freeSlots;
}

/**
 * Create a Google Calendar event for an appointment.
 * Uses Google Calendar API v3 (free tier).
 */
async function createCalendarEvent(brandId, appointment, patient, doctor) {
  if (!config.isLive) {
    log.info(`[MOCK] Calendar event created for appointment #${appointment.id}`);
    return { eventId: `mock-event-${appointment.id}`, mock: true };
  }

  if (!config.googleCalendarApiKey) {
    log.warn("Google Calendar API key not configured, skipping calendar sync");
    return { eventId: null, skipped: true };
  }

  try {
    const axios = require("axios");
    const startTime = new Date(appointment.scheduled_at);
    const endTime = new Date(startTime.getTime() + (appointment.duration_min || 15) * 60000);

    const event = {
      summary: `Consultation - ${patient.full_name}`,
      description: `Patient: ${patient.full_name}\nPhone: ${patient.phone}\nType: ${appointment.type}`,
      start: { dateTime: startTime.toISOString(), timeZone: config.timezone },
      end: { dateTime: endTime.toISOString(), timeZone: config.timezone },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 15 },
          { method: "email", minutes: 60 },
        ],
      },
    };

    const resp = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${config.googleCalendarId}/events`,
      event,
      { params: { key: config.googleCalendarApiKey } }
    );

    log.info(`Calendar event created: ${resp.data.id} for appointment #${appointment.id}`);
    return { eventId: resp.data.id };
  } catch (e) {
    log.error(`Calendar event creation failed: ${e.message}`);
    return { eventId: null, error: e.message };
  }
}

/**
 * Delete a calendar event (for cancellations).
 */
async function deleteCalendarEvent(eventId) {
  if (!config.isLive || !eventId || eventId.startsWith("mock-")) {
    return { deleted: true, mock: true };
  }

  try {
    const axios = require("axios");
    await axios.delete(
      `https://www.googleapis.com/calendar/v3/calendars/${config.googleCalendarId}/events/${eventId}`,
      { params: { key: config.googleCalendarApiKey } }
    );
    return { deleted: true };
  } catch (e) {
    log.error(`Calendar event deletion failed: ${e.message}`);
    return { deleted: false, error: e.message };
  }
}

/**
 * Get upcoming events for a doctor (for availability check).
 */
async function getDoctorEvents(brandId, doctorId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const appointments = await db.many(
    `select a.*, p.full_name as patient_name, p.phone as patient_phone
     from fmlh_appointments a
     join fmlh_patients p on p.id = a.patient_id
     where a.brand_id = $1 and a.doctor_id = $2
     and a.scheduled_at between $3 and $4
     and a.status not in ('cancelled')
     order by a.scheduled_at`,
    [brandId, doctorId, startOfDay.toISOString(), endOfDay.toISOString()]
  );

  return appointments.map(a => ({
    time: new Date(a.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    patient: a.patient_name,
    type: a.type,
    status: a.status,
  }));
}

module.exports = { getFreeSlots, createCalendarEvent, deleteCalendarEvent, getDoctorEvents };
