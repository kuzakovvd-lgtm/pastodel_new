#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<USAGE
Usage:
  scripts/deploy-preview.sh [--apply] [--skip-build] [--release <id>]

Environment variables:
  DEPLOY_HOST   (required) target server hostname or IP
  DEPLOY_USER   (default: root)
  DEPLOY_BASE   (default: /var/www/pastodel_new)
  SSH_PORT      (default: 22)

Behavior:
  - Default mode is dry-run (prints commands only).
  - --apply executes upload/extract/symlink steps.
  - The script deploys to a separate directory and never touches live pastodel root.
USAGE
}

APPLY=0
SKIP_BUILD=0
RELEASE_ID="$(date +%Y%m%d-%H%M%S)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --release)
      RELEASE_ID="${2:-}"
      if [[ -z "$RELEASE_ID" ]]; then
        echo "[deploy-preview] --release requires value" >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[deploy-preview] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/pastodel_new}"
DEPLOY_OWNER_GROUP="${DEPLOY_OWNER_GROUP:-root:root}"
SSH_PORT="${SSH_PORT:-22}"

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "[deploy-preview] DEPLOY_HOST is required" >&2
  exit 1
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "[deploy-preview] Running build check..."
  scripts/check-build.sh
else
  echo "[deploy-preview] Build step skipped by --skip-build"
fi

if [[ ! -d dist ]]; then
  echo "[deploy-preview] dist directory not found" >&2
  exit 1
fi

SSH_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_CMD=(ssh -p "$SSH_PORT" -o BatchMode=yes "$SSH_TARGET")
RELEASE_DIR="${DEPLOY_BASE}/releases/${RELEASE_ID}"

REMOTE_PREP="mkdir -p '${RELEASE_DIR}' '${DEPLOY_BASE}/releases'"
REMOTE_LINK="ln -sfn '${RELEASE_DIR}' '${DEPLOY_BASE}/current'"
REMOTE_OWNER="chown -R '${DEPLOY_OWNER_GROUP}' '${RELEASE_DIR}' && chown -h '${DEPLOY_OWNER_GROUP}' '${DEPLOY_BASE}/current'"
REMOTE_PERMS="find '${DEPLOY_BASE}' -type d -exec chmod 755 {} +; find '${DEPLOY_BASE}' -type f -exec chmod 644 {} +"

echo "[deploy-preview] Target host: ${SSH_TARGET}:${SSH_PORT}"
echo "[deploy-preview] Target release: ${RELEASE_DIR}"

if [[ "$APPLY" -eq 0 ]]; then
  cat <<DRYRUN
[deploy-preview] Dry-run mode. Commands that would be executed:
  ${SSH_CMD[*]} "$REMOTE_PREP"
  COPYFILE_DISABLE=1 tar -C dist -cf - . | ${SSH_CMD[*]} "tar -xf - -C '${RELEASE_DIR}'"
  ${SSH_CMD[*]} "find '${RELEASE_DIR}' -name '._*' -type f -delete"
  ${SSH_CMD[*]} "$REMOTE_LINK"
  ${SSH_CMD[*]} "$REMOTE_OWNER"
  ${SSH_CMD[*]} "$REMOTE_PERMS"
DRYRUN
  exit 0
fi

echo "[deploy-preview] Creating release directory on server..."
"${SSH_CMD[@]}" "$REMOTE_PREP"

echo "[deploy-preview] Uploading dist/ to release directory..."
COPYFILE_DISABLE=1 tar -C dist -cf - . | "${SSH_CMD[@]}" "tar -xf - -C '${RELEASE_DIR}'"

echo "[deploy-preview] Cleaning macOS metadata files if present..."
"${SSH_CMD[@]}" "find '${RELEASE_DIR}' -name '._*' -type f -delete"

echo "[deploy-preview] Switching current symlink to new release..."
"${SSH_CMD[@]}" "$REMOTE_LINK"

echo "[deploy-preview] Normalizing ownership (${DEPLOY_OWNER_GROUP})..."
"${SSH_CMD[@]}" "$REMOTE_OWNER"

echo "[deploy-preview] Normalizing permissions under ${DEPLOY_BASE}..."
"${SSH_CMD[@]}" "$REMOTE_PERMS"

echo "[deploy-preview] Done. Preview root is now ${DEPLOY_BASE}/current"
