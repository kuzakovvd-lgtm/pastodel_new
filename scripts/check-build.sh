#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[check-build] Building project..."
npm run build >/tmp/pastodel-check-build.log 2>&1 || {
  cat /tmp/pastodel-check-build.log
  exit 1
}

echo "[check-build] Build OK."

required=(
  "dist/index.html"
  "dist/_astro"
  "dist/favicon.svg"
)

for path in "${required[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "[check-build] Missing required artifact: $path" >&2
    exit 1
  fi
done

if [[ ! -f "dist/robots.txt" ]]; then
  echo "[check-build] WARN: dist/robots.txt not found (add before cutover if required)."
fi

if [[ ! -f "dist/sitemap-index.xml" && ! -f "dist/sitemap-0.xml" ]]; then
  echo "[check-build] WARN: sitemap files not found in dist (add/generate before cutover)."
fi

echo "[check-build] Route directories:"
find dist -maxdepth 1 -type d | sed 's#^dist##' | sort

echo "[check-build] Done."
