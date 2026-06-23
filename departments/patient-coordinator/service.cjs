"use strict";
// Patient Coordinator orchestration — intake, route, FAQ, triage.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const { PatientCoordAgent } = require("./agent.cjs");
const channels = require("./channels.cjs");

const agent = new PatientCoordAgent();

// Upsert a patient from incoming message (WhatsApp/SMS/web).
async function intakePatient(brandId, { phone, name, email, language, source }) {
  // Check existing patient by phone
  const existing = await db.oneOrNone(
    `select * from fmlh_patients where brand_id=$1 and phone=$2`,
    [brandId, phone]
  );
  if (existing) {
    // Update language if provided
    if (language && language !== existing.language) {
      await db.query(
        `update fmlh_patients set language=$3, updated_at=now() where brand_id=$1 and id=$2`,
        [brandId, existing.id, language]
      );
    }
    return existing;
  }

  // Generate unique referral code
  const referralCode = `FML${Date.now().toString(36).toUpperCase()}`;

  const patient = await db.one(
    `insert into fmlh_patients (brand_id, full_name, phone, email, language, referral_code, status, meta)
     values ($1,$2,$3,$4,$5,$6,'active',$7) returning *`,
    [brandId, name || "Unknown", phone, email || null,
     language || "en", referralCode, JSON.stringify({ source: source || "whatsapp" })]
  );

  // Log journey
  await logJourney(brandId, patient.id, null, "new", "patient_intaked", channels.bestChannel(patient));
  return patient;
}

// Handle an incoming message from a patient.
async function handleMessage(brandId, patientId, messageText) {
  return agent.run(brandId, "handle-message", async () => {
    const patient = await db.one(
      `select * from fmlh_patients where brand_id=$1 and id=$2`,
      [brandId, patientId]
    );
    if (!patient) throw new Error("patient not found");

    // Detect language from message
    const detectedLang = require("./i18n.cjs").detectLanguage(messageText);
    if (detectedLang !== patient.language) {
      await db.query(
        `update fmlh_patients set language=$3, updated_at=now() where brand_id=$1 and id=$2`,
        [brandId, patientId, detectedLang]
      );
      patient.language = detectedLang;
    }

    // Log inbound message
    await db.one(
      `insert into fmlh_messages (brand_id, patient_id, channel, direction, to_addr, body, status, provider)
       values ($1,$2,'whatsapp','in',$3,$4,'delivered','baileys') returning id`,
      [brandId, patientId, patient.phone, messageText]
    );

    // Intent classification
    const intent = await classifyIntent(messageText);

    let response;
    switch (intent.type) {
      case "book_appointment":
        response = await handleBookingRequest(brandId, patient, intent);
        break;
      case "faq":
        response = await handleFAQRequest(brandId, patient, messageText);
        break;
      case "symptoms":
        response = await handleSymptomReport(brandId, patient, messageText);
        break;
      case "reschedule":
        response = await handleReschedule(brandId, patient, messageText);
        break;
      case "cancel":
        response = await handleCancel(brandId, patient);
        break;
      default:
        response = await handleGeneral(brandId, patient, messageText);
    }

    // Send response
    const channel = channels.bestChannel(patient);
    await channels[channel](brandId, patientId, {
      to: patient.phone,
      body: response.message,
    });

    return { patientId, intent: intent.type, response: response.message };
  });
}

// Classify patient intent from message text.
async function classifyIntent(text) {
  return agent.thinkJSON(
    `Classify this patient message into an intent.
Message: "${text}"

Return JSON: {
  "type": "book_appointment|faq|symptoms|reschedule|cancel|complaint|emergency|general",
  "confidence": "low|med|high",
  "key_entities": {}
}`,
    { fast: true, temperature: 0.2 }
  );
}

