# 10 — 90-Day Implementation Roadmap

Priority: **Revenue > Meetings > Qualified Leads > Automation > Content.**
Status legend: ✅ shipped in this build · 🔜 next · 🔭 later.

## Phase 0 — Foundation (DONE, this build) ✅
- Monorepo, core platform (db/crm/llm/queue/memory/bus/rbac/audit/agentBase).
- 20 `ait_*` tables migrated to live Neon; seed data.
- API gateway + RBAC + audit; BullMQ workers.
- All 7 departments with working agents (mock providers, free LLM).
- CEO dashboard + Telegram control panel.
- End-to-end smoke test of the revenue path.

## Phase 1 — Days 1–30: Make it real & revenue-first
Goal: real qualified leads → real meetings booked.
1. **Auth hardening**: JWT on gateway, TLS via Nginx, per-tenant keys.
2. **Live email**: Gmail SMTP (nodemailer), deliverability (SPF/DKIM), opt-out.
3. **Lead sourcing v1 (compliant)**: Google Maps via a self-hosted/consented
   source; website crawler hardening; dedupe.
4. **Scoring tuning**: refine ICP prompt with real ECM win/loss data; calibrate grades.
5. **Sequence scheduler**: cron/n8n enqueues due enrollments; inbound-reply webhook
   (n8n) → objection handling.
6. **Meeting booking**: real calendar (Google Calendar free API) + confirmations.
- **Exit metric**: first N meetings booked from autonomous outreach.

## Phase 2 — Days 31–60: Scale outreach + voice + proposals
1. **WhatsApp** live (self-hosted wppconnect/Baileys) + follow-up cadences.
2. **Voice** live: Piper TTS + Whisper STT (`voice_service.py`) + a telephony API;
   call campaigns for grade-A leads; DND compliance.
3. **Proposal flow**: templated catalogue, e-sign-ready PDFs, accept webhook → onboarding.
4. **Pipeline analytics**: conversion by source/stage; per-agent ROI on dashboard.
5. **Human-in-the-loop**: approval gates (Telegram `/approve`) for live sends/sign.
- **Exit metric**: first closed deal attributable to the system; pipeline value tracked.

## Phase 3 — Days 61–90: Autonomy, content engine, optimization
1. **Content factory** at cadence → ECM publishing pipeline / social APIs via n8n.
2. **Client success** automation: onboarding, weekly status, upsell campaigns.
3. **Self-optimization**: A/B subject lines & sequences; agents learn from
   `ait_agent_runs`/outcomes via shared memory.
4. **Reliability**: queue dashboards, alerting, retro on `ait_audit_log`.
5. **Multi-brand**: onboard additional `brand_id`s; verify isolation.
- **Exit metric**: lights-out daily cycle (source→close→deliver) with owner
  approving only sends/signatures; MRR contribution reported daily.

## Ongoing
Cost stays ~zero (free models/mock-or-self-hosted providers). Upgrade individual
adapters to paid only where ROI is proven (e.g. a better LLM for closing copy).
