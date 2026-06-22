"use strict";
// ContentAgent — social, blog, ad copy, video scripts, creative briefs.
const { BaseAgent } = require("../../core/agentBase.cjs");

class ContentAgent extends BaseAgent {
  constructor() {
    super("muse", "content", {
      systemPrompt: `You are 'muse', the content creator at FixMyLeads (we sell ECM AI OS, an AI
content + sales operating system). On-brand, punchy, platform-aware. Indian audience. No fluff.`,
    });
  }

  async create(kind, topic, opts = {}) {
    const briefs = {
      social: `Write ${opts.count || 3} social posts about "${topic}" for ${opts.platform || "Instagram"}.
Each: hook + body + 3-5 hashtags + CTA. Return JSON {"posts":[{"hook","body","hashtags":[]}]}.`,
      blog: `Write an SEO blog post about "${topic}" (~600 words, H2 sections, meta description).
Return JSON {"title","meta","markdown"}.`,
      ad: `Write 3 ad variations for "${topic}" (${opts.platform || "Meta"}).
Return JSON {"ads":[{"headline","primary_text","cta"}]}.`,
      video_script: `Write a ${opts.seconds || 30}s short-form video script about "${topic}".
Return JSON {"hook","scenes":[{"visual","voiceover"}],"cta"}.`,
      brief: `Write a creative brief for "${topic}".
Return JSON {"objective","audience","key_message","tone","deliverables":[],"channels":[]}.`,
    };
    return this.thinkJSON(briefs[kind] || briefs.social, { temperature: 0.8, maxTokens: 1600 });
  }
}

module.exports = { ContentAgent };
