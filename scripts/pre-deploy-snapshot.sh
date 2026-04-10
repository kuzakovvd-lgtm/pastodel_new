#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<USAGE
Usage:
  DEPLOY_HOST=<host> [DEPLOY_USER=root] scripts/pre-deploy-snapshot.sh

Environment variables:
  DEPLOY_HOST       required target server host/IP
  DEPLOY_USER       default: root
  DEPLOY_BASE       default: /var/www/pastodel_new
  SNAPSHOT_BASE     default: /var/backups/pastodel-snapshots
  NGINX_SITE_FILE   default: /etc/nginx/sites-enabled/pastodel.ru
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/pastodel_new}"
SNAPSHOT_BASE="${SNAPSHOT_BASE:-/var/backups/pastodel-snapshots}"
NGINX_SITE_FILE="${NGINX_SITE_FILE:-/etc/nginx/sites-enabled/pastodel.ru}"
SSH_PORT="${SSH_PORT:-22}"

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "[snapshot] DEPLOY_HOST is required" >&2
  exit 1
fi

SSH_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_CMD=(ssh -p "$SSH_PORT" -o BatchMode=yes "$SSH_TARGET")

timestamp_utc="$(date -u +%Y%m%d-%H%M%S)"
snapshot_dir="${SNAPSHOT_BASE}/${timestamp_utc}"

echo "[snapshot] Creating pre-deploy snapshot on ${SSH_TARGET}"

"${SSH_CMD[@]}" "bash -s" <<EOF
set -euo pipefail

DEPLOY_BASE='${DEPLOY_BASE}'
SNAPSHOT_DIR='${snapshot_dir}'
NGINX_SITE_FILE='${NGINX_SITE_FILE}'

mkdir -p "\${SNAPSHOT_DIR}"

CURRENT_TARGET="\$(readlink -f "\${DEPLOY_BASE}/current" || true)"
CURRENT_LINK="\$(readlink "\${DEPLOY_BASE}/current" || true)"
TS_ISO="\$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if [[ -n "\${CURRENT_TARGET}" && -d "\${CURRENT_TARGET}" ]]; then
  TARGET_NAME="\$(basename "\${CURRENT_TARGET}")"
  tar -C "\$(dirname "\${CURRENT_TARGET}")" -czf "\${SNAPSHOT_DIR}/release-\${TARGET_NAME}.tar.gz" "\${TARGET_NAME}"
fi

if [[ -f "\${NGINX_SITE_FILE}" ]]; then
  cp "\${NGINX_SITE_FILE}" "\${SNAPSHOT_DIR}/pastodel.ru.nginx.conf"
fi

if [[ -f /etc/nginx/nginx.conf ]]; then
  cp /etc/nginx/nginx.conf "\${SNAPSHOT_DIR}/nginx.conf"
fi

ls -lah /var/log/nginx/pastodel*.log /var/log/nginx/pastodel*.log.* 2>/dev/null > "\${SNAPSHOT_DIR}/log-files.txt" || true
wc -c /var/log/nginx/pastodel*.log 2>/dev/null > "\${SNAPSHOT_DIR}/log-byte-offsets.txt" || true

cat > "\${SNAPSHOT_DIR}/snapshot-meta.json" <<META
{
  "snapshotCreatedAtUtc": "\${TS_ISO}",
  "deployBase": "\${DEPLOY_BASE}",
  "currentSymlink": "\${CURRENT_LINK}",
  "currentTarget": "\${CURRENT_TARGET}",
  "nginxSiteFile": "\${NGINX_SITE_FILE}"
}
META

echo "SNAPSHOT_DIR=\${SNAPSHOT_DIR}"
echo "CURRENT_TARGET=\${CURRENT_TARGET}"
echo "METADATA_FILE=\${SNAPSHOT_DIR}/snapshot-meta.json"
EOF

echo "[snapshot] Snapshot completed"
