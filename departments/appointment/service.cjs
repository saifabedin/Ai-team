"use strict";
// Appointment Engine orchestration — booking, rescheduling, reminders.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const { AppointmentAgent } = require("./agent.cjs");
const calendar = require("./calendar.cjs");
const reminders = require("./reminders.cjs");

const agent = new AppointmentAgent();

// Get available slots for a doctor.
async function getSlots(brandId, doctorId, daysAhead = 7) {
  const doctor = await db.one(
    `select * from fmlh_doctors where brand_id=$1 and id=$2`,
    [brandId, doctorId]
  );
  if (!doctor) throw new Error("doctor not found");

  const now = new Date();
  const slots = [];

  // Batch fetch all booked slots for this doctor in the date range (N+1 fix)
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + daysAhead);
  const bookedRows = await db.many(
    `select scheduled_at from fmlh_appointments
     where brand_id=$1 and doctor_id=$2 and status not in ('cancelled')
     and scheduled_at between $3 and $4`,
    [brandId, doctorId, now.toISOString(), rangeEnd.toISOString()]
  );
  const bookedSet = new Set(bookedRows.map(r => new Date(r.scheduled_at).toISOString()));

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
    const daySlots = doctor.available_slots[dayName] || [];

    for (const range of daySlots) {
      const [startH, startM] = range.start.split(":").map(Number);
      const [endH, endM] = range.end.split(":").map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      for (let m = startMin; m < endMin; m += doctor.slot_duration_min + doctor.buffer_min) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const slotDate = new Date(date);
        slotDate.setHours(h, min, 0, 0);

        if (slotDate <= now) continue;

        // Check if slot is already booked (in-memory check, no DB query)
        if (!bookedSet.has(slotDate.toISOString())) {
          slots.push({
            date: slotDate.toISOString().split("T")[0],
            time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
            display: slotDate.toLocaleDateString("en-IN", {
              weekday: "short", month: "short", day: "numeric",
            }) + ` at ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
            datetime: slotDate.toISOString(),
            day: dayName,
          });
        }
      }
    }
  }
  return slots;
}

// Book an appointment with full workflow.
async function book(brandId, { patientId, doctorId, datetime, type = "consultation", notes }) {
  return agent.run(brandId, "book-appointment", async () => {
    const patient = await db.one(`select * from fmlh_patients where brand_id=$1 and id=$2`, [brandId, patientId]);
    const doctor = await db.one(`select * from fmlh_doctors where brand_id=$1 and id=$2`, [brandId, doctorId]);

    // Check slot availability
    const conflict = await db.oneOrNone(
      `select id from fmlh_appointments
       where brand_id=$1 and doctor_id=$2 and scheduled_at=$3
       and status not in ('cancelled')`,
      [brandId, doctorId, datetime]
    );
    if (conflict) throw new Error("slot already booked");

    // Create appointment
    const appointment = await db.one(
      `insert into fmlh_appointments (brand_id, patient_id, doctor_id, scheduled_at, duration_min, type, status, channel, notes)
       values ($1,$2,$3,$4,$5,$6,'booked','whatsapp',$7) returning *`,
      [brandId, patientId, doctorId, datetime, doctor.slot_duration_min, type, notes || null]
    );

    // Create calendar event
    const calResult = await calendar.createCalendarEvent(brandId, appointment, patient, doctor);
    if (calResult.eventId) {
      await db.query(
        `update fmlh_appointments set meta = meta || $3 where brand_id=$1 and id=$2`,
        [brandId, appointment.id, JSON.stringify({ calendar_event_id: calResult.eventId })]
      );
    }

    // Send confirmation message
    const i18n = require("../patient-coordinator/i18n.cjs");
    const apptDate = new Date(datetime);
    const dateStr = apptDate.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });
    const timeStr = apptDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    const lang = patient.language || "en";
    const confirmMsg = i18n.patientMessage("appointment_confirmed", lang, {
      doctor: doctor.full_name,
      date: dateStr,
      time: timeStr,
    });

    const channels = require("../patient-coordinator/channels.cjs");
    await channels.whatsapp(brandId, patientId, { to: patient.phone, body: confirmMsg });

    // Log journey
    await db.one(
      `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
       values ($1,$2,$3,'appointment_booked','appointment_confirmed','whatsapp','chronos') returning id`,
      [brandId, patientId, appointment.id]
    );

    // Publish event
    await bus.publish({
      brandId,
      from: "chronos",
      to: "broadcast",
      topic: "appointment.booked",
      payload: { appointmentId: appointment.id, patientId, doctorId, datetime },
    });

    return { appointmentId: appointment.id, confirmation: confirmMsg };
  });
}

// Reschedule an appointment.
async function reschedule(brandId, appointmentId, newDatetime) {
  return agent.run(brandId, "reschedule", async () => {
    const appt = await db.one(
      `select a.*, p.full_name as patient_name, p.phone as patient_phone,
              p.language as patient_lang, d.full_name as doctor_name
       from fmlh_appointments a
       join fmlh_patients p on p.id = a.patient_id
       join fmlh_doctors d on d.id = a.doctor_id
       where a.brand_id=$1 and a.id=$2`,
      [brandId, appointmentId]
    );
    if (!appt) throw new Error("appointment not found");

    // Check new slot availability
    const conflict = await db.oneOrNone(
      `select id from fmlh_appointments
       where brand_id=$1 and doctor_id=$2 and scheduled_at=$3
       and status not in ('cancelled') and id != $4`,
      [brandId, appt.doctor_id, newDatetime, appointmentId]
    );
    if (conflict) throw new Error("new slot already booked");

    // Update appointment
    await db.query(
      `update fmlh_appointments set scheduled_at=$3, meta = meta || $4 where brand_id=$1 and id=$2`,
      [brandId, appointmentId, newDatetime, JSON.stringify({
        rescheduled_from: appt.scheduled_at,
        rescheduled_at: new Date().toISOString(),
      })]
    );

    // Send notification
    const i18n = require("../patient-coordinator/i18n.cjs");
    const apptDate = new Date(newDatetime);
    const dateStr = apptDate.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });
    const timeStr = apptDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    const lang = appt.patient_lang || "en";
    const msg = lang === "hi"
      ? `आपकी अपॉइंटमेंट डॉ. ${appt.doctor_name} के साथ ${dateStr} ${timeStr} पर रीशेड्यूल कर दी गई है।`
      : `Your appointment with Dr. ${appt.doctor_name} has been rescheduled to ${dateStr} at ${timeStr}.`;

    const channels = require("../patient-coordinator/channels.cjs");
    await channels.whatsapp(brandId, appt.patient_id, { to: appt.patient_phone, body: msg });

    return { appointmentId, newDatetime, status: "rescheduled" };
  });
}

// Get doctor's schedule for a date.
async function getDoctorSchedule(brandId, doctorId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const appointments = await db.many(
    `select a.*, p.full_name as patient_name, p.phone as patient_phone, p.language as patient_lang
     from fmlh_appointments a
     join fmlh_patients p on p.id = a.patient_id
     where a.brand_id=$1 and a.doctor_id=$2
     and a.scheduled_at between $3 and $4
     and a.status not in ('cancelled')
     order by a.scheduled_at`,
    [brandId, doctorId, startOfDay.toISOString(), endOfDay.toISOString()]
  );

  return appointments.map(a => ({
    id: a.id,
    time: new Date(a.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    patient: a.patient_name,
    type: a.type,
    status: a.status,
  }));
}

// List all appointments for a brand.
async function listAppointments(brandId, { status, doctorId, date, limit = 50, offset = 0 } = {}) {
  let query = `select a.*, p.full_name as patient_name, d.full_name as doctor_name
               from fmlh_appointments a
               join fmlh_patients p on p.id = a.patient_id
               join fmlh_doctors d on d.id = a.doctor_id
               where a.brand_id=$1`;
  const params = [brandId];
  let paramIdx = 2;

  if (status) {
    query += ` and a.status = $${paramIdx++}`;
    params.push(status);
  }
  if (doctorId) {
    query += ` and a.doctor_id = $${paramIdx++}`;
    params.push(doctorId);
  }
  if (date) {
    query += ` and a.scheduled_at::date = $${paramIdx++}`;
    params.push(date);
  }

  query += ` order by a.scheduled_at desc limit $${paramIdx++} offset $${paramIdx++}`;
  params.push(Math.min(limit, 500), offset);

  return db.many(query, params);
}

// Get appointment stats.
async function getStats(brandId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 3600000).toISOString();
  const stats = await db.one(
    `select
       count(*) as total,
       count(*) filter (where status='completed') as completed,
       count(*) filter (where status='no_show') as no_shows,
       count(*) filter (where status='cancelled') as cancelled,
       count(*) filter (where status='booked') as upcoming
     from fmlh_appointments where brand_id=$1 and created_at >= $2`,
    [brandId, since]
  );
  return {
    total: +stats.total,
    completed: +stats.completed,
    no_shows: +stats.no_shows,
    cancelled: +stats.cancelled,
    upcoming: +stats.upcoming,
    no_show_rate: stats.total > 0 ? (+stats.no_shows / +stats.total * 100).toFixed(1) + "%" : "0%",
  };
}

module.exports = { getSlots, book, reschedule, getDoctorSchedule, listAppointments, getStats, ...reminders };
