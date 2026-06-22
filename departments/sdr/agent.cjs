"use strict";
// SDRAgent — writes personalized outreach, handles objections, decides booking.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize, sanitizeStr } = require("../../core/sanitize.cjs");

class SDRAgent extends BaseAgent {
  constructor() {
    super("nova", "sdr", {
      systemPrompt: `You are 'nova', an SDR at FixMyLeads. FixMyLeads sells ECM AI OS — an AI
content + sales operating system that creates content/video and runs lead-gen + outreach for
businesses. You write short, personal, non-spammy outreach that earns replies. Indian SMB audience.
Never over-promise. Always end with a soft, specific CTA.`,
    });
  }

  // Draft one outreach message for a lead + a sequence step template.
  async draft(lead, company, step, channel = "email") {
    const ctx = JSON.stringify(sanitize({
      name: lead.full_name, title: lead.title, company: company?.name,
      industry: company?.industry, city: company?.city, website: lead.website || company?.website,
    }));
    const out = await this.thinkJSON(
      `Write a ${channel} outreach message.
Channel rules: email = subject + 70-110 word body; whatsapp/linkedin = no subject, <60 words.
Step intent: ${step?.template || "first friendly touch with a soft CTA to a 15-min call"}
Lead: ${ctx}
Return JSON: {"subject": "<email only, else empty>", "body": "..."}`,
      { temperature: 0.7 }
    );
    return { subject: out.subject || "", body: out.body || "" };
  }

  // Generate a reply that handles an inbound objection and pushes to a meeting.
  async handleObjection(lead, inboundText) {
    const out = await this.thinkJSON(
      `Prospect replied: "${sanitizeStr(inboundText)}".
Classify and respond. Return JSON:
{"intent":"interested|objection|not_now|unsubscribe|question","reply":"<short reply>","book_meeting":true|false}`,
      { temperature: 0.5 }
    );
    return out;
  }
}

module.exports = { SDRAgent };
