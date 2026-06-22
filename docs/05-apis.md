# 05 — APIs

All routes are mounted by the gateway (`:4100`) under `/api/*`. Every request:
- `x-brand-id: <brand>` (default `ecm`) — tenant.
- `x-user-email: <email>` — resolves role for RBAC (falls back to owner in dev).
- State-changing requests are audited.

## Auth / meta
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | gateway liveness |
| GET | `/me` | resolved brand + user/role |

## 1. Lead Intelligence `/api/lead-intel`
| Method | Path | Perm | Body |
|---|---|---|---|
| GET | `/leads?status=&limit=` | lead-intel:read | — |
| POST | `/source` | lead-intel:write | `{source:'gmaps'|'web'|'linkedin'|'directory', query, url?, limit}` |
| POST | `/leads/:id/enrich` | lead-intel:write | — |
| POST | `/leads/:id/score` | lead-intel:write | — |
| POST | `/run` | lead-intel:write | source+enrich+score inline |

## 2. SDR `/api/sdr`
| POST | `/enroll` | sdr:write | `{leadId, sequenceId?}` |
| POST | `/enrollments/:id/run` | sdr:write | send next step |
| POST | `/leads/:id/reply` | sdr:write | `{text}` → objection handling |
| POST | `/leads/:id/book` | sdr:write | `{notes?}` |

## 3. Voice `/api/voice`
| POST | `/leads/:id/call` | voice:write | `{purpose?}` |
| POST | `/meetings/:id/confirm` | voice:write | — |

## 4. Proposal `/api/proposal`
| GET | `/` | proposal:read | list |
| POST | `/generate` | proposal:write | `{leadId, kind:'proposal'|'quote'|'contract'|'followup', brief?}` |
| POST | `/:id/send` | proposal:write | — |

## 5. Content `/api/content`
| GET | `/` | content:read | list |
| POST | `/generate` | content:write | `{kind:'social'|'blog'|'ad'|'video_script'|'brief', topic, platform?, count?}` |
| POST | `/:id/approve` | content:write | — |

## 6. Client Success `/api/success`
| GET | `/clients` | success:read | list |
| POST | `/onboard` | success:write | `{leadId?, name, mrr?}` |
| GET | `/clients/:id/status` | success:read | status email |
| POST | `/clients/:id/upsell` | success:write | upsell suggestion |

## 7. Dashboard `/api/dashboard`
| GET | `/overview` | dashboard:read | KPIs + funnel |
| GET | `/today` | dashboard:read | today's activity |
| GET | `/team` | dashboard:read | per-agent performance |
| GET | `/audit?limit=` | audit:read | recent audit log |

## External free integrations (live mode)
- **Gmail** (SMTP app password) — outbound email.
- **WhatsApp** — self-hosted HTTP API (e.g. wppconnect/Baileys).
- **Telephony** — any SIP/voice API bridged via `voice_service.py`.
- **Notion / Google Sheets** — optional sinks (`NOTION_TOKEN`, `GOOGLE_SHEETS_WEBHOOK`).
- **n8n** — can call these endpoints as webhook actions (see `/ecm-n8n`).

## Example
```bash
curl -X POST localhost:4100/api/lead-intel/run \
  -H 'content-type: application/json' -H 'x-brand-id: ecm' \
  -d '{"source":"gmaps","query":"dentists pune","limit":3}'
```
