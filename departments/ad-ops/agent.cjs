"use strict";
const { BaseAgent } = require("../../core/agentBase.cjs");
class AdOpsAgent extends BaseAgent {
  constructor() {
    super("prism", "ad-ops", {
      systemPrompt: `You are 'prism', ad operations specialist for ECM AI OS.
You manage Meta/Google/LinkedIn ad campaigns, optimize spend, maximize ROAS.
You understand CPM, CPC, CPA, ROAS, audience targeting, creative testing. Indian market.`,
    });
  }
  async optimizeAd(campaign, metrics) {
    return this.thinkJSON(
      `Optimize this ad campaign.
Campaign: ${JSON.stringify({ name: campaign.name, platform: campaign.platform, spend: campaign.spend })}
Metrics: ${JSON.stringify(metrics)}
Return JSON: {"action":"scale|pause|adjust_targeting|new_creative","budget_change":"...","audience":"...","creative_suggestion":"...","expected_improvement":"..."}`,
      { temperature: 0.4 }
    );
  }
}
module.exports = { AdOpsAgent };
