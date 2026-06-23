"use strict";
// Aftercare scheduling engine — follow-up checks, compliance tracking.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const log = require("../../core/logger.cjs").make("fmlh:aftercare:schedule");
const { AftercareAgent } = require("./agent.cjs");

// Module-level singleton agent instance (avoids creating new instances per call)
const aftercareAgent = new AftercareAgent();

/**
 * Follow-up schedule: day 1, day 3, day 7, day 14 (configurable).
 */
const FOLLOW_UP_DAYS = [1, 3, 7, 14];

/**
 * Process due follow-up checks for all patients.
 * Called by autopilot/cron.
 */
async function processFollowUps(brandId) {
  const now = new Date();
  const results = [];

  // Find appointments completed in the last 14 days
  const recentAppts = await db.many(
    `select a.*, p.full_name as patient_name, p.phone as patient_phone,
            p.language as patient_lang, d.full_name as doctor_name,
            ac.id as aftercare_id, ac.instructions, ac.compliance
     from fmlh_appointments a
     join fmlh_patients p on p.id = a.patient_id
     join fmlh_doctors d on d.id = a.doctor_id
     left join fmlh_aftercare ac on ac.appointment_id = a.id
     where a.brand_id=$1
     and a.status = 'completed'
     and a.scheduled_at >= now() - interval '14 days'
     and a.scheduled_at <= now()`,
    [brandId]
  );

  for (const appt of recentAppts) {
    const daysSince = Math.floor((now - new Date(appt.scheduled_at)) / 86400000);

    // Check which follow-up day we're on
    const followUpDay = FOLLOW_UP_DAYS.find(d => d === daysSince);
    if (!followUpDay) continue;

    // Check if already sent
    const alreadySent = await db.oneOrNone(
      `select id from fmlh_patient_journey
       where brand_id=$1 and patient_id=$2 and appointment_id=$3
       and action=$4`,
      [brandId, appt.patient_id, appt.id, `follow_up_day${followUpDay}`]
    );
    if (alreadySent) continue;

    try {
      await sendFollowUp(brandId, appt, followUpDay);
      results.push({ appointmentId: appt.id, day: followUpDay, status: "sent" });
    } catch (e) {
      log.error(`Follow-up failed for appointment #${appt.id}: ${e.message}`);
      results.push({ appointmentId: appt.id, day: followUpDay, status: "failed", error: e.message });
    }
  }

  return results;
}

/**
 * Send a follow-up check-in message.
 */
async function sendFollowUp(brandId, appointment, dayNumber) {
  const lang = appointment.patient_lang || "en";
  const i18n = require("../patient-coordinator/i18n.cjs");

  const messages = {
    en: {
      1: `Hi ${appointment.patient_name}! How are you feeling today after your visit to Dr. ${appointment.doctor_name}? Please let us know if you have any concerns.`,
      3: `Hello ${appointment.patient_name}, this is a check-in from ${dayNumber} days after your appointment. Are you following the care instructions? Any issues?`,
      7: `Hi ${appointment.patient_name}, it's been a week since your visit. How is your recovery going? Do you need a follow-up appointment?`,
      14: `Hello ${appointment.patient_name}, two weeks post-visit check-in. Hope you're doing well! Any remaining concerns?`,
    },
    hi: {
      1: `नमस्ते ${appointment.patient_name}! डॉ. ${appointment.doctor_name} के पास जाने के बाद आज आप कैसा महसूस कर रहे हैं? कोई चिंता हो तो बताएं।`,
      3: `नमस्ते ${appointment.patient_name}, आपकी अपॉइंटमेंट के ${dayNumber} दिन बाद यह चेक-इन है। क्या आप देखभाल के निर्देशों का पालन कर रहे हैं?`,
      7: `नमस्ते ${appointment.patient_name}, आपकी विज़िट के एक हफ्ते हो गए। आपकी रिकवरी कैसी है? क्या आपको फॉलो-अप अपॉइंटमेंट चाहिए?`,
      14: `नमस्ते ${appointment.patient_name}, दो हफ्ते बाद चेक-इन। उम्मीद है आप ठीक हैं! कोई बची हुई चिंता?`,
    },
  };

  const msg = (messages[lang] && messages[lang][dayNumber]) ||
              (messages.en && messages.en[dayNumber]) ||
              `Hello ${appointment.patient_name}, this is a ${dayNumber}-day follow-up check. How are you feeling?`;

  // Send via WhatsApp
  const channels = require("../patient-coordinator/channels.cjs");
  await channels.whatsapp(brandId, appointment.patient_id, {
    to: appointment.patient_phone,
    body: msg,
  });

  // Log journey
  await db.one(
    `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
     values ($1,$2,$3,'follow_up_sent',$4,'whatsapp','healer') returning id`,
    [brandId, appointment.patient_id, appointment.id, `follow_up_day${dayNumber}`]
  );
}

/**
 * Handle patient response to follow-up.
 */
