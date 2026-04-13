#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<USAGE
Usage:
  DEPLOY_HOST=<host> [DEPLOY_USER=root] scripts/deploy-safe.sh [--release <id>] [--skip-snapshot]

Behavior:
  1) run pre-deploy snapshot (default)
  2) deploy new release via deploy-preview.sh --apply
  3) validate production via deploy validation checks
  4) print rollback instructions on failure

Notes:
  - Does not remove compatibility assets.
  - Does not auto-delete old releases.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

SKIP_SNAPSHOT=0
RELEASE_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-snapshot)
      SKIP_SNAPSHOT=1
      shift
      ;;
    --release)
      RELEASE_ID="${2:-}"
      if [[ -z "$RELEASE_ID" ]]; then
        echo "[deploy-safe] --release requires value" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "[deploy-safe] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/pastodel_new}"
SSH_PORT="${SSH_PORT:-22}"

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "[deploy-safe] DEPLOY_HOST is required" >&2
  exit 1
fi

SSH_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"

PREV_TARGET=""
if [[ "$SKIP_SNAPSHOT" -eq 0 ]]; then
  snapshot_out="$(DEPLOY_HOST="$DEPLOY_HOST" DEPLOY_USER="$DEPLOY_USER" DEPLOY_BASE="$DEPLOY_BASE" SSH_PORT="$SSH_PORT" scripts/pre-deploy-snapshot.sh)"
  printf "%s\n" "$snapshot_out"
  PREV_TARGET="$(printf "%s\n" "$snapshot_out" | awk -F= '/^CURRENT_TARGET=/{print $2}' | tail -n1)"
else
  PREV_TARGET="$(ssh -p "$SSH_PORT" -o BatchMode=yes "$SSH_TARGET" "readlink -f '${DEPLOY_BASE}/current' || true")"
fi

if [[ -z "$RELEASE_ID" ]]; then
  RELEASE_ID="$(date +%Y%m%d-%H%M%S)"
fi

echo "[deploy-safe] Deploying release ${RELEASE_ID}"
DEPLOY_HOST="$DEPLOY_HOST" DEPLOY_USER="$DEPLOY_USER" DEPLOY_BASE="$DEPLOY_BASE" SSH_PORT="$SSH_PORT" scripts/deploy-preview.sh --apply --release "$RELEASE_ID"

echo "[deploy-safe] Verifying release metadata on remote"
ssh -p "$SSH_PORT" -o BatchMode=yes "$SSH_TARGET" "test -f '${DEPLOY_BASE}/current/release-meta.json'"

echo "[deploy-safe] Running production validation"
if ! BASE_URL='https://pastodel.ru' HTTP_BASE_URL='http://pastodel.ru' scripts/validate-deploy.sh; then
  echo "[deploy-safe] Validation failed after deploy." >&2
  echo "[deploy-safe] Rollback recommendation:" >&2
  if [[ -n "$PREV_TARGET" ]]; then
    cat >&2 <<ROLLBACK
ssh -p ${SSH_PORT} ${SSH_TARGET} "ln -sfn '${PREV_TARGET}' '${DEPLOY_BASE}/current' && nginx -t && systemctl reload nginx"
ROLLBACK
  else
    echo "[deploy-safe] Previous target is unknown. Use snapshot metadata to restore." >&2
  fi
  exit 1
fi

echo "[deploy-safe] Deployment and validation completed successfully"
