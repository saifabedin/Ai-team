"use strict";
// The AI team roster — single source of truth for who the agents are.
// Used by the dashboard to show every agent (even before any run is recorded).
const ROSTER = [
  // ECM AI Team
  { agent: "scout", department: "lead-intel",      emoji: "🔎", role: "Lead Intelligence", does: "Sources, enriches & scores leads" },
  { agent: "nova",  department: "sdr",             emoji: "✉️", role: "AI SDR",            does: "Email / WhatsApp / LinkedIn outreach + booking" },
  { agent: "vox",   department: "voice",           emoji: "📞", role: "AI Voice",          does: "Outbound calls, qualifies & confirms" },
  { agent: "quill", department: "proposal",        emoji: "📝", role: "Proposals",         does: "Proposals, quotes & contracts (ECM AI OS)" },
  { agent: "muse",  department: "content",         emoji: "🎨", role: "Content",           does: "Social, blog, ads & video scripts" },
  { agent: "sage",  department: "client-success",  emoji: "🤝", role: "Client Success",    does: "Onboarding, health & upsell" },
  // FML Health Team
  { agent: "aria",     department: "coordinator",      emoji: "🩺", role: "Patient Coordinator", does: "Multi-channel patient intake, symptom collection, FAQ" },
  { agent: "chronos",  department: "appointment",      emoji: "📅", role: "Appointment Brain",   does: "Slot optimization, booking, reminders" },
  { agent: "prepper",  department: "prep",             emoji: "📋", role: "Prep Coach",          does: "Pre-appointment preparation workflows" },
  { agent: "healer",   department: "aftercare",        emoji: "💊", role: "Post-Care Guide",     does: "Aftercare instructions, follow-ups, compliance" },
  { agent: "sentinel", department: "reputation",       emoji: "⭐", role: "Review Guardian",     does: "Review requests, sentiment analysis, responses" },
  { agent: "connector",department: "referral",         emoji: "🔗", role: "Referral Tracker",    does: "Referral codes, tracking, incentives" },
  // ECM Agency Team
  { agent: "atlas",    department: "campaign",         emoji: "📊", role: "Campaign Strategist", does: "Campaign design, optimization, ROI" },
  { agent: "canvas",   department: "social",           emoji: "📱", role: "Social Media Manager",does: "Platform content, scheduling, hashtags" },
  { agent: "prism",    department: "ad-ops",           emoji: "🎯", role: "Ad Operations",       does: "Meta/Google/LinkedIn ads, ROAS optimization" },
  { agent: "optic",    department: "reporting",        emoji: "📈", role: "Reporting Analyst",   does: "Client reports, insights, ROI analysis" },
  { agent: "pulse",    department: "client-health",    emoji: "💚", role: "Health Analyst",      does: "Health scoring, churn prediction, retention" },
];

module.exports = { ROSTER };
