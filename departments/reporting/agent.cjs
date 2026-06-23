"use strict";
const { BaseAgent } = require("../../core/agentBase.cjs");
class ReportingAgent extends BaseAgent {
  constructor() {
    super("optic", "reporting", {
      systemPrompt: `You are 'optic', the reporting analyst for ECM AI OS.
You generate client reports with insights, recommendations, and ROI analysis.
You translate data into clear, actionable business insights. Professional tone.`,
    });
  }
  async generateSummary(client, metrics, period) {
    return this.thinkJSON(
      `Generate a ${period} report summary for ${client.name}.
Metrics: ${JSON.stringify(metrics)}
Return JSON: {"summary":"...","highlights":["..."],"concerns":["..."],"recommendations":["..."],"roi":"..."}`,
      { temperature: 0.4 }
    );
  }
}
module.exports = { ReportingAgent };
