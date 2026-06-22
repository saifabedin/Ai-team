# 04 — Agent Responsibilities

Every agent extends `core/agentBase.cjs::BaseAgent`, giving it: `think()` /
`thinkJSON()` (LLM), per-brand shared `mem()`, `send()` (agent bus), and
`run()` (tracked execution → `ait_agent_runs`, audit). All work is multi-tenant
by `brand_id`.

## 1. Lead Intelligence — `scout` (`departments/lead-intel`)
- **Source** leads: Google Maps, website/directory crawl (cheerio), LinkedIn
  (`sources.cjs`; mock by default, `TODO(live)` hooks).
- **Enrich** (`enrich.cjs`): derive email pattern from name+domain, probe website
  for phone/socials.
- **Score** (`agent.cjs`): LLM scores 0–100 + grade A–D + reasons against ECM ICP;
  saved to `ait_lead_scores`, lead → `scored`.
- **Output**: clean, scored leads in CRM; emits to `enrich`/`score` queues.

## 2. AI SDR — `nova` (`departments/sdr`)
- **Draft** personalized email/WhatsApp/LinkedIn per sequence step.
- **Sequences**: enroll leads, run steps with delays (`ait_enrollments`).
- **Objection handling**: classify inbound reply (interested/objection/not_now/
  unsubscribe), respond, decide booking.
- **Booking**: create `ait_meeting`, broadcast `meeting.booked` on the bus.
- Channels via `channels.cjs` (mock | Gmail SMTP | self-hosted WhatsApp | LinkedIn).

## 3. AI Voice — `vox` (`departments/voice`)
- **Script**: opener + qualifying questions + objection branches + close.
- **Call**: `adapter.cjs` (mock transcript | live Piper-TTS + Whisper-STT via
  `voice_service.py` bridged to a telephony API).
- **Outcome**: parse transcript → booked/callback/not-interested/voicemail;
  update CRM, create meeting on "booked"; confirm upcoming meetings.

## 4. Proposal — `quill` (`departments/proposal`)
- Generate **proposal / quote / contract / follow-up** (markdown) from lead+brief,
  using ECM service catalogue & INR pricing.
- Extract deal **amount** (feeds pipeline metric); render **PDF** (`pdf.cjs`).
- Lifecycle: `draft → sent → accepted|rejected`.

## 5. Content Marketing — `muse` (`departments/content`)
- Generate **social posts, blog (SEO), ad copy, video scripts, creative briefs**.
- Stored as structured JSON in `ait_content`; `draft → approved → published`.

## 6. Client Success — `sage` (`departments/client-success`)
- **Onboard** won leads → client + 14-day onboarding plan → `ait_projects/tasks`.
- **Status updates**: weekly client email from project state.
- **Upsell**: detect best upsell + est. MRR uplift + confidence.

## 7. CEO Dashboard — (`dashboard`)
- Aggregates: revenue (MRR), pipeline value, leads/qualified, meetings, deals won,
  funnel by status, today's activity, **team performance** (per-agent runs/errors/latency).

## Collaboration patterns
- `scout` scores → high grade leads auto-enqueued for `nova`.
- `nova`/`vox` book meeting → broadcast → (future) calendar/notify agents.
- Won lead → `sage.onboard()` → client + delivery tasks.
- All agents read/write **shared memory** namespaced by department, and can
  message each other over the **bus** (`ait_agent_messages`).
