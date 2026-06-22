# 09 — Security Plan

## Tenancy & access
- **Multi-tenant isolation**: every row carries `brand_id`; every query filters by
  it. Gateway derives `req.brandId` from `x-brand-id` (never trust body).
- **RBAC** (`core/rbac.cjs`): roles `owner|admin|sales|marketing|cs|viewer` →
  action permissions (`dept:read|write`). Enforced per route. Telegram restricted
  to `TELEGRAM_ALLOWED_USER_IDS`.
- **Auth**: dev uses `x-user-email` lookup; **production must** swap
  `attachUser()` for verified JWT/session (issue tokens carrying `brand_id`+`role`).
  Put the gateway behind Nginx + TLS; never expose it raw.

## Secrets
- All credentials in `.env` (git-ignored). No secrets in code or logs.
- Reuse ECM's secret hygiene; rotate `LLM_API_KEY`, Gmail app password, WhatsApp
  token, Telegram token. Don't clobber `~/.claude/settings.json` env block.

## Audit & traceability
- **Append-only** `ait_audit_log` for every write (actor, action, entity, status).
- Every agent action is an `ait_agent_run` (inputs/outputs/errors/latency).
- Agent-to-agent messages persisted in `ait_agent_messages`.

## Data protection
- Neon over TLS. PII (lead emails/phones) minimized; `raw` jsonb only for source
  provenance. Honor **unsubscribe** (sets status=lost, pauses enrollments).
- Retention: prune old `ait_agent_runs`/`audit_log` on a schedule if needed.

## Outreach compliance (important, free-first ≠ consequence-free)
- **LinkedIn/Google Maps scraping** carries ToS risk → shipped as opt-in
  `TODO(live)` adapters, mock by default. Prefer official/partner data or consented
  sources for real campaigns.
- Email/WhatsApp: include opt-out, respect anti-spam (CAN-SPAM / local TRAI rules),
  rate-limit sends, warm up domains. Human approval gate before live sends.
- Voice calls: comply with DND registries and consent/recording laws.

## LLM safety
- Provider isolation via `LLM_*`. Prompts are scoped, JSON-validated, clamped
  (e.g. scores 0–100). No secrets sent to the model. Treat model output as
  untrusted (never `eval`, parameterized SQL only).

## Hardening checklist
- [ ] JWT auth on gateway  [ ] TLS via Nginx  [ ] rate limiting
- [ ] per-tenant API keys  [ ] approval gate on live send/publish
- [ ] secret rotation       [ ] audit log review  [ ] DND/unsubscribe enforced