// Handle appointment booking request.
async function handleBookingRequest(brandId, patient, intent) {
  // Get available doctors
  const doctors = await db.many(
    `select * from fmlh_doctors where brand_id=$1 and status='active'`,
    [brandId]
  );
  if (doctors.length === 0) {
    return { message: "Sorry, no doctors available right now. Please try again later." };
  }

  // Route to best doctor
  const route = await agent.routeToDoctor(patient, intent.key_entities, doctors);
  const doctor = doctors.find(d => d.id === route.doctor_id) || doctors[0];

  // Get available slots for next 3 days
  const slots = await getAvailableSlots(brandId, doctor.id, 3);

  if (slots.length === 0) {
    return { message: `Sorry, ${doctor.full_name} has no available slots in the next 3 days. Would you like to check another doctor?` };
  }

  const lang = patient.language || "en";
  const i18n = require("./i18n.cjs");
  const slotMsg = i18n.patientMessage("slot_available", lang, {
    doctor: doctor.full_name,
    date: "next 3 days",
    slots: slots.slice(0, 5).map(s => s.time).join(", "),
  });

  return {
    message: `Great! Dr. ${doctor.full_name} (${doctor.specialty}) has these slots available:\n\n${slots.slice(0, 5).map((s, i) => `${i + 1}. ${s.display}`).join("\n")}\n\nReply with the slot number to book.`,
    doctorId: doctor.id,
    slots: slots.slice(0, 5),
  };
}

// Handle FAQ request.
async function handleFAQRequest(brandId, patient, question) {
  // Fetch clinic info from memory or defaults
  const clinicInfo = await db.oneOrNone(
    `select value from ait_agent_memory where brand_id=$1 and namespace='clinic' and mem_key='info'`,
    [brandId]
  );
  const info = clinicInfo?.value || {
    name: "Our Clinic",
    timings: "Mon-Sat 9AM-6PM",
    fees: "₹500 consultation",
    location: "Check with reception",
  };

  const result = await agent.handleFAQ(patient, question, info);
  return { message: result.answer };
}

// Handle symptom report.
async function handleSymptomReport(brandId, patient, messageText) {
  const result = await agent.collectSymptoms(patient, messageText);

  if (result.needs_immediate_care) {
    await logJourney(brandId, patient.id, null, "new", "emergency_detected", "whatsapp");
    return {
      message: "⚠️ Based on your symptoms, we recommend you visit the emergency department immediately or call 108 (Ambulance). If this is not urgent, please describe your symptoms in more detail and I'll help you book an appointment.",
    };
  }

  // Route to doctor
  const doctors = await db.many(
    `select * from fmlh_doctors where brand_id=$1 and status='active' and specialty=$2`,
    [brandId, result.suggested_specialty]
  );
  const fallbackDoctors = doctors.length > 0 ? doctors : await db.many(
    `select * from fmlh_doctors where brand_id=$1 and status='active'`,
    [brandId]
  );

  if (fallbackDoctors.length === 0) {
    return { message: "I understand your concern. Let me connect you with our team. Please share your preferred time for a call back." };
  }

  const route = await agent.routeToDoctor(patient, result.symptoms, fallbackDoctors);
  const doctor = fallbackDoctors.find(d => d.id === route.doctor_id) || fallbackDoctors[0];

  return {
    message: `I understand you're experiencing: ${result.symptoms.join(", ")}.\n\nI recommend visiting Dr. ${doctor.full_name} (${doctor.specialty}). Would you like me to book an appointment? Reply YES to continue.`,
    doctorId: doctor.id,
    urgency: result.urgency,
  };
}

// Get available slots for a doctor.
async function getAvailableSlots(brandId, doctorId, daysAhead = 3) {
  const doctor = await db.one(
    `select * from fmlh_doctors where brand_id=$1 and id=$2`,
    [brandId, doctorId]
  );
  if (!doctor) return [];

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

    for (const slot of daySlots) {
      // Generate individual time slots
      const [startH, startM] = slot.start.split(":").map(Number);
      const [endH, endM] = slot.end.split(":").map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      for (let m = startMin; m < endMin; m += doctor.slot_duration_min + doctor.buffer_min) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const slotDate = new Date(date);
        slotDate.setHours(h, min, 0, 0);

        // Skip past slots
        if (slotDate <= now) continue;

        // Check if slot is already booked (in-memory check, no DB query)
        if (!bookedSet.has(slotDate.toISOString())) {
          const displayDate = slotDate.toLocaleDateString("en-IN", {
            weekday: "short", month: "short", day: "numeric",
          });
          slots.push({
            date: slotDate.toISOString().split("T")[0],
            time: timeStr,
            display: `${displayDate} at ${timeStr}`,
            datetime: slotDate.toISOString(),
          });
        }
      }
    }
  }
  return slots;
}

