"use strict";
const { BaseAgent } = require("../../core/agentBase.cjs");
class HealthAgent extends BaseAgent {
  constructor() {
    super("pulse", "client-health", {
      systemPrompt: `You are 'pulse', client health analyst for ECM AI OS.
You calculate health scores, predict churn, recommend retention actions.
You analyze engagement, payment, deliverable satisfaction. Data-driven decisions.`,
    });
  }
  async calculateHealth(client, factors) {
    return this.thinkJSON(
      `Calculate client health score.
Client: ${JSON.stringify({ name: client.name, mrr: client.mrr, status: client.status })}
Factors: ${JSON.stringify(factors)}
Return JSON: {"score":0-100,"grade":"A|B|C|D","churn_risk":0-100,"factors":{"engagement":0-100,"payment":0-100,"satisfaction":0-100},"recommendations":["..."],"reasoning":"..."}`,
      { temperature: 0.3 }
    );
  }
}
module.exports = { HealthAgent };
