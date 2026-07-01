# AI Team — Autonomous Multi-Agent Revenue System

Node.js **20+ (system Node, no venv)**. Entry `gateway/server.cjs` — Express API gateway on port 4100.

## System Architecture
```
gateway (Express :4100)
├── middleware (JWT auth, RBAC, audit)
├── auth (register, token, Facebook OAuth)
├── department routes (mounted per module)
└── webhook-whatsapp

workers (BullMQ :6379) — 22 queues
├── lead-intel / sdr / voice / proposal
├── content / campaign / social / ad-ops
├── patient-coord / appointment / prep / aftercare
└── reputation / referral / reporting / client-health

dashboard (Express :4101) — CEO SPA
control (Telegram bot) — /status, /run, /content
autopilot (60s loop) — multi-brand enrich/score/enroll/re-engage
```

## Core Stack
- Express + BullMQ + Redis + Neon PostgreSQL
- 3 teams × 6 agents = 18 agents (ECM Revenue, FML Health, ECM Agency)
- Agent-to-agent bus: Redis pub/sub + Postgres durable inbox
- Shared memory: Redis (short-term) + Postgres (long-term)
- LLM: NVIDIA NIM (Llama 3.3 70B + 3.1 8B), OpenAI-compatible

## Department Module Contract
Every department follows: `agent.cjs` (LLM brain) + `service.cjs` (business logic) + `routes.cjs` (HTTP)

## Repository Structure
| Path | Purpose |
|------|---------|
| `core/` | Shared OS: BaseAgent, bus, config, db, llm, memory, queue, rbac, sanitize, autopilot, ecm-bridge |
| `gateway/` | Express API gateway (:4100), auth, middleware, webhooks |
| `dashboard/` | CEO KPI dashboard (:4101), metrics, routes |
| `departments/` | 20 departments across 3 teams |
| `workers/` | BullMQ queue handlers (22 queues) |
| `control/` | Telegram bot |
| `db/` | Schema, migrations, seed |
| `scripts/` | Deploy, smoke test, check, set-api-key |
| `tests/` | Unit tests (sanitize, auth) |

## Commands
```bash
npm run gateway     # node gateway/server.cjs
npm run workers     # node workers/index.cjs
npm run dashboard   # node dashboard/server.cjs
npm run autopilot   # node core/autopilot.cjs
npm run control     # node control/bot.cjs
npm run test        # node --test tests/
npm run smoke       # node scripts/smoke.cjs
npm run deploy      # bash scripts/deploy.sh
```

## Gotchas
- `.env` has LIVE credentials (Neon, NVIDIA, Facebook) — never commit
- Two DB schemas: `ait_*` (CRM/agency) and `fmlh_*` (healthcare), ~45 tables
- ALL queries must filter by `brand_id` for multi-tenant isolation
- Autopilot runs EVERY 60s — check AUTOPILOT_INTERVAL_MS
- Voice calling is `mock` only — `voice_service.py` returns 501
- LinkedIn scraping is `mock` only — no real integration
- ECM bridge hardcodes `/home/ubuntu/ecm-ai-os/backend/engines` absolute path
- Telegram bot token not set in .env
- Google Sheets write-back API key not set
