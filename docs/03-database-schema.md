# 03 — Database Schema

Neon Postgres, shared with ECM. All tables prefixed `ait_`, all rows scoped by
`brand_id` (multi-tenant). Full DDL in `db/schema.sql` (idempotent). Apply with
`npm run migrate`.

## Tables (20)

### Identity / access
- **ait_users** — `brand_id, email, name, role, telegram_id`. Roles drive RBAC.

### CRM core
- **ait_companies** — `name, domain(uq per brand), website, industry, size, country, city, socials, source`.
- **ait_leads** — `company_id, full_name, title, email, phone, linkedin_url, website, source, status, owner_user_id, raw`.
  `status`: `new→enriched→scored→contacted→engaged→qualified→meeting→won|lost`.
- **ait_lead_scores** — `lead_id, score(0-100), grade(A-D), reasons[], scored_by`.

### Activity / outreach
- **ait_activities** — timeline: `lead_id, type, direction, channel, subject, body, meta`.
- **ait_sequences** / **ait_sequence_steps** — multi-step cadences (`step_no, delay_hours, channel, template`).
- **ait_enrollments** — lead↔sequence state (`current_step, status, next_run_at`).
- **ait_messages** — every outbound/inbound message (`channel, direction, status, provider`).

### Voice / meetings
- **ait_calls** — `lead_id, status, outcome, transcript, recording_url, duration_sec`.
- **ait_meetings** — `lead_id, scheduled_at, status, channel, link, notes`.

### Proposals / delivery
- **ait_proposals** — `lead_id, kind(proposal|quote|contract), title, body, amount, currency, status, pdf_path`.
- **ait_clients** — `company_id, lead_id, name, status, mrr, health`.
- **ait_projects** / **ait_tasks** — delivery tracking (`status, progress, due_at, assignee`).

### Content
- **ait_content** — `kind(social|blog|ad|video_script|brief), topic, title, body(jsonb), status`.

### Platform (agents/memory/bus/audit)
- **ait_agent_runs** — every agent action: `agent, department, label, status, ms, result, error`. (powers team-perf metrics)
- **ait_agent_memory** — long-term shared memory `(brand_id, namespace, mem_key)` unique, `value jsonb`.
- **ait_agent_messages** — durable agent-to-agent inbox `(from_agent, to_agent, topic, payload)`.
- **ait_audit_log** — append-only `(actor, action, entity, entity_id, meta)`.

## ER (key relationships)
```
ait_companies 1─* ait_leads 1─* ait_lead_scores
                       │ 1─* ait_activities
                       │ 1─* ait_messages
                       │ 1─* ait_calls
                       │ 1─* ait_meetings
                       │ 1─* ait_proposals
                       │ *─* ait_sequences (via ait_enrollments)
ait_clients 1─* ait_projects 1─* ait_tasks
```

## Multi-tenant rule
Every query filters `brand_id = $1`. Gateway injects `req.brandId` from
`x-brand-id` header (default `DEFAULT_BRAND_ID`). Tenant isolation verified the
same way as ECM (`/ecm-brand`).
