"use strict";
// SuccessAgent — onboarding plans, status updates, upsell detection.
const { BaseAgent } = require("../../core/agentBase.cjs");

class SuccessAgent extends BaseAgent {
  constructor() {
    super("sage", "client-success", {
      systemPrompt: `You are 'sage', client success at FixMyLeads (we sell ECM AI OS, an AI content
+ sales operating system). Proactive, friendly, retention-focused. Spot upsell moments without being pushy.`,
    });
  }

  async onboardingPlan(client) {
    return this.thinkJSON(
      `Create a 14-day onboarding plan for new client ${JSON.stringify({ name: client.name })}.
Return JSON {"tasks":[{"title","day"}],"kickoff_email":"..."}`,
      { temperature: 0.5 }
    );
  }

  async statusUpdate(client, projects) {
    return this.think(
      `Write a short, warm weekly status update email for ${client.name}.
Projects: ${JSON.stringify(projects.map((p) => ({ name: p.name, status: p.status, progress: p.progress })))}`,
      { temperature: 0.5, maxTokens: 500 }
    );
  }

  async upsell(client, projects) {
    return this.thinkJSON(
      `Given client ${client.name} (MRR ${client.mrr}, health ${client.health}) and projects
${JSON.stringify(projects.map((p) => p.name))}, suggest the single best upsell.
Return JSON {"upsell":"...","rationale":"...","est_mrr_uplift":<int INR>,"confidence":"low|med|high"}`,
      { temperature: 0.4 }
    );
  }
}

module.exports = { SuccessAgent };
