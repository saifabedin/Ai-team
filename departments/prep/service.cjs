"use strict";
// Pre-appointment Prep orchestration — generate + send prep instructions.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const { PrepAgent } = require("./agent.cjs");

const agent = new PrepAgent();

// Generate prep workflow for an appointment.
async function generatePrep(brandId, appointmentId) {
  return agent.run(brandId, "generate-prep", async () => {
    const appt = await db.one(
      `select a.*, p.full_name as patient_name, p.language as patient_lang,
              p.medical_history, p.allergies, p.dob as patient_dob, p.gender as patient_gender,
              d.full_name as doctor_name, d.specialty as doctor_specialty
       from fmlh_appointments a
       join fmlh_patients p on p.id = a.patient_id
       join fmlh_doctors d on d.id = a.doctor_id
       where a.brand_id=$1 and a.id=$2`,
      [brandId, appointmentId]
    );
    if (!appt) throw new Error("appointment not found");

    const patient = {
      full_name: appt.patient_name,
      dob: appt.patient_dob,
      gender: appt.patient_gender,
      language: appt.patient_lang,
      medical_history: appt.medical_history,
      allergies: appt.allergies,
    };
    const doctor = { full_name: appt.doctor_name, specialty: appt.doctor_specialty };
    const appointment = { type: appt.type };

    // Generate steps
    const result = await agent.generateSteps(patient, appointment, doctor, {});

    // Create prep workflow
    const steps = (result.steps || []).map(s => ({
      ...s,
      sent: false,
      acknowledged: false,
      sent_at: null,
    }));

    const workflow = await db.one(
      `insert into fmlh_prep_workflows (brand_id, appointment_id, patient_id, steps, current_step, status, language)
       values ($1,$2,$3,$4,0,'active',$5) returning *`,
      [brandId, appointmentId, appt.patient_id, JSON.stringify(steps), appt.patient_lang || "en"]
    );

    return { workflowId: workflow.id, steps: steps.length, prep: result };
  });
}

// Send prep instructions to patient (step by step or all at once).
async function sendPrep(brandId, workflowId, { stepIndex, sendAll = false } = {}) {
  return agent.run(brandId, "send-prep", async () => {
    const workflow = await db.one(
      `select w.*, p.full_name as patient_name, p.phone as patient_phone, p.language as patient_lang
       from fmlh_prep_workflows w
       join fmlh_patients p on p.id = w.patient_id
       where w.brand_id=$1 and w.id=$2`,
      [brandId, workflowId]
    );
    if (!workflow) throw new Error("workflow not found");

    const steps = workflow.steps || [];
    const lang = workflow.patient_lang || "en";
    const i18n = require("../patient-coordinator/i18n.cjs");
    const channels = require("../patient-coordinator/channels.cjs");

    const stepsToSend = sendAll ? steps : (stepIndex !== undefined ? [steps[stepIndex]] : []);
    const sentSteps = [];

    for (const step of stepsToSend) {
      if (step.sent) continue;

      const msg = i18n.patientMessage("prep_instructions", lang, {
        date: "your appointment",
        instructions: `${step.step}. ${step.instruction}`,
      });

      await channels.whatsapp(brandId, workflow.patient_id, {
        to: workflow.patient_phone,
        body: msg,
      });

      step.sent = true;
      step.sent_at = new Date().toISOString();
      sentSteps.push(step.step);
    }

    // Update workflow
    const newStep = sendAll ? steps.length : (stepIndex !== undefined ? stepIndex + 1 : workflow.current_step);
    const newStatus = sendAll || newStep >= steps.length ? "completed" : "active";

    await db.query(
      `update fmlh_prep_workflows set steps=$3, current_step=$4, status=$5 where brand_id=$1 and id=$2`,
      [brandId, workflowId, JSON.stringify(steps), newStep, newStatus]
    );

    // Update appointment prep_status
    await db.query(
      `update fmlh_appointments set pre_prep_status=$3 where brand_id=$1 and id=$2`,
      [brandId, workflow.appointment_id, newStatus === "completed" ? "sent" : "pending"]
    );

    // Log journey
    await db.one(
      `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
       values ($1,$2,$3,'prep_sent',$4,'whatsapp','prepper') returning id`,
      [brandId, workflow.patient_id, workflow.appointment_id, `Steps sent: ${sentSteps.join(",")}`]
    );

    return { workflowId, sentSteps, status: newStatus };
  });
}

// Get prep workflow for an appointment.
async function getPrep(brandId, appointmentId) {
  return db.oneOrNone(
    `select * from fmlh_prep_workflows where brand_id=$1 and appointment_id=$2`,
    [brandId, appointmentId]
  );
}

// List prep workflows.
async function listPreps(brandId, { status, limit = 50, offset = 0 } = {}) {
  let query = `select w.*, p.full_name as patient_name, a.scheduled_at as appointment_date
               from fmlh_prep_workflows w
               join fmlh_patients p on p.id = w.patient_id
               join fmlh_appointments a on a.id = w.appointment_id
               where w.brand_id=$1`;
  const params = [brandId];
  let idx = 2;

  if (status) {
    query += ` and w.status = $${idx++}`;
    params.push(status);
  }

  query += ` order by w.created_at desc limit $${idx++} offset $${idx++}`;
  params.push(Math.min(limit, 500), offset);

  return db.many(query, params);
}

// Auto-generate and send prep for all upcoming appointments in next 24h.
async function autoPrep(brandId) {
  const tomorrow = new Date(Date.now() + 24 * 3600000).toISOString();

  const appointments = await db.many(
    `select a.id from fmlh_appointments a
     left join fmlh_prep_workflows w on w.appointment_id = a.id
     where a.brand_id=$1 and a.scheduled_at <= $2
     and a.status in ('booked','confirmed')
     and w.id is null`,
    [brandId, tomorrow]
  );

  const results = [];
  for (const appt of appointments) {
    try {
      const workflow = await generatePrep(brandId, appt.id);
      await sendPrep(brandId, workflow.workflowId, { sendAll: true });
      results.push({ appointmentId: appt.id, status: "sent" });
    } catch (e) {
      results.push({ appointmentId: appt.id, status: "failed", error: e.message });
    }
  }
  return results;
}

module.exports = { generatePrep, sendPrep, getPrep, listPreps, autoPrep };
