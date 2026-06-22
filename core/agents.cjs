"use strict";
// The AI team roster — single source of truth for who the agents are.
// Used by the dashboard to show every agent (even before any run is recorded).
const ROSTER = [
  { agent: "scout", department: "lead-intel",      emoji: "🔎", role: "Lead Intelligence", does: "Sources, enriches & scores leads" },
  { agent: "nova",  department: "sdr",             emoji: "✉️", role: "AI SDR",            does: "Email / WhatsApp / LinkedIn outreach + booking" },
  { agent: "vox",   department: "voice",           emoji: "📞", role: "AI Voice",          does: "Outbound calls, qualifies & confirms" },
  { agent: "quill", department: "proposal",        emoji: "📝", role: "Proposals",         does: "Proposals, quotes & contracts (ECM AI OS)" },
  { agent: "muse",  department: "content",         emoji: "🎨", role: "Content",           does: "Social, blog, ads & video scripts" },
  { agent: "sage",  department: "client-success",  emoji: "🤝", role: "Client Success",    does: "Onboarding, health & upsell" },
];

module.exports = { ROSTER };
