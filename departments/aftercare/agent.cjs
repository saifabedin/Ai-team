"use strict";
// AftercareAgent — post-visit care instructions, follow-ups, compliance.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize } = require("../../core/sanitize.cjs");

class AftercareAgent extends BaseAgent {
  constructor() {
    super("healer", "aftercare", {
      systemPrompt: `You are 'healer', a post-care guide for FML Health clinics.
You create personalized aftercare instructions, medication reminders, and follow-up plans.
You are caring, clear, and medically responsible — always emphasize consulting the doctor for concerns.
Indian healthcare context: patients may need instructions in local language, simple terms.`,
    });
  }

  // Generate personalized aftercare instructions.
  async generateAftercare(patient, appointment, doctorNotes) {
    const lang = patient.language || "en";
    const out = await this.thinkJSON(
      `Generate personalized aftercare instructions for this patient.
Patient: ${sanitize({ name: patient.full_name, age: patient.dob, gender: patient.gender, allergies: patient.allergies })}
Doctor: Dr. ${appointment.doctor_name} (${appointment.specialty})
Appointment type: ${appointment.type}
Doctor's notes: ${doctorNotes || "None provided"}
Language: ${lang}

Return JSON: {
  "instructions": [
    {"type": "medication", "detail": "...", "frequency": "...", "duration": "..."},
    {"type": "diet", "detail": "..."},
    {"type": "activity", "detail": "..."},
    {"type": "warning_sign", "detail": "..."}
  ],
  "medication": [{"name": "...", "dosage": "...", "timing": "...", "days": 7}],
  "diet_notes": "...",
  "warning_signs": ["sign1", "sign2"],
  "follow_up_days": 7,
  "special_notes": "..."
}`,
      { temperature: 0.4 }
    );
    return out;
  }

  // Generate follow-up check-in message.
  async followUpMessage(patient, appointment, dayNumber) {
    const lang = patient.language || "en";
    const out = await this.thinkJSON(
      `Generate a day-${dayNumber} follow-up check-in message.
Patient: ${sanitize({ name: patient.full_name })}
Appointment type: ${appointment.type}
Day: ${dayNumber} post-visit
Language: ${lang}

Return JSON: {
  "message": "<check-in message in patient's language>",
  "questions": ["How are you feeling?", "Any side effects?"],
  "tone": "caring|professional|urgent"
}`,
      { temperature: 0.5 }
    );
    return out;
  }

  // Assess patient compliance from their response.
  async assessCompliance(patientResponse, carePlan) {
    const out = await this.thinkJSON(
      `Assess patient compliance based on their response.
Patient response: "${patientResponse}"
Care plan: ${JSON.stringify(carePlan)}

Return JSON: {
  "compliance": "compliant|partial|non_compliant|unclear",
  "concerns": ["concern1"],
  "needs_follow_up": true|false,
  "escalate": true|false,
  "message_to_patient": "<response>"
}`,
      { temperature: 0.3 }
    );
    return out;
  }

  // Generate escalation message for doctor.
  async escalateToDoctor(patient, issue, compliance) {
    const out = await this.thinkJSON(
      `Generate an escalation summary for the doctor.
Patient: ${sanitize({ name: patient.full_name, phone: patient.phone })}
Issue: ${issue}
Compliance: ${compliance}

Return JSON: {
  "subject": "Patient Follow-up Alert",
  "summary": "1-line summary",
  "detail": "detailed explanation",
  "action_needed": "call|visit|medication_change",
  "urgency": "low|medium|high"
}`,
      { temperature: 0.3 }
    );
    return out;
  }
}

module.exports = { AftercareAgent };
