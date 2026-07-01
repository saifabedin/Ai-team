# AI Team PROJECT CONTEXT

## MAIN PROJECT
Path: /home/ubuntu/ai-team

Autonomous multi-agent revenue system for ECM (Editors Choice Media).

## CURRENT STATUS

Working:
* Gateway (:4100) — Express API with JWT auth
* Worker — BullMQ 22-queue processing
* Dashboard (:4101) — CEO KPI dashboard (auto-refresh 8s)
* Autopilot — 24/7 multi-brand loop (60s cycle)
* Lead intel — source → enrich → score pipeline
* SDR — outreach sequence engine
* DB — Neon PostgreSQL, 45 tables, multi-tenant
* Telegram control — /status, /run, /content

Running PM2 services:
* ai-team-gateway
* ai-team-worker
* ai-team-dashboard
* ai-team-control
* ai-team-autopilot

## CORE SYSTEM FLOW
```
Lead Source (Sheet/Web/API)
→ Lead Intel (scout-agent)
→ SDR (nova-agent)
→ Voice (vox-agent) / Proposal (quill-agent)
→ Booking → Client Success (sage-agent)
```

## 18 AGENTS (3 TEAMS × 6)

ECM Revenue: scout, nova, vox, quill, muse, sage
FML Health: aria, chronos, prepper, healer, sentinel, connector
ECM Agency: atlas, canvas, prism, optic, pulse

## IMPORTANT RULES
DO NOT:
* restart PM2 unless required
* modify .env with real credentials
* create duplicate agents/modules
* rewrite core architecture

ALWAYS:
* preserve brand_id isolation
* work modularly (agent + service + routes)
* run tests after changes
* keep production stability first

## EXPECTED OUTPUT
Always provide: VERIFIED WORKING | REAL BLOCKERS | EXACT FILES | SAFEST NEXT STEP
