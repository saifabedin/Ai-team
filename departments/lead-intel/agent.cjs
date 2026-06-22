"use strict";
// LeadIntelAgent — scores leads 0..100 with an LLM using FixMyLeads' ICP.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize } = require("../../core/sanitize.cjs");

const ICP = `FixMyLeads sells "ECM AI OS" — an AI-powered content + sales operating system that
generates marketing content/video AND runs the sales pipeline (lead-gen, multi-channel outreach,
booking) for a business. Target buyers: SMBs, agencies, coaches/creators, and local service
businesses (real estate, fitness, healthcare, hospitality, retail, education) that want more leads
and consistent content without hiring a team.
Best-fit leads: a decision-maker (owner/founder/marketing head), reachable (email or phone),
in a marketing-hungry industry, currently struggling with lead flow or content output.`;

class LeadIntelAgent extends BaseAgent {
  constructor() {
    super("scout", "lead-intel", {
      systemPrompt: `You are 'scout', the lead-scoring analyst at FixMyLeads. ${ICP}
Score leads strictly and explain briefly.`,
    });
  }

  async score(lead, company) {
    const profile = JSON.stringify(sanitize({
      name: lead.full_name || lead.fullName,
      title: lead.title,
      email: lead.email,
      phone: lead.phone,
      industry: company?.industry,
      website: lead.website || company?.website,
      city: company?.city,
      source: lead.source,
    }));
    const out = await this.thinkJSON(
      `Score this lead for our ICP. Return JSON:
{"score": <0-100 int>, "grade": "A|B|C|D", "reasons": ["short", "short"], "next_action": "string"}

Lead: ${profile}`,
      { fast: true, temperature: 0.2 }
    );
    // clamp + normalize
    let score = Math.max(0, Math.min(100, parseInt(out.score, 10) || 0));
    const grade = out.grade || (score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D");
    return { score, grade, reasons: out.reasons || [], nextAction: out.next_action || "" };
  }
}

module.exports = { LeadIntelAgent };