async function handleFollowUpResponse(brandId, appointmentId, responseText) {
  const appt = await db.one(
    `select a.*, p.full_name as patient_name, p.language as patient_lang,
            d.full_name as doctor_name, d.specialty as doctor_specialty,
            ac.id as aftercare_id, ac.instructions, ac.compliance
     from fmlh_appointments a
     join fmlh_patients p on p.id = a.patient_id
     join fmlh_doctors d on d.id = a.doctor_id
     left join fmlh_aftercare ac on ac.appointment_id = a.id
     where a.brand_id=$1 and a.id=$2`,
    [brandId, appointmentId]
  );
  if (!appt) throw new Error("appointment not found");

  // Use agent to assess compliance
  const assessment = await aftercareAgent.assessCompliance(responseText, appt);

  // Update compliance status
  if (appt.aftercare_id) {
    await db.query(
      `update fmlh_aftercare set compliance=$3 where brand_id=$1 and id=$2`,
      [brandId, appt.aftercare_id, assessment.compliance]
    );
  }

  // Send appropriate response
  const lang = appt.patient_lang || "en";
  const channels = require("../patient-coordinator/channels.cjs");
  await channels.whatsapp(brandId, appt.patient_id, {
    to: appt.patient_phone,
    body: assessment.message_to_patient,
  });

  // Escalate if needed
  if (assessment.escalate) {
    const escalation = await aftercareAgent.escalateToDoctor(
      { full_name: appt.patient_name, phone: appt.patient_phone },
      assessment.concerns.join(", "),
      assessment.compliance
    );

    // Publish escalation event
    await bus.publish({
      brandId,
      from: "healer",
      to: "broadcast",
      topic: "patient.escalation",
      payload: {
        appointmentId,
        patientId: appt.patient_id,
        doctorName: appt.doctor_name,
        summary: escalation.summary,
        urgency: escalation.urgency,
      },
    });
  }

  // Log journey
  await db.one(
    `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor, meta)
     values ($1,$2,$3,'follow_up_response',$4,'whatsapp','healer',$5) returning id`,
    [brandId, appt.patient_id, appointmentId, assessment.compliance,
     JSON.stringify({ response: responseText, assessment })]
  );

  return { compliance: assessment.compliance, needsFollowUp: assessment.needs_follow_up };
}

/**
 * Generate and store aftercare for an appointment.
 */
async function generateAftercare(brandId, appointmentId, doctorNotes) {
  const appt = await db.one(
    `select a.*, p.full_name as patient_name, p.language as patient_lang,
            p.dob as patient_dob, p.gender as patient_gender,
            p.allergies, p.medical_history,
            d.full_name as doctor_name, d.specialty as doctor_specialty
     from fmlh_appointments a
     join fmlh_patients p on p.id = a.patient_id
     join fmlh_doctors d on d.id = a.doctor_id
     where a.brand_id=$1 and a.id=$2`,
    [brandId, appointmentId]
  );
  if (!appt) throw new Error("appointment not found");

  const agent = require("./agent.cjs");
  const aftercareAgent = new agent.AftercareAgent();

  const result = await aftercareAgent.generateAftercare(
    {
      full_name: appt.patient_name,
      dob: appt.patient_dob,
      gender: appt.patient_gender,
      language: appt.patient_lang,
      allergies: appt.allergies,
      medical_history: appt.medical_history,
    },
    { doctor_name: appt.doctor_name, specialty: appt.doctor_specialty, type: appt.type },
    doctorNotes
  );

  // Store aftercare
  const followUpDate = new Date(Date.now() + (result.follow_up_days || 7) * 86400000);
  const aftercare = await db.one(
    `insert into fmlh_aftercare (brand_id, appointment_id, patient_id, doctor_id,
       instructions, follow_up_date, medication, diet_notes, warning_signs, compliance, language)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10) returning *`,
    [brandId, appointmentId, appt.patient_id, appt.doctor_id || null,
     JSON.stringify(result.instructions || []),
     followUpDate.toISOString(),
     JSON.stringify(result.medication || []),
     result.diet_notes || null,
     JSON.stringify(result.warning_signs || []),
     appt.patient_lang || "en"]
  );

  // Update appointment
  await db.query(
    `update fmlh_appointments set post_care_status='sent' where brand_id=$1 and id=$2`,
    [brandId, appointmentId]
  );

  // Send aftercare message to patient
  const lang = appt.patient_lang || "en";
  const i18n = require("../patient-coordinator/i18n.cjs");
  const safeInstructions = result.instructions || [];
  const msg = i18n.patientMessage("aftercare", lang, {
    instructions: safeInstructions.map(i => `• ${i.detail}`).join("\n"),
    follow_up: followUpDate.toLocaleDateString("en-IN"),
    warning: (result.warning_signs || []).join(", ") || "any unusual symptoms",
  });

  const channels = require("../patient-coordinator/channels.cjs");
  await channels.whatsapp(brandId, appt.patient_id, { to: appt.patient_phone, body: msg });

  // Log journey
  await db.one(
    `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
     values ($1,$2,$3,'post_care','aftercare_sent','whatsapp','healer') returning id`,
    [brandId, appt.patient_id, appointmentId]
  );

  return { aftercareId: aftercare.id, instructions: safeInstructions.length, followUpDate };
}

module.exports = { processFollowUps, sendFollowUp, handleFollowUpResponse, generateAftercare, FOLLOW_UP_DAYS };
