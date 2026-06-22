# FixMyLeads — Autonomous AI Sales & Content Team

A multi-agent **AI workforce** for **FixMyLeads** (social: `fixmyleads.`) that sells
**ECM AI OS** — an AI content + sales operating system. The team sources leads,
qualifies & scores them, runs outreach (email/WhatsApp/LinkedIn), makes voice
calls, books meetings, writes proposals & content, onboards clients, and reports
to a live CEO dashboard — **24/7, free-first**.

Standalone monorepo under `ai-team/`, sharing the **live Neon Postgres + Redis**.
Every department is independently deployable. All AI-Team tables are prefixed `ait_`.

## Quick start
```bash
cp .env.example .env        # then fill DATABASE_URL, REDIS_URL, LLM_* (see below)
npm install
npm run migrate             # creates ait_* tables on Neon
npm run seed                # demo brand + sequence + sample leads
npm run smoke               # end-to-end revenue path (mock providers)

# services (or use PM2: pm2 start ecosystem.config.js)
npm run gateway             # API gateway      :4100
npm run dashboard           # CEO dashboard    :4101  (open in browser)
npm run workers             # BullMQ workers (task queue)
npm run control             # Telegram control panel
```

## LLM brain (NVIDIA NIM)
Agents reason via an **OpenAI-compatible** endpoint. Default = **NVIDIA NIM**
(`integrate.api.nvidia.com/v1`) with `meta/llama-3.3-70b-instruct` (main) and
`meta/llama-3.1-8b-instruct` (fast). Set `LLM_*` in `.env` (key = `nvapi-...`).
Swappable to any OpenAI-compatible provider (OpenRouter, Groq, local Ollama).
> Note: `cc.freemodel.dev` is hard-restricted to the official Claude Code client
> and **cannot** be used by external agents — confirmed during build.
> Long-form generations (proposals/content) take ~30s on the free 70B tier; the
> LLM client uses a 150s timeout + one retry on transient stalls.

## Departments (agents)
| # | Department | Agent | Does |
|---|---|---|---|
| 1 | Lead Intelligence | `scout` | scrape → enrich → score → CRM |
| 2 | AI SDR | `nova` | email/WhatsApp/LinkedIn sequences, objections, booking |
| 3 | AI Voice | `vox` | outbound calls, confirmations, CRM updates |
| 4 | Proposal | `quill` | proposals, quotes, contracts, follow-ups (+PDF) |
| 5 | Content | `muse` | social, blog, ad copy, video scripts, briefs |
| 6 | Client Success | `sage` | onboarding, tracking, status, upsell |
| 7 | CEO Dashboard | — | revenue, meetings, pipeline, team perf |

## Provider modes
`PROVIDER_MODE=mock` (default) — every external channel (scrape/email/WhatsApp/
voice) is simulated: **free, safe, fully demoable**. `PROVIDER_MODE=live` — flips
each adapter to real free/self-hosted providers (Gmail SMTP, self-hosted WhatsApp
HTTP API, Piper+Whisper voice). Integration points are marked `TODO(live)`.

## Docs
`docs/01-architecture.md` … `docs/10-roadmap-90day.md` — architecture, schema,
agent specs, APIs, workflows, automation maps, deployment, security, roadmap.

## Priority
Revenue > Meetings > Qualified Leads > Automation > Content.
