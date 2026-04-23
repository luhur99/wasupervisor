#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wa-supervisor}"
BRANCH="${BRANCH:-main}"
NODE_ENV="${NODE_ENV:-production}"

cd "${APP_DIR}"

echo "[1/7] Syncing source (${BRANCH})"
git fetch origin
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT_BRANCH}" != "${BRANCH}" ]]; then
  git checkout "${BRANCH}"
fi
git pull --ff-only origin "${BRANCH}"

echo "[2/7] Installing dependencies"
npm ci --omit=dev

echo "[3/7] Ensuring log directories"
mkdir -p logs uploads/responses

echo "[4/7] Running DB migrations"
node migrations/migrate.js

echo "[5/7] Reloading PM2 apps"
if pm2 describe wa-supervisor >/dev/null 2>&1; then
  NODE_ENV="${NODE_ENV}" pm2 reload ecosystem.config.js --update-env
else
  NODE_ENV="${NODE_ENV}" pm2 start ecosystem.config.js --env production
fi

echo "[6/7] Saving PM2 process list"
pm2 save

echo "[7/7] Verifying health endpoint"
if command -v curl >/dev/null 2>&1; then
  curl -fsS http://127.0.0.1:3000/health || true
fi

echo "Deploy complete."
