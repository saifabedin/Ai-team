"use strict";
// Aftercare orchestration — generate care plans, track compliance, follow-ups.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const schedule = require("./schedule.cjs");

// Generate aftercare for a completed appointment.
async function generate(brandId, appointmentId, doctorNotes) {
  return schedule.generateAftercare(brandId, appointmentId, doctorNotes);
}

// Handle patient reply to follow-up.
async function handleReply(brandId, appointmentId, responseText) {
  return schedule.handleFollowUpResponse(brandId, appointmentId, responseText);
}

// Get aftercare for an appointment.
async function getAftercare(brandId, appointmentId) {
  return db.oneOrNone(
    `select a.*, p.full_name as patient_name, d.full_name as doctor_name
     from fmlh_aftercare a
     join fmlh_patients p on p.id = a.patient_id
     left join fmlh_doctors d on d.id = a.doctor_id
     where a.brand_id=$1 and a.appointment_id=$2`,
    [brandId, appointmentId]
  );
}

// Get aftercare for a patient.
async function getPatientAftercare(brandId, patientId) {
  return db.many(
    `select a.*, p.full_name as patient_name, d.full_name as doctor_name,
            ap.scheduled_at as appointment_date
     from fmlh_aftercare a
     join fmlh_patients p on p.id = a.patient_id
     left join fmlh_doctors d on d.id = a.doctor_id
     join fmlh_appointments ap on ap.id = a.appointment_id
     where a.brand_id=$1 and a.patient_id=$2
     order by a.created_at desc`,
    [brandId, patientId]
  );
}

// List all aftercare records.
async function listAftercare(brandId, { compliance, limit = 50, offset = 0 } = {}) {
  let query = `select a.*, p.full_name as patient_name, d.full_name as doctor_name
               from fmlh_aftercare a
               join fmlh_patients p on p.id = a.patient_id
               left join fmlh_doctors d on d.id = a.doctor_id
               where a.brand_id=$1`;
  const params = [brandId];
  let idx = 2;

  if (compliance) {
    query += ` and a.compliance = $${idx++}`;
    params.push(compliance);
  }

  query += ` order by a.created_at desc limit $${idx++} offset $${idx++}`;
  params.push(Math.min(limit, 500), offset);

  return db.many(query, params);
}

// Process all due follow-ups.
async function processFollowUps(brandId) {
  return schedule.processFollowUps(brandId);
}

// Get aftercare stats.
async function getStats(brandId) {
  const stats = await db.one(
    `select
       count(*) as total,
       count(*) filter (where compliance='compliant') as compliant,
       count(*) filter (where compliance='partial') as partial,
       count(*) filter (where compliance='non_compliant') as non_compliant,
       count(*) filter (where compliance='pending') as pending
     from fmlh_aftercare where brand_id=$1`,
    [brandId]
  );
  return {
    total: +stats.total,
    compliant: +stats.compliant,
    partial: +stats.partial,
    non_compliant: +stats.non_compliant,
    pending: +stats.pending,
    compliance_rate: stats.total > 0
      ? (+stats.compliant / +stats.total * 100).toFixed(1) + "%"
      : "0%",
  };
}

module.exports = {
  generate, handleReply, getAftercare, getPatientAftercare,
  listAftercare, processFollowUps, getStats,
};
