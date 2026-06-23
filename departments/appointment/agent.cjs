"use strict";
// AppointmentAgent — slot optimization, scheduling logic.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize } = require("../../core/sanitize.cjs");

class AppointmentAgent extends BaseAgent {
  constructor() {
    super("chronos", "appointment", {
      systemPrompt: `You are 'chronos', the appointment scheduling brain for FML Health.
You optimize doctor-patient scheduling, handle slot conflicts, and suggest the best available times.
You are efficient, precise, and always consider patient convenience.
Indian healthcare context: clinics typically run Mon-Sat 9AM-6PM, 15-30 min slots.`,
    });
  }

  // Suggest best slot from available options.
  async suggestSlot(patient, doctor, availableSlots, preferences = {}) {
    const out = await this.thinkJSON(
      `Suggest the best appointment slot for this patient.
Patient: ${sanitize({ name: patient.full_name, language: patient.language })}
Doctor: ${sanitize({ name: doctor.full_name, specialty: doctor.specialty })}
Available slots: ${JSON.stringify(availableSlots)}
Patient preferences: ${JSON.stringify(preferences)}

Return JSON: {
  "recommended_slot": <index>,
  "reason": "why this slot is best",
  "alternatives": [<index>, <index>]
}`,
      { temperature: 0.3 }
    );
    return out;
  }

  // Generate reminder message.
  async reminderMessage(appointment, patient, doctor, reminderType) {
    const lang = patient.language || "en";
    const apptDate = new Date(appointment.scheduled_at);
    const dateStr = apptDate.toLocaleDateString("en-IN", {
      weekday: "long", month: "long", day: "numeric",
    });
    const timeStr = apptDate.toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit",
    });

    const out = await this.thinkJSON(
      `Generate a ${reminderType} reminder message for a patient appointment.
Doctor: Dr. ${doctor.full_name} (${doctor.specialty})
Date: ${dateStr}
Time: ${timeStr}
Language: ${lang}
Reminder type: ${reminderType}

Return JSON: {
  "message": "<reminder message in patient's language>",
  "tone": "warm|formal|urgent"
}`,
      { temperature: 0.4 }
    );
    return out;
  }

  // Handle appointment conflict resolution.
  async resolveConflict(appointments, newRequest) {
    const out = await this.thinkJSON(
      `There are ${appointments.length} existing appointments and a new request.
Existing: ${JSON.stringify(appointments.map(a => ({
      time: a.scheduled_at, patient: a.patient_name, type: a.type,
    })))}
New request: ${JSON.stringify(newRequest)}

Return JSON: {
  "suggestion": "alternative_slot|waitlist|reschedule_existing",
  "best_time": "HH:MM",
  "reason": "explanation"
}`,
      { temperature: 0.3 }
    );
    return out;
  }

  // Analyze appointment patterns for optimization.
  async analyzePatterns(appointments) {
    const out = await this.thinkJSON(
      `Analyze these ${appointments.length} appointments for patterns.
Data: ${JSON.stringify(appointments.map(a => ({
      date: a.scheduled_at, type: a.type, status: a.status,
      no_show: a.status === "no_show",
    })))}

Return JSON: {
  "peak_hours": ["09:00-11:00"],
  "no_show_rate": 0.15,
  "busiest_day": "monday",
  "recommendations": ["suggestion1"]
}`,
      { temperature: 0.3 }
    );
    return out;
  }
}

module.exports = { AppointmentAgent };
