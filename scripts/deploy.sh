#!/usr/bin/env bash
# Deploy script for ai-team on AWS EC2 Ubuntu.
# Order: pull → install → migrate → reload → health-check → watch logs
set -euo pipefail

PORT=${PORT:-4100}
HEALTH_URL="http://localhost:${PORT}/health"
LOG_WATCH_SEC=300   # 5 minutes

echo "=== [1/5] git pull ==="
git pull --ff-only

echo "=== [2/5] npm install (production) ==="
npm install --omit=dev --no-audit --no-fund

echo "=== [3/5] db migrate ==="
node db/migrate.cjs

echo "=== [4/5] pm2 reload --update-env ==="
mkdir -p logs
pm2 reload ecosystem.config.js --update-env

echo "=== [5/5] health check ==="
sleep 3
for i in 1 2 3 4 5; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "  health OK (attempt $i)"
    break
  fi
  echo "  attempt $i: status=$STATUS — retrying in 3s..."
  sleep 3
  if [ "$i" = "5" ]; then
    echo "  HEALTH CHECK FAILED after 5 attempts. Check logs."
    pm2 logs --lines 50
    exit 1
  fi
done

echo "=== Watching logs for ${LOG_WATCH_SEC}s (Ctrl-C to stop) ==="
pm2 logs --lines 20 &
LOGS_PID=$!
sleep "$LOG_WATCH_SEC"
kill "$LOGS_PID" 2>/dev/null || true

echo "=== Deploy complete ==="
pm2 status
