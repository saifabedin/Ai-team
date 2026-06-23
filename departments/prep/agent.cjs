"use strict";
// PrepAgent — pre-appointment preparation instructions.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize } = require("../../core/sanitize.cjs");

class PrepAgent extends BaseAgent {
  constructor() {
    super("prepper", "prep", {
      systemPrompt: `You are 'prepper', a preparation coach for FML Health clinics.
You generate clear, personalized pre-appointment instructions for patients.
You consider the patient's condition, appointment type, and clinic requirements.
Instructions are simple, actionable, and in the patient's language.`,
    });
  }

  // Generate preparation steps for an appointment.
  async generateSteps(patient, appointment, doctor, clinicInfo) {
    const lang = patient.language || "en";
    const out = await this.thinkJSON(
      `Generate pre-appointment preparation steps.
Patient: ${sanitize({ name: patient.full_name, age: patient.dob, gender: patient.gender })}
Appointment type: ${appointment.type}
Doctor: ${sanitize({ name: doctor.full_name, specialty: doctor.specialty })}
Clinic info: ${JSON.stringify(clinicInfo || {})}
Language: ${lang}

Return JSON: {
  "steps": [
    {"step": 1, "instruction": "...", "category": "documents|medication|fasting|clothing|other", "critical": true|false},
    {"step": 2, "instruction": "...", "category": "...", "critical": true|false}
  ],
  "special_notes": "any special instructions for this patient type",
  "estimated_duration": "30 minutes"
}`,
      { temperature: 0.4 }
    );
    return out;
  }

  // Generate medication hold instructions if needed.
  async medicationHold(patient, appointment) {
    const out = await this.thinkJSON(
      `Check if this patient needs to hold any medications before the appointment.
Patient: ${sanitize({ name: patient.full_name, medical_history: patient.medical_history })}
Appointment type: ${appointment.type}

Return JSON: {
  "needs_hold": true|false,
  "medications": [{"name": "...", "hold_from": "...", "hold_to": "...", "reason": "..."}],
  "instructions": "general instructions"
}`,
      { temperature: 0.3 }
    );
    return out;
  }

  // Generate day-of checklist.
  async dayOfChecklist(appointment, patient, doctor) {
    const lang = patient.language || "en";
    const out = await this.thinkJSON(
      `Generate a day-of checklist for the patient.
Doctor: Dr. ${doctor.full_name} (${doctor.specialty})
Appointment type: ${appointment.type}
Language: ${lang}

Return JSON: {
  "checklist": [
    {"item": "...", "time": "before leaving|on arrival", "done": false}
  ]
}`,
      { temperature: 0.3 }
    );
    return out;
  }
}

module.exports = { PrepAgent };
