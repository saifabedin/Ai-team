"use strict";
// Reminder engine for FML Health — 24h, 2h, 30min before appointment.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const log = require("../../core/logger.cjs").make("fmlh:reminders");

// Whitelist of allowed boolean reminder columns — prevents SQL injection via column name
const ALLOWED_REMINDER_FIELDS = new Set(["reminder_24h_sent", "reminder_2h_sent", "reminder_30m_sent"]);

const REMINDER_WINDOWS = [
  { hours: 24, field: "reminder_24h_sent", label: "24-hour" },
  { hours: 2, field: "reminder_2h_sent", label: "2-hour" },
  { hours: 0.5, field: "reminder_30m_sent", label: "30-minute" },
];

/**
 * Check and send due reminders for upcoming appointments.
 * Called by autopilot or cron job.
 */
async function processReminders(brandId) {
  const now = new Date();
  const results = [];

  for (const window of REMINDER_WINDOWS) {
    if (!ALLOWED_REMINDER_FIELDS.has(window.field)) {
      log.error(`Invalid reminder field: ${window.field}, skipping`);
      continue;
    }
    const windowStart = new Date(now.getTime() + window.hours * 3600000);
    const windowEnd = new Date(now.getTime() + (window.hours + 0.5) * 3600000);

    const appointments = await db.many(
      `select a.*, p.full_name as patient_name, p.phone as patient_phone,
              p.language as patient_lang, p.email as patient_email,
              d.full_name as doctor_name, d.specialty as doctor_specialty
       from fmlh_appointments a
       join fmlh_patients p on p.id = a.patient_id
       join fmlh_doctors d on d.id = a.doctor_id
       where a.brand_id = $1
       and a.status in ('booked', 'confirmed')
       and a.scheduled_at between $2 and $3
       and a.${window.field} = false
       order by a.scheduled_at`,
      [brandId, windowStart.toISOString(), windowEnd.toISOString()]
    );

    for (const appt of appointments) {
      try {
        await sendReminder(brandId, appt, window);
        results.push({ appointmentId: appt.id, reminder: window.label, status: "sent" });
      } catch (e) {
        log.error(`Reminder failed for appointment #${appt.id}: ${e.message}`);
        results.push({ appointmentId: appt.id, reminder: window.label, status: "failed", error: e.message });
      }
    }
  }

  return results;
}

/**
 * Send a single reminder for an appointment.
 */
async function sendReminder(brandId, appointment, window) {
  const lang = appointment.patient_lang || "en";
  const i18n = require("../patient-coordinator/i18n.cjs");

  const apptDate = new Date(appointment.scheduled_at);
  const dateStr = apptDate.toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = apptDate.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  // Generate reminder message based on language and window
  const messages = {
    en: {
      "24-hour": `Reminder: Your appointment with Dr. ${appointment.doctor_name} (${appointment.doctor_specialty}) is tomorrow at ${timeStr}. Please arrive 15 minutes early.`,
      "2-hour": `Reminder: Your appointment with Dr. ${appointment.doctor_name} is in 2 hours at ${timeStr}. Please start getting ready.`,
      "30-minute": `Reminder: Your appointment with Dr. ${appointment.doctor_name} is in 30 minutes at ${timeStr}. Please head to the clinic now.`,
    },
    hi: {
      "24-hour": `याद दिलाना: डॉ. ${appointment.doctor_name} (${appointment.doctor_specialty}) से आपकी अपॉइंटमेंट कल ${timeStr} पर है। कृपया 15 मिनट पहले पहुँचें।`,
      "2-hour": `याद दिलाना: डॉ. ${appointment.doctor_name} से आपकी अपॉइंटमेंट 2 घंटे में ${timeStr} पर है। कृपया तैयार हो जाएं।`,
      "30-minute": `याद दिलाना: डॉ. ${appointment.doctor_name} से आपकी अपॉइंटमेंट 30 मिनट में ${timeStr} पर है। कृपया अब क्लिनिक आ जाएं।`,
    },
  };

  const msg = (messages[lang] && messages[lang][window.label]) ||
              (messages.en && messages.en[window.label]) ||
              `Reminder: Your appointment with Dr. ${appointment.doctor_name} is at ${timeStr}.`;

  // Send via WhatsApp/SMS
  const channels = require("../patient-coordinator/channels.cjs");
  const channel = appointment.patient_phone ? "whatsapp" : "chat";

  await channels[channel](brandId, appointment.patient_id, {
    to: appointment.patient_phone,
    body: msg,
  });

  // Mark reminder sent
  if (!ALLOWED_REMINDER_FIELDS.has(window.field)) {
    throw new Error(`Invalid reminder field: ${window.field}`);
  }
  await db.query(
    `update fmlh_appointments set ${window.field} = true where brand_id=$1 and id=$2`,
    [brandId, appointment.id]
  );

  // Log in journey
  await db.one(
    `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
     values ($1,$2,$3,'reminder_sent',$4,'whatsapp','chronos') returning id`,
    [brandId, appointment.patient_id, appointment.id, `${window.label} reminder sent`]
  );

  log.info(`Sent ${window.label} reminder for appointment #${appointment.id}`);
}

