# 01 — System Architecture

## Goal
An autonomous AI company that generates revenue for Editors Choice Media (ECM)
24/7 with maximum automation and near-zero running cost.

## High-level

```
                          ┌──────────────────────────────┐
                          │      CONTROL SURFACES         │
                          │  CEO Dashboard  ·  Telegram    │
                          └───────────────┬──────────────┘
                                          │ REST (RBAC + audit)
                          ┌───────────────▼──────────────┐
                          │        API GATEWAY :4100       │
                          │  auth · brand_id · audit log   │
                          └───────────────┬──────────────┘
        ┌──────────┬──────────┬───────────┼───────────┬──────────┬──────────┐
        ▼          ▼          ▼           ▼           ▼          ▼          ▼
   Lead-Intel    SDR        Voice     Proposal     Content   Client-Succ  Dashboard
   (scout)      (nova)      (vox)     (quill)      (muse)     (sage)      (metrics)
        └──────────┴──────────┴───────────┴───────────┴──────────┴──────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                 ▼                ▼                ▼                 ▼
   CORE PLATFORM:   BaseAgent        Shared Memory    Agent Bus         Task Queue
   db · crm · rbac  (LLM + run       (Redis short +   (Redis pub/sub    (BullMQ on
   · audit · llm    tracking)        Postgres long)   + ait_agent_msgs) Redis ai-team)
                                          │
                          ┌───────────────▼──────────────┐
                          │   Neon Postgres (ait_* tables) │   ← shared with ECM
                          │   Redis (queues + memory + bus)│
                          └────────────────────────────────┘
```

## Principles
- **Free-first.** OpenRouter free models / local Ollama for reasoning; mock
  adapters for every paid channel by default; self-hosted free providers in live mode.
- **Multi-tenant** by `brand_id` on every row and every API call (`x-brand-id`).
- **Independently deployable** modules — each department is plain code mounted by
  the gateway and/or driven by a queue worker; can be split into its own service.
- **Everything observable** — every agent action is a tracked `ait_agent_run`,
  every write is an `ait_audit_log` entry.

## Components
- **API Gateway** (`gateway/`) — single ingress; attaches user/brand, enforces
  RBAC, audits writes, mounts all department routers.
- **Departments** (`departments/*`) — each = `agent.cjs` (LLM brain extending
  `BaseAgent`) + `service.cjs` (orchestration, DB/CRM) + `routes.cjs` (REST) and
  channel/source adapters where needed.
- **Core platform** (`core/`) — `db`, `crm`, `llm`, `queue`, `redis`, `memory`,
  `bus`, `agentBase`, `rbac`, `audit`, `config`, `logger`.
- **Task queue** (`workers/`) — BullMQ workers for `enrich/score/outreach/voice`.
- **Control** — CEO dashboard (`dashboard/`) + Telegram bot (`control/`).

## Data & messaging
- **CRM + ops state**: Neon Postgres, `ait_` tables (see `03-database-schema.md`).
- **Shared memory**: Redis (short-term, TTL) + `ait_agent_memory` (long-term).
- **Agent-to-agent**: Redis pub/sub channel `aiteam:bus:<brand>` + durable
  `ait_agent_messages` inbox.
- **Task queue**: BullMQ queues on Redis (`scrape/enrich/score/outreach/voice/...`).
