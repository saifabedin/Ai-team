# ai-team-core

Use for all shared infrastructure work on AI-Team — core agent framework, bus, config, db, LLM client, memory, queue, RBAC, autopilot, ECM bridge.

## Structure (`core/`)
| File | Purpose |
|------|---------|
| `agentBase.cjs` | BaseAgent class: `think()`, `thinkJSON()`, `mem()`, `send()`, `run()` |
| `agents.cjs` | ROSTER: 18 agents across 3 teams |
| `autopilot.cjs` | 24/7 heartbeat loop, multi-brand, 60s cycles |
| `bus.cjs` | Agent-to-agent Redis pub/sub + Postgres durable inbox |
| `config.cjs` | Typed env var loader |
| `crm.cjs` | Company, lead, score, activity helpers |
| `db.cjs` | Neon Postgres pool: `query/one/many/tx` |
| `ecm-bridge.cjs` | Bridge to ECM AI OS engines 1-8 |
| `llm.cjs` | Provider-aware LLM client (OpenAI-compatible or Anthropic) |
| `memory.cjs` | Redis short-term + Postgres long-term memory |
| `queue.cjs` | BullMQ queue factory (22 named queues) |
| `rbac.cjs` | Role-based permissions (11 roles) |
| `redis.cjs` | ioredis connection factory |
| `sanitize.cjs` | Prompt injection sanitization |

## Patterns
- All agents extend BaseAgent
- Agent communication via `bus.send()` → Postgres inbox
- Every agent action tracked in `ait_agent_runs` table
- Autopilot cycles: enrich → score → enroll → re-engage → social → FML Health

## Commands
```bash
node core/autopilot.cjs     # start autopilot
node core/queue.cjs         # test queue setup
```

## Gotchas
- ECM bridge hardcodes `/home/ubuntu/ecm-ai-os/backend/engines` — breaks portability
- Autopilot logs are NOT real-time through dashboard (check `logs/`)
- Redis connection failure = no agent communication
