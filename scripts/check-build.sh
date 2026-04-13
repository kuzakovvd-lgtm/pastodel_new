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
  "dist/katalog/index.html"
  "dist/partneram/index.html"
  "dist/_astro"
  "dist/favicon.svg"
  "dist/release-meta.json"
)

for path in "${required[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "[check-build] Missing required artifact: $path" >&2
    exit 1
  fi
done

if [[ ! -f "dist/robots.txt" ]]; then
  echo "[check-build] Missing required artifact: dist/robots.txt" >&2
  exit 1
fi

if [[ ! -f "dist/sitemap-index.xml" && ! -f "dist/sitemap-0.xml" ]]; then
  echo "[check-build] Missing required sitemap artifact in dist/" >&2
  exit 1
fi

if ! grep -q '"gitSha"' dist/release-meta.json || ! grep -q '"buildTimeUtc"' dist/release-meta.json; then
  echo "[check-build] release-meta.json is missing required keys (gitSha/buildTimeUtc)" >&2
  exit 1
fi

echo "[check-build] Checking broken image links in dist..."
scripts/check-image-links.sh

echo "[check-build] Route directories:"
find dist -maxdepth 1 -type d | sed 's#^dist##' | sort

echo "[check-build] Done."
