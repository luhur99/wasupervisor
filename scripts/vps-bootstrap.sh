#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/vps-bootstrap.sh"
  exit 1
fi

APP_USER="${APP_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/wa-supervisor}"
NODE_MAJOR="${NODE_MAJOR:-20}"

echo "[1/6] Installing system packages"
apt-get update
apt-get install -y curl ca-certificates gnupg lsb-release software-properties-common nginx certbot python3-certbot-nginx postgresql postgresql-contrib build-essential

if ! command -v node >/dev/null 2>&1; then
  echo "[2/6] Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
else
  echo "[2/6] Node.js already installed: $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[3/6] Installing PM2"
  npm install -g pm2
else
  echo "[3/6] PM2 already installed: $(pm2 -v)"
fi

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  echo "[4/6] Creating app user ${APP_USER}"
  useradd -m -s /bin/bash "${APP_USER}"
else
  echo "[4/6] App user exists: ${APP_USER}"
fi

echo "[5/6] Preparing app directory ${APP_DIR}"
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

cat <<EOF
[6/6] Bootstrap complete.
Next steps:
1. Clone repo as ${APP_USER} into ${APP_DIR}
2. Copy .env.example to .env and fill production values
3. Run deploy script as ${APP_USER}: bash scripts/vps-deploy.sh
4. Configure Nginx from deploy/nginx/wa-supervisor.conf
EOF
