"use strict";
// ReferralAgent — referral tracking, incentive optimization, viral growth.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize } = require("../../core/sanitize.cjs");

class ReferralAgent extends BaseAgent {
  constructor() {
    super("connector", "referral", {
      systemPrompt: `You are 'connector', the referral tracker for FML Health.
You manage patient referrals, track referral pipelines, and optimize incentive programs.
You encourage word-of-mouth growth while maintaining trust.
Indian healthcare context: referrals are high-trust, personal recommendations.`,
    });
  }

  // Generate a referral share message for a patient.
  async referralMessage(patient, clinicName, referralCode, referralLink) {
    const lang = patient.language || "en";
    const out = await this.thinkJSON(
      `Generate a referral share message for this patient to share with friends/family.
Patient: ${sanitize({ name: patient.full_name })}
Clinic: ${clinicName}
Referral code: ${referralCode}
Referral link: ${referralLink}
Language: ${lang}

Return JSON: {
  "message": "<referral message in patient's language>",
  "whatsapp_share": "<pre-filled WhatsApp share text>",
  "tone": "warm|excited|grateful"
}`,
      { temperature: 0.5 }
    );
    return out;
  }

  // Analyze referral success patterns.
  async analyzePatterns(referrals) {
    const out = await this.thinkJSON(
      `Analyze these ${referrals.length} referrals for patterns.
Data: ${JSON.stringify(referrals.map(r => ({
      status: r.status,
      incentive: r.incentive_type,
      converted: r.status === "converted",
    })))}

Return JSON: {
  "conversion_rate": 0.25,
  "best_incentive": "discount",
  "top_referrers": ["patient1"],
  "recommendations": ["rec1"]
}`,
      { temperature: 0.3 }
    );
    return out;
  }

  // Generate thank you message for successful referral.
  async thankYouMessage(referrerPatient, referredName, incentive) {
    const lang = referrerPatient.language || "en";
    const out = await this.thinkJSON(
      `Generate a thank-you message for a successful referral.
Referrer: ${referrerPatient.full_name}
Referred person: ${referredName}
Incentive: ${incentive}
Language: ${lang}

Return JSON: {
  "referrer_message": "<thank you to referrer>",
  "referred_message": "<welcome to referred person>",
  "incentive_detail": "description of the reward"
}`,
      { temperature: 0.4 }
    );
    return out;
  }
}

module.exports = { ReferralAgent };