/**
 * Send a no-show follow-up call/message.
 */
async function handleNoShow(brandId, appointmentId) {
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

  // Update status
  await db.query(
    `update fmlh_appointments set status='no_show' where brand_id=$1 and id=$2`,
    [brandId, appointmentId]
  );

  // Send follow-up message
  const lang = appt.patient_lang || "en";
  const msg = lang === "hi"
    ? `नमस्ते ${appt.patient_name}! आज डॉ. ${appt.doctor_name} के साथ आपकी अपॉइंटमेंट थी। क्या आप इसे फिर से बुक करना चाहेंगे?`
    : `Hello ${appt.patient_name}! You had an appointment with Dr. ${appt.doctor_name} today. Would you like to rebook?`;

  const channels = require("../patient-coordinator/channels.cjs");
  await channels.whatsapp(brandId, appt.patient_id, { to: appt.patient_phone, body: msg });

  // Log journey
  await db.one(
    `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
     values ($1,$2,$3,'no_show','follow_up_sent','whatsapp','chronos') returning id`,
    [brandId, appt.patient_id, appointmentId]
  );

  // Publish event for other agents
  await bus.publish({
    brandId,
    from: "chronos",
    to: "broadcast",
    topic: "appointment.no_show",
    payload: { appointmentId, patientId: appt.patient_id },
  });

  return { appointmentId, status: "no_show_follow_up_sent" };
}

/**
 * Mark appointment as confirmed.
 */
async function confirmAppointment(brandId, appointmentId) {
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

  await db.query(
    `update fmlh_appointments set status='confirmed' where brand_id=$1 and id=$2`,
    [brandId, appointmentId]
  );

  // Send confirmation
  const lang = appt.patient_lang || "en";
  const i18n = require("../patient-coordinator/i18n.cjs");
  const apptDate = new Date(appt.scheduled_at);
  const dateStr = apptDate.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });
  const timeStr = apptDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const msg = i18n.patientMessage("appointment_confirmed", lang, {
    doctor: appt.doctor_name,
    date: dateStr,
    time: timeStr,
  });

  const channels = require("../patient-coordinator/channels.cjs");
  await channels.whatsapp(brandId, appt.patient_id, { to: appt.patient_phone, body: msg });

  return { appointmentId, status: "confirmed" };
}

/**
 * Cancel an appointment.
 */
async function cancelAppointment(brandId, appointmentId, reason = "patient_request") {
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

  await db.query(
    `update fmlh_appointments set status='cancelled', meta = meta || $3 where brand_id=$1 and id=$2`,
    [brandId, appointmentId, JSON.stringify({ cancel_reason: reason, cancelled_at: new Date().toISOString() })]
  );

  // Send cancellation message
  const lang = appt.patient_lang || "en";
  const msg = lang === "hi"
    ? `आपकी डॉ. ${appt.doctor_name} के साथ अपॉइंटमेंट रद्द कर दी गई है। क्या आप एक नई अपॉइंटमेंट बुक करना चाहेंगे?`
    : `Your appointment with Dr. ${appt.doctor_name} has been cancelled. Would you like to book a new one?`;

  const channels = require("../patient-coordinator/channels.cjs");
  await channels.whatsapp(brandId, appt.patient_id, { to: appt.patient_phone, body: msg });

  // Delete calendar event if exists
  const calendar = require("./calendar.cjs");
  if (appt.meta?.calendar_event_id) {
    await calendar.deleteCalendarEvent(appt.meta.calendar_event_id);
  }

  // Log journey
  await db.one(
    `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
     values ($1,$2,$3,'appointment_cancelled',$4,'whatsapp','chronos') returning id`,
    [brandId, appt.patient_id, appointmentId, reason]
  );

  return { appointmentId, status: "cancelled" };
}

module.exports = { processReminders, sendReminder, handleNoShow, confirmAppointment, cancelAppointment };
