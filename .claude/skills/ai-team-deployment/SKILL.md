# ai-team-deployment

Use for deployment, infrastructure, and operations — Docker, PM2, EC2, Nginx, monitoring.

## Deployment Options

### PM2 (Current)
```bash
pm2 start ecosystem.config.js         # start all 5 processes
pm2 reload all --update-env           # reload after .env change
pm2 logs ai-team-gateway --lines 50   # tail logs
```

### Docker Compose
```bash
docker compose up -d                   # start all 6 services
docker compose logs -f                 # follow logs
```

## Services
| Process | Port | Memory |
|---------|------|--------|
| gateway | :4100 | 512M |
| worker | — | 512M |
| dashboard | :4101 | 200M |
| control | — | 200M |
| autopilot | — | 400M |

## Deployment Script
```bash
bash scripts/deploy.sh    # git pull → npm install → migrate → pm2 reload → health check
```

## Smoke Test
```bash
npm run smoke              # end-to-end revenue path test
npm run check              # fast single-lead LLM + scoring check
```

## Gotchas
- Redis must be running BEFORE any process starts
- `.env` has LIVE credentials — never commit
- Autopilot restart_delay is 10s (wait for Redis/DB)
- Nginx reverse proxy config not in repo
- SSL via Let's Encrypt (certificates on server, not in repo)
