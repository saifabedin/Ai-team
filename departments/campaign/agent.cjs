"use strict";
// CampaignAgent — campaign strategy, brief generation, optimization.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize } = require("../../core/sanitize.cjs");

class CampaignAgent extends BaseAgent {
  constructor() {
    super("atlas", "campaign", {
      systemPrompt: `You are 'atlas', the campaign strategist for ECM AI OS.
You design, plan, and optimize marketing campaigns across channels.
You think in funnels: awareness → interest → conversion → retention.
You are data-driven, creative, and ROI-focused. Indian market expertise.`,
    });
  }

  async createBrief(client, goals, budget) {
    return this.thinkJSON(
      `Create a campaign brief for this client.
Client: ${sanitize({ name: client.name, industry: client.industry })}
Goals: ${JSON.stringify(goals)}
Budget: ₹${budget}
Return JSON: {"name":"...","type":"lead_gen|awareness|retargeting","channels":["..."],"target_audience":{},"timeline":"2 weeks","kpi_targets":{},"strategy":"...","content_pillars":["..."]}`,
      { temperature: 0.5 }
    );
  }

  async optimizeCampaign(campaign, metrics) {
    return this.thinkJSON(
      `Optimize this campaign based on performance.
Campaign: ${sanitize({ name: campaign.name, type: campaign.type, spend: campaign.spend })}
Metrics: ${JSON.stringify(metrics)}
Return JSON: {"action":"scale|pause|adjust|pivot","budget_change":"...","audience_adjustment":"...","creative_recommendations":["..."],"reasoning":"..."}`,
      { temperature: 0.4 }
    );
  }
}
module.exports = { CampaignAgent };
