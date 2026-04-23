#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/vps-first-run.sh"
  exit 1
fi

APP_USER="${APP_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/wa-supervisor}"
NODE_MAJOR="${NODE_MAJOR:-20}"
BRANCH="${BRANCH:-main}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-wa_supervisor}"
DB_USER="${DB_USER:-wa_supervisor_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [[ -z "${DB_PASSWORD}" ]]; then
  echo "DB_PASSWORD is required."
  echo "Example: sudo DB_PASSWORD='strong_password' bash scripts/vps-first-run.sh"
  exit 1
fi

if [[ ! -f "${APP_DIR}/scripts/vps-bootstrap.sh" ]]; then
  echo "Repository not found in ${APP_DIR}."
  echo "Clone first: git clone https://github.com/luhur99/wasupervisor.git ${APP_DIR}"
  exit 1
fi

set_env_value() {
  local key="$1"
  local value="$2"
  local env_file="$3"

  if grep -qE "^${key}=" "${env_file}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${env_file}"
  else
    echo "${key}=${value}" >> "${env_file}"
  fi
}

echo "[1/6] Running VPS bootstrap"
APP_USER="${APP_USER}" APP_DIR="${APP_DIR}" NODE_MAJOR="${NODE_MAJOR}" bash "${APP_DIR}/scripts/vps-bootstrap.sh"

echo "[2/6] Creating/updating PostgreSQL role and database"
ROLE_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")"
if [[ "${ROLE_EXISTS}" == "1" ]]; then
  sudo -u postgres psql -c "ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}';"
else
  sudo -u postgres psql -c "CREATE ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}';"
fi

DB_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
if [[ "${DB_EXISTS}" != "1" ]]; then
  sudo -u postgres psql -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE \"${DB_NAME}\" TO \"${DB_USER}\";"

echo "[3/6] Preparing .env"
if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
fi

set_env_value "NODE_ENV" "production" "${APP_DIR}/.env"
set_env_value "DB_HOST" "${DB_HOST}" "${APP_DIR}/.env"
set_env_value "DB_PORT" "${DB_PORT}" "${APP_DIR}/.env"
set_env_value "DB_NAME" "${DB_NAME}" "${APP_DIR}/.env"
set_env_value "DB_USER" "${DB_USER}" "${APP_DIR}/.env"
set_env_value "DB_PASSWORD" "${DB_PASSWORD}" "${APP_DIR}/.env"

chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"

echo "[4/6] Running application deploy"
sudo -u "${APP_USER}" -H bash -lc "cd '${APP_DIR}' && APP_DIR='${APP_DIR}' BRANCH='${BRANCH}' NODE_ENV='production' bash scripts/vps-deploy.sh"

echo "[5/6] Enabling PM2 startup"
sudo -u "${APP_USER}" -H bash -lc "pm2 startup systemd -u '${APP_USER}' --hp '/home/${APP_USER}'"

cat <<EOF
[6/6] First-run setup complete.

Next steps:
1. Edit ${APP_DIR}/.env with production API credentials (ANTHROPIC_API_KEY, CLOUDCHAT_API_KEY, etc.)
2. Re-run deploy after env changes: sudo -u ${APP_USER} -H bash -lc 'cd ${APP_DIR} && bash scripts/vps-deploy.sh'
3. Configure Nginx from deploy/nginx/wa-supervisor.conf and enable HTTPS cert
4. Set CloudChat webhook URL to: https://your-domain/webhook/cloudchat
EOF
