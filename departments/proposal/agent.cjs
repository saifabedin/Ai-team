"use strict";
// ProposalAgent — generates proposals, quotations, contracts, follow-ups.
const { BaseAgent } = require("../../core/agentBase.cjs");

const SERVICES = `FixMyLeads sells "ECM AI OS" — an AI content + sales operating system. Typical INR pricing:
- ECM AI OS Starter (AI content engine: social + reels, 1 brand): 15,000/mo
- ECM AI OS Growth (content + AI SDR lead-gen & outreach): 35,000/mo
- ECM AI OS Pro (full content + sales pipeline + voice + dashboard): 60,000/mo
- Done-for-you setup & onboarding: 25,000 (one-time)
- Custom / multi-brand / agency white-label: from 1,00,000/mo`;

class ProposalAgent extends BaseAgent {
  constructor() {
    super("quill", "proposal", {
      systemPrompt: `You are 'quill', the proposals writer at FixMyLeads.
Clear, persuasive, well-structured. Use INR. You sell ECM AI OS (a product), not generic agency retainers. ${SERVICES}`,
    });
  }

  async generate(kind, lead, company, brief = {}) {
    const prompts = {
      proposal: `Write a proposal (markdown) for ${company?.name || "the client"} to adopt ECM AI OS.
Sections: Overview, Goals, Recommended Plan, What ECM AI OS Does For You, Onboarding Timeline, Investment (INR table), Next Steps.`,
      quote: `Write an itemized quotation (markdown table) with line items, qty, unit price (INR), total.`,
      contract: `Write a concise service agreement (markdown): Parties, Scope, Term, Fees & payment, IP, Termination, Signatures.`,
      followup: `Write a short, warm follow-up email nudging a decision on the proposal. <120 words.`,
    };
    const ctx = JSON.stringify({
      company: company?.name, industry: company?.industry, contact: lead?.full_name,
      requested: brief.services || null, budget: brief.budget || null, notes: brief.notes || null,
    });
    const body = await this.think(`${prompts[kind] || prompts.proposal}\nContext: ${ctx}`, {
      temperature: 0.5, maxTokens: 1600,
    });
    // best-effort amount extraction for the pipeline value metric
    const amount = brief.amount || extractAmount(body);
    return { body, amount };
  }
}

function extractAmount(text) {
  // Prefer amount nearest to investment/total/fee keywords (the actual charged amount)
  const priorityM = text.match(
    /(?:investment|total|package|monthly fee|our fee|retainer|you pay)[^\d₹INR]{0,30}(?:₹|INR|Rs\.?)\s?([\d,]{4,})/i
  );
  if (priorityM) return parseInt(priorityM[1].replace(/[^\d]/g, ""), 10);

  // Fallback: first INR figure in text (not max — avoids picking historical/comparison prices)
  const m = text.match(/(?:₹|INR|Rs\.?)\s?([\d,]{4,})/i);
  return m ? parseInt(m[1].replace(/[^\d]/g, ""), 10) : null;
}

module.exports = { ProposalAgent };
