"use strict";
// PatientCoordAgent — multi-channel patient intake, symptom collection, FAQ.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize, sanitizeStr } = require("../../core/sanitize.cjs");
const { detectLanguage, patientMessage } = require("./i18n.cjs");

class PatientCoordAgent extends BaseAgent {
  constructor() {
    super("aria", "coordinator", {
      systemPrompt: `You are 'aria', an AI patient coordinator for a healthcare clinic. You help patients:
- Book appointments with the right doctor
- Answer FAQs (timings, fees, location, insurance)
- Collect symptoms to route to the right specialist
- Send pre-appointment preparation instructions
- Send aftercare follow-up messages

You are warm, professional, and concise. You communicate in the patient's preferred language.
Always be helpful and never give medical diagnosis — only route to the doctor.
Indian healthcare context: patients may call doctors "sir/ma'am", use Hindi/English mix.`,
    });
  }

  // Generate a greeting message for a new patient.
  async greet(patient, clinicName) {
    const lang = patient.language || "en";
    const msg = patientMessage("greeting", lang, {
      name: patient.full_name,
      clinic: clinicName || "our clinic",
    });
    return { message: msg, language: lang };
  }

  // Collect symptoms from patient conversation and route to specialist.
  async collectSymptoms(patient, conversationHistory) {
    const lang = patient.language || "en";
    const out = await this.thinkJSON(
      `Based on this patient conversation, extract symptoms and suggest a medical specialty.
Patient: ${sanitize({ name: patient.full_name, age: patient.dob, gender: patient.gender })}
Conversation: ${conversationHistory}

Return JSON: {
  "symptoms": ["symptom1", "symptom2"],
  "urgency": "low|medium|high|emergency",
  "suggested_specialty": "cardiologist|dermatologist|general|orthopedic|pediatrician|gynecologist|ent|ophthalmologist|dentist|other",
  "summary": "1-line summary of patient concern",
  "needs_immediate_care": true|false,
  "language": "${lang}"
}`,
      { temperature: 0.3 }
    );
    return out;
  }

  // Route patient to appropriate doctor based on symptoms.
  async routeToDoctor(patient, symptoms, doctors) {
    const out = await this.thinkJSON(
      `Match this patient to the best doctor from the available list.
Patient: ${sanitize({ name: patient.full_name, symptoms })}
Available doctors: ${JSON.stringify(doctors.map(d => ({
      id: d.id, name: d.full_name, specialty: d.specialty, fee: d.consultation_fee,
    })))}

Return JSON: {
  "doctor_id": <id>,
  "reason": "why this doctor",
  "alternative_id": <id or null>,
  "confidence": "low|med|high"
}`,
      { temperature: 0.3 }
    );
    return out;
  }

  // Handle FAQ questions.
  async handleFAQ(patient, question, clinicInfo) {
    const lang = patient.language || "en";
    const out = await this.thinkJSON(
      `Patient FAQ. Answer based on clinic info provided.
Clinic info: ${JSON.stringify(clinicInfo)}
Question: "${sanitizeStr(question)}"
Language: ${lang}

Return JSON: {
  "answer": "<answer in patient's language>",
  "category": "timing|fees|location|insurance|services|other",
  "follow_up_needed": true|false
}`,
      { temperature: 0.4 }
    );
    return out;
  }

  // Triage for emergency symptoms.
  async triage(patient, symptoms) {
    const out = await this.thinkJSON(
      `Triage these symptoms for urgency. Be conservative — if in doubt, escalate.
Patient: ${sanitize({ name: patient.full_name, age: patient.dob })}
Symptoms: ${symptoms}

Return JSON: {
  "urgency": "low|medium|high|emergency",
  "red_flags": ["flag1"],
  "action": "book_normal|book_urgent|refer_emergency|call_ambulance",
  "message_to_patient": "<reassuring message>",
  "notify_doctor": true|false
}`,
      { temperature: 0.2 }
    );
    return out;
  }

  // Generate appointment confirmation message.
  async confirmMessage(appointment, doctor, patient) {
    const lang = patient.language || "en";
    const date = new Date(appointment.scheduled_at).toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const time = new Date(appointment.scheduled_at).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit",
    });
    return patientMessage("appointment_confirmed", lang, {
      doctor: doctor.full_name,
      date,
      time,
    });
  }
}

module.exports = { PatientCoordAgent };
