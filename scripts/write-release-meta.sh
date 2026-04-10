#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DIST_DIR="${DIST_DIR:-dist}"
BUILD_TIME_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RELEASE_ID="${RELEASE_ID:-$(date -u +"%Y%m%d-%H%M%S")}"
GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo "unknown")}"
GIT_SHA_SHORT="${GIT_SHA:0:12}"
GIT_BRANCH="${GIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "[release-meta] dist directory not found: $DIST_DIR" >&2
  exit 1
fi

cat > "${DIST_DIR}/release-meta.json" <<EOF
{
  "releaseId": "${RELEASE_ID}",
  "gitSha": "${GIT_SHA}",
  "gitShaShort": "${GIT_SHA_SHORT}",
  "gitBranch": "${GIT_BRANCH}",
  "buildTimeUtc": "${BUILD_TIME_UTC}"
}
EOF

echo "[release-meta] Wrote ${DIST_DIR}/release-meta.json"
