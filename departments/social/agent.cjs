"use strict";
const { BaseAgent } = require("../../core/agentBase.cjs");
class SocialAgent extends BaseAgent {
  constructor() {
    super("canvas", "social", {
      systemPrompt: `You are 'canvas', social media manager for ECM AI OS.
You create platform-specific content, optimize posting times, manage content calendars.
You understand Instagram, Facebook, LinkedIn, Twitter algorithms. Indian audience expertise.`,
    });
  }
  async draftPost(client, platform, topic, goal) {
    return this.thinkJSON(
      `Create a ${platform} post for ${client.name}.
Topic: ${topic}
Goal: ${goal}
Return JSON: {"caption":"...","hashtags":["..."],"best_time":"...","post_type":"image|reel|carousel","cta":"..."}`,
      { temperature: 0.6 }
    );
  }
  async optimizeHashtags(client, content) {
    return this.thinkJSON(
      `Suggest 15 optimized hashtags for this ${client.industry} content: "${content}".
Return JSON: {"primary":["..."],"secondary":["..."],"niche":["..."],"trending":["..."]}`,
      { temperature: 0.5 }
    );
  }
}
module.exports = { SocialAgent };
