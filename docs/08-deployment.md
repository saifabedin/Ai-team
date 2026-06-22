# 08 — Deployment Plan

Target: the existing ECM EC2 box (eu-north-1), reusing live Neon + Redis + Nginx.
2 cores / 7.6 GB — light footprint by design (mock providers, free models).

## Prerequisites
- Node ≥ 18, Redis reachable (`REDIS_URL`), Neon `DATABASE_URL`.
- `cp .env.example .env` and fill: `DATABASE_URL`, `REDIS_URL`, `LLM_*`.
  (Build wired these from ECM's `.env` + free OpenRouter model.)

## First deploy
```bash
cd ~/ai-team
npm install
npm run migrate        # ait_* tables on Neon (idempotent)
npm run seed           # demo brand + sequence + leads (optional in prod)
npm run smoke          # verify end-to-end (mock mode)
pm2 start ecosystem.config.js
pm2 save
```
PM2 apps: `ai-team-gateway` (:4100), `ai-team-worker`, `ai-team-dashboard`
(:4101), `ai-team-control`.

## Nginx (optional public dashboard/API)
```nginx
location /ai-team/      { proxy_pass http://127.0.0.1:4100/; }
location /ai-team-dash/ { proxy_pass http://127.0.0.1:4101/; }
```
Reload: `sudo nginx -t && sudo systemctl reload nginx`. (Mirror ECM's `/ecm-deploy`.)

## Docker alternative
```bash
docker compose up -d --build      # gateway, worker, dashboard, control
```
(Uncomment the `redis` service for an all-in-one box.)

## Going live (free providers)
Set `PROVIDER_MODE=live` and fill:
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` → `npm i nodemailer` (email).
- `WHATSAPP_API_URL`/`TOKEN` → self-hosted wppconnect/Baileys.
- Voice: run `python3 departments/voice/voice_service.py` (`pip install fastapi
  uvicorn piper-tts faster-whisper`) + a telephony API; set `VOICE_ADAPTER_URL`,
  `TELEPHONY_API_*`.
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALLOWED_USER_IDS` for the control panel.

## Health & ops
- `GET /health` (gateway), `GET /health` (dashboard).
- Logs: `pm2 logs ai-team-*`. Queue health: same Redis as ECM (`/ecm-queue`).
- `ait_agent_runs` + `/api/dashboard/team` = live agent health.

## Rollback
PM2 keeps prior process; `pm2 reload` for zero-downtime. Schema is additive
(`ait_*`, `IF NOT EXISTS`) — never touches ECM tables.
