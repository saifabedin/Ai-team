# 02 — Folder Structure

```
ai-team/
├── package.json            # scripts: migrate, seed, gateway, workers, dashboard, control, smoke
├── .env.example            # all config (copy to .env)
├── ecosystem.config.js     # PM2 process map (4 apps)
├── docker-compose.yml      # optional containerized deploy
├── Dockerfile
│
├── core/                   # shared platform (the "OS")
│   ├── config.cjs          # env → typed config
│   ├── logger.cjs
│   ├── db.cjs              # Neon pool (query/one/many/tx)
│   ├── crm.cjs             # CRM helpers (leads/companies/activities/scores)
│   ├── redis.cjs           # ioredis connections
│   ├── queue.cjs           # BullMQ queues + enqueue()
│   ├── memory.cjs          # shared memory (Redis short + PG long)
│   ├── bus.cjs             # agent-to-agent pub/sub + durable inbox
│   ├── agentBase.cjs       # BaseAgent: think/thinkJSON, mem, send, run-tracking
│   ├── llm.cjs             # provider-aware LLM client (openai|anthropic)
│   ├── rbac.cjs            # roles → permissions, express guard
│   └── audit.cjs           # append-only audit log
│
├── db/
│   ├── schema.sql          # all ait_* tables (idempotent)
│   ├── migrate.cjs
│   └── seed.cjs
│
├── departments/
│   ├── lead-intel/         # 1. sources.cjs enrich.cjs agent.cjs service.cjs routes.cjs
│   ├── sdr/                # 2. channels.cjs agent.cjs service.cjs routes.cjs
│   ├── voice/              # 3. agent.cjs adapter.cjs service.cjs routes.cjs voice_service.py
│   ├── proposal/           # 4. agent.cjs pdf.cjs service.cjs routes.cjs
│   ├── content/            # 5. agent.cjs service.cjs routes.cjs
│   └── client-success/     # 6. agent.cjs service.cjs routes.cjs
│
├── gateway/                # API gateway
│   ├── server.cjs
│   └── middleware.cjs      # attachUser (brand/role), auditWrites
│
├── workers/index.cjs       # BullMQ task-queue workers
│
├── dashboard/              # 7. CEO dashboard
│   ├── server.cjs
│   ├── routes.cjs
│   ├── metrics.cjs
│   └── public/index.html
│
├── control/bot.cjs         # Telegram control panel
├── scripts/smoke.cjs       # end-to-end test
└── docs/                   # 01..10 deliverables
```

### Module contract (every department)
- `agent.cjs` — class extends `BaseAgent`; pure reasoning (LLM in/out).
- `service.cjs` — orchestration: calls agent + CRM + queue + bus; owns DB writes.
- `routes.cjs` — thin Express router, RBAC-guarded, delegates to service.
- adapters (`channels/sources/adapter`) — external I/O with mock|live modes.