// Book an appointment.
async function bookAppointment(brandId, patientId, doctorId, slotDatetime, type = "consultation") {
  return agent.run(brandId, "book-appointment", async () => {
    const patient = await db.one(`select * from fmlh_patients where brand_id=$1 and id=$2`, [brandId, patientId]);
    if (!patient) throw new Error("patient not found");
    const doctor = await db.one(`select * from fmlh_doctors where brand_id=$1 and id=$2`, [brandId, doctorId]);
    if (!doctor) throw new Error("doctor not found");

    const appointment = await db.one(
      `insert into fmlh_appointments (brand_id, patient_id, doctor_id, scheduled_at, duration_min, type, status, channel, notes)
       values ($1,$2,$3,$4,$5,$6,'booked','whatsapp',$7) returning *`,
      [brandId, patientId, doctorId, slotDatetime, doctor.slot_duration_min, type,
       `Auto-booked via WhatsApp for ${patient.full_name}`]
    );

    // Generate confirmation message
    const confirmMsg = await agent.confirmMessage(appointment, doctor, patient);

    // Send confirmation
    const channel = channels.bestChannel(patient);
    await channels[channel](brandId, patientId, {
      to: patient.phone,
      body: confirmMsg,
    });

    // Log journey
    await logJourney(brandId, patientId, appointment.id, "appointment_booked", "appointment_confirmed", "whatsapp");

    // Publish event for other agents
    await bus.publish({
      brandId,
      from: "aria",
      to: "broadcast",
      topic: "appointment.booked",
      payload: { appointmentId: appointment.id, patientId, doctorId, scheduledAt: slotDatetime },
    });

    return { appointmentId: appointment.id, confirmation: confirmMsg };
  });
}

// Handle reschedule request.
async function handleReschedule(brandId, patient, messageText) {
  const lastAppt = await db.oneOrNone(
    `select * from fmlh_appointments
     where brand_id=$1 and patient_id=$2 and status in ('booked','confirmed')
     order by scheduled_at desc limit 1`,
    [brandId, patient.id]
  );
  if (!lastAppt) {
    return { message: "You don't have any upcoming appointments to reschedule. Would you like to book a new one?" };
  }
  return {
    message: `I see your appointment on ${new Date(lastAppt.scheduled_at).toLocaleDateString("en-IN")}. Let me check available slots for rescheduling. Which day works best for you?`,
    rescheduleAppointmentId: lastAppt.id,
  };
}

// Handle cancellation.
async function handleCancel(brandId, patient) {
  const lastAppt = await db.oneOrNone(
    `select * from fmlh_appointments
     where brand_id=$1 and patient_id=$2 and status in ('booked','confirmed')
     order by scheduled_at desc limit 1`,
    [brandId, patient.id]
  );
  if (!lastAppt) {
    return { message: "You don't have any upcoming appointments to cancel." };
  }
  await db.query(
    `update fmlh_appointments set status='cancelled' where brand_id=$1 and id=$2`,
    [brandId, lastAppt.id]
  );
  await logJourney(brandId, patient.id, lastAppt.id, "appointment_cancelled", "patient_cancelled", "whatsapp");
  return { message: "Your appointment has been cancelled. Would you like to book a new one?" };
}

// Handle general messages.
async function handleGeneral(brandId, patient, messageText) {
  const out = await agent.think(
    `A patient sent this message: "${messageText}". Respond helpfully and ask how you can assist them.`,
    { temperature: 0.5, maxTokens: 200 }
  );
  return { message: out };
}

// Log a patient journey event.
async function logJourney(brandId, patientId, appointmentId, stage, action, channel, actor = "aria") {
  return db.one(
    `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [brandId, patientId, appointmentId, stage, action, channel, actor]
  );
}

// List patients for a brand.
function listPatients(brandId, { limit = 50, offset = 0 } = {}) {
  return db.many(
    `select * from fmlh_patients where brand_id=$1 order by created_at desc limit $2 offset $3`,
    [brandId, Math.min(limit, 500), offset]
  );
}

// Get patient by ID.
function getPatient(brandId, patientId) {
  return db.one(`select * from fmlh_patients where brand_id=$1 and id=$2`, [brandId, patientId]);
}

// Get patient journey.
function getJourney(brandId, patientId) {
  return db.many(
    `select * from fmlh_patient_journey where brand_id=$1 and patient_id=$2 order by created_at desc`,
    [brandId, patientId]
  );
}

module.exports = {
  intakePatient, handleMessage, bookAppointment, getAvailableSlots,
  listPatients, getPatient, getJourney, logJourney,
};
