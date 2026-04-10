#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

LOCK_DIR="${ROOT_DIR}/.tmp/build.lock"
mkdir -p "${ROOT_DIR}/.tmp"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[build] Another build is already running (lock: ${LOCK_DIR})." >&2
  echo "[build] Wait for it to finish, then rerun 'npm run build'." >&2
  exit 1
fi

trap 'rm -rf "$LOCK_DIR"' EXIT

echo "[build] Running astro build..."
astro build
echo "[build] Writing release metadata..."
scripts/write-release-meta.sh
echo "[build] Done."

