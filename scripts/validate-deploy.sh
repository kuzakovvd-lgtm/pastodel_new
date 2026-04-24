#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${BASE_URL:-https://pastodel.ru}"
HTTP_BASE_URL="${HTTP_BASE_URL:-http://pastodel.ru}"

echo "[validate-deploy] BASE_URL=${BASE_URL}"

BASE_URL="$BASE_URL" scripts/smoke-preview.sh
BASE_URL="$BASE_URL" scripts/check-image-links.sh

echo "[validate-deploy] Checking key routes HTTP status..."
routes=(
  "/"
  "/katalog/"
  "/partneram/"
  "/horeca/"
  "/kontakty/"
  "/robots.txt"
  "/sitemap-index.xml"
  "/release-meta.json"
)

for route in "${routes[@]}"; do
  code="$(curl -ks --compressed --connect-timeout 5 --max-time 20 -o /dev/null -w "%{http_code}" "${BASE_URL}${route}")"
  if [[ "$code" != "200" ]]; then
    echo "[validate-deploy] FAIL ${route} returned ${code}" >&2
    exit 1
  fi
  echo "[validate-deploy] OK ${route} -> 200"
done

if [[ "$BASE_URL" == "https://pastodel.ru" ]]; then
  redirect_target="$(curl -sI "$HTTP_BASE_URL/" | awk -F': ' 'tolower($1)=="location" {gsub("\r","",$2); print $2}' | head -n1)"
  if [[ "$redirect_target" != "https://pastodel.ru/" ]]; then
    echo "[validate-deploy] FAIL HTTP redirect target mismatch: ${redirect_target}" >&2
    exit 1
  fi
  echo "[validate-deploy] OK HTTP -> HTTPS redirect"
fi

meta_tmp="$(mktemp)"
trap 'rm -f "$meta_tmp"' EXIT
curl -ks --compressed --connect-timeout 5 --max-time 20 "${BASE_URL}/release-meta.json" > "$meta_tmp"
if ! grep -q '"gitSha"' "$meta_tmp" || ! grep -q '"buildTimeUtc"' "$meta_tmp"; then
  echo "[validate-deploy] FAIL release-meta.json missing required fields" >&2
  exit 1
fi
echo "[validate-deploy] OK release-meta.json contract"

echo "[validate-deploy] All checks passed"
