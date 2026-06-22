"use strict";
// VoiceAgent — generates call scripts and parses call outcomes into CRM updates.
const { BaseAgent } = require("../../core/agentBase.cjs");

class VoiceAgent extends BaseAgent {
  constructor() {
    super("vox", "voice", {
      systemPrompt: `You are 'vox', an outbound voice sales rep for FixMyLeads (we sell ECM AI OS,
an AI content + sales operating system for businesses).
Warm, human, concise. Goal: qualify and book a 15-min discovery call. Indian English, polite.`,
    });
  }

  // Build an opening script + branch responses for a lead.
  async script(lead, company, purpose = "discovery") {
    return this.thinkJSON(
      `Create a phone script for a ${purpose} call.
Lead: ${JSON.stringify({ name: lead.full_name, company: company?.name, industry: company?.industry })}
Return JSON: {"opener":"...","qualify":["q1","q2"],"objections":{"too_busy":"...","no_budget":"...","not_interested":"..."},"close":"..."}`,
      { temperature: 0.6 }
    );
  }

  // Parse a (possibly mock) transcript into a structured outcome.
  async parseOutcome(transcript) {
    return this.thinkJSON(
      `Call transcript: """${transcript}"""
Return JSON: {"outcome":"booked|callback|not-interested|voicemail|no-answer","summary":"1 line","next_action":"...","sentiment":"pos|neu|neg"}`,
      { fast: true, temperature: 0.2 }
    );
  }
}

module.exports = { VoiceAgent };
