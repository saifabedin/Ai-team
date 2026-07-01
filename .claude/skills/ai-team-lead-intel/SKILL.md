# ai-team-lead-intel

Use for lead intelligence work — scout agent, lead sourcing, enrichment, scoring, Google Sheets ingestion.

## Structure (`departments/lead-intel/`)
| File | Purpose |
|------|---------|
| `agent.cjs` | Scout agent — LLM-based lead scoring (ICP-aware) |
| `service.cjs` | Source → enrich → score orchestration, sheet ingest |
| `routes.cjs` | HTTP API routes |
| `sources.cjs` | Google Maps, LinkedIn, web crawl, directory scrapers |
| `enrich.cjs` | Email pattern guessing, phone extraction |
| `sheet.cjs` | Google Sheets / CSV parsing |
| `sheets-api.cjs` | Sheets write-back API |

## Flow
```
Lead Source → enrich (email/phone) → score (LLM) → store → SDR enroll
```

## Commands
```bash
curl http://localhost:4100/api/lead-intel/leads?limit=10
```

## Gotchas
- LinkedIn scraping is MOCK only — no real data
- Email enrichment uses pattern guessing (firstname@domain) — low accuracy
- Sheets write-back API key may not be set in .env
- Scoring uses NVIDIA NIM LLM — requires LLM_API_KEY in .env
