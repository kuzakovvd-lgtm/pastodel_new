#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8081}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

routes=(
  "/"
  "/katalog/"
  "/katalog/karbonara/"
  "/katalog/horeca/karbonara/"
  "/partneram/"
  "/horeca/"
  "/stat-partnerom/"
  "/kontakty/"
  "/o-kompanii/"
  "/gde-kupit/"
  "/otzyvy/"
  "/dokumenty/"
  "/novosti/"
  "/proizvodstvo-i-kachestvo/"
  "/politika-konfidentsialnosti/"
  "/soglasie-na-obrabotku-dannyh/"
)
key_smoke_routes=(
  "/"
  "/katalog/"
)

is_key_smoke_route() {
  local route="$1"
  for key in "${key_smoke_routes[@]}"; do
    if [[ "$route" == "$key" ]]; then
      return 0
    fi
  done
  return 1
}

request_status() {
  local url="$1"
  local range_mode="${2:-0}"
  local code rc

  set +e
  if [[ "$range_mode" == "1" ]]; then
    code="$(curl -sI --retry 3 --retry-delay 1 --retry-all-errors --connect-timeout 5 --max-time 20 -o /dev/null -w "%{http_code}" "$url")"
  else
    code="$(curl -s --retry 3 --retry-delay 1 --retry-all-errors --connect-timeout 5 --max-time 20 -o /dev/null -w "%{http_code}" "$url")"
  fi
  rc=$?
  if [[ "$range_mode" == "1" && ( "$rc" -ne 0 || "$code" == "405" || "$code" == "403" ) ]]; then
    code="$(curl -s --retry 3 --retry-delay 1 --retry-all-errors --connect-timeout 5 --max-time 20 -H 'Range: bytes=0-0' -o /dev/null -w "%{http_code}" "$url")"
    rc=$?
  fi
  if [[ "$rc" -ne 0 && "$range_mode" == "1" ]]; then
    code="$(curl -s --retry 2 --retry-delay 1 --retry-all-errors --connect-timeout 5 --max-time 35 -o /dev/null -w "%{http_code}" "$url")"
    rc=$?
  fi
  set -e

  if [[ "$rc" -ne 0 ]]; then
    echo "CURL_ERROR:${rc}"
    return 0
  fi

  echo "$code"
}

fetch_to_file() {
  local url="$1"
  local out_file="$2"
  local rc

  set +e
  curl -sS --retry 3 --retry-delay 1 --retry-all-errors --connect-timeout 5 --max-time 30 "$url" > "$out_file"
  rc=$?
  set -e
  return "$rc"
}

check_status() {
  local path="$1"
  local code
  code="$(request_status "${BASE_URL}${path}")"
  if [[ "$code" != "200" ]]; then
    echo "[smoke] FAIL status ${code} for ${path}" >&2
    return 1
  fi
  echo "[smoke] OK status 200 ${path}"
}

check_html_meta() {
  local path="$1"
  local out="$TMP_DIR/page.html"
  if ! fetch_to_file "${BASE_URL}${path}" "$out"; then
    echo "[smoke] FAIL cannot fetch ${path}" >&2
    return 1
  fi

  if ! grep -qi "<title>" "$out"; then
    echo "[smoke] FAIL missing <title> on ${path}" >&2
    return 1
  fi

  if ! grep -qi "<link rel=\"canonical\"" "$out"; then
    echo "[smoke] FAIL missing canonical on ${path}" >&2
    return 1
  fi

  if grep -qiE "canonical\" href=\"https?://127\\.0\\.0\\.1|canonical\" href=\"https?://localhost" "$out"; then
    echo "[smoke] FAIL canonical points to preview host on ${path}" >&2
    return 1
  fi

  if ! grep -qiE "canonical\" href=\"https://pastodel\.ru/" "$out"; then
    echo "[smoke] FAIL canonical does not use production host on ${path}" >&2
    return 1
  fi

  echo "[smoke] OK title+canonical ${path}"
}

check_assets() {
  local path="$1"
  local out="$TMP_DIR/page-assets.html"
  local assets_file="$TMP_DIR/assets.txt"
  if ! fetch_to_file "${BASE_URL}${path}" "$out"; then
    echo "[smoke] FAIL cannot fetch assets page ${path}" >&2
    return 1
  fi

  grep -Eo '(href|src)="/[^"#?]+(\?[^"#]*)?"' "$out" \
    | sed -E 's/^(href|src)="//; s/"$//' \
    | grep -E '^/(_astro|images|fonts|favicon|assets)' \
    | sort -u > "$assets_file" || true

  local failed=0
  while IFS= read -r asset; do
    [[ -z "$asset" ]] && continue
    local code
    code="$(request_status "${BASE_URL}${asset}" 1)"
    if [[ "$code" != "200" && "$code" != "206" ]]; then
      echo "[smoke] FAIL asset ${code} ${asset} (from ${path})" >&2
      failed=1
    fi
  done < "$assets_file"

  if [[ "$failed" -ne 0 ]]; then
    return 1
  fi

  echo "[smoke] OK assets ${path}"
}

check_key_images() {
  local assets_file="$TMP_DIR/key-images.txt"
  : > "$assets_file"

  for path in "${key_smoke_routes[@]}"; do
    local out="$TMP_DIR/key-route.html"
    if ! fetch_to_file "${BASE_URL}${path}" "$out"; then
      echo "[smoke] FAIL cannot fetch key route ${path}" >&2
      return 1
    fi
    grep -Eo '(src|srcset)="/[^"#?]+(\?[^"#]*)?"' "$out" \
      | sed -E 's/^(src|srcset)="//; s/"$//' \
      | grep -E '^/(_astro|images)/.+\.(avif|webp|png|jpe?g|gif|svg|ico)$' \
      | sed -E 's/[?#].*$//' \
      | sort -u >> "$assets_file" || true
  done

  sort -u "$assets_file" -o "$assets_file"

  local astro_count
  local images_count
  astro_count="$(grep -c '^/_astro/' "$assets_file" || true)"
  images_count="$(grep -c '^/images/' "$assets_file" || true)"

  if [[ "$astro_count" -eq 0 ]]; then
    echo "[smoke] FAIL no key images from /_astro/* on routes / and /katalog/" >&2
    return 1
  fi
  if [[ "$images_count" -eq 0 ]]; then
    echo "[smoke] FAIL no key images from /images/* on routes / and /katalog/" >&2
    return 1
  fi

  local checked=0
  local failed=0
  local asset code
  while IFS= read -r asset; do
    [[ -z "$asset" ]] && continue
    code="$(request_status "${BASE_URL}${asset}" 1)"
    if [[ "$code" != "200" && "$code" != "206" ]]; then
      echo "[smoke] FAIL key image ${code} ${asset}" >&2
      failed=1
      continue
    fi
    checked=$((checked + 1))
  done < <(
    {
      grep '^/_astro/' "$assets_file" | head -n 3 || true
      grep '^/images/' "$assets_file" | head -n 3 || true
    } | sort -u
  )

  if [[ "$checked" -eq 0 ]]; then
    echo "[smoke] FAIL no key images selected for checks" >&2
    return 1
  fi
  if [[ "$failed" -ne 0 ]]; then
    return 1
  fi

  echo "[smoke] OK key images on /, /katalog/, /_astro/*, /images/*"
}

echo "[smoke] Base URL: ${BASE_URL}"
for route in "${routes[@]}"; do
  check_status "$route"
  check_html_meta "$route"
  if is_key_smoke_route "$route"; then
    check_assets "$route"
  fi
done
check_key_images

robots_file="$TMP_DIR/robots.txt"
if ! fetch_to_file "${BASE_URL}/robots.txt" "$robots_file"; then
  echo "[smoke] FAIL cannot fetch robots.txt" >&2
  exit 1
fi
robots="$(cat "$robots_file")"
if ! printf "%s" "$robots" | grep -Eq 'Sitemap:[[:space:]]+https://pastodel\.ru/sitemap-index\.xml'; then
  echo "[smoke] FAIL robots sitemap does not target production host" >&2
  exit 1
fi
if printf "%s" "$robots" | grep -Eqi '127\.0\.0\.1|localhost'; then
  echo "[smoke] FAIL robots references preview host" >&2
  exit 1
fi
echo "[smoke] OK robots.txt"

sitemap_file="$TMP_DIR/sitemap-index.xml"
if ! fetch_to_file "${BASE_URL}/sitemap-index.xml" "$sitemap_file"; then
  echo "[smoke] FAIL cannot fetch sitemap-index.xml" >&2
  exit 1
fi
sitemap_index="$(cat "$sitemap_file")"
if [[ -z "$sitemap_index" ]]; then
  echo "[smoke] FAIL empty sitemap-index.xml" >&2
  exit 1
fi
if ! printf "%s" "$sitemap_index" | grep -q 'https://pastodel\.ru/'; then
  echo "[smoke] FAIL sitemap-index.xml missing production host URLs" >&2
  exit 1
fi
if printf "%s" "$sitemap_index" | grep -Eqi '127\.0\.0\.1|localhost'; then
  echo "[smoke] FAIL sitemap-index.xml references preview host" >&2
  exit 1
fi
echo "[smoke] OK sitemap-index.xml"

forms_page="$TMP_DIR/forms.html"
if ! fetch_to_file "${BASE_URL}/partneram/" "$forms_page"; then
  echo "[smoke] FAIL cannot fetch /partneram/" >&2
  exit 1
fi
if ! grep -q "Интеграция с production endpoint будет подключена после подтверждения API" "$forms_page"; then
  echo "[smoke] FAIL forms placeholder note missing on /partneram/" >&2
  exit 1
fi
if ! grep -Eq 'FormRuntime\.astro_astro_type_script_index_0_lang\.' "$forms_page"; then
  echo "[smoke] FAIL FormRuntime client script missing on /partneram/" >&2
  exit 1
fi
echo "[smoke] OK forms placeholder-safe runtime"

echo "[smoke] All checks passed"
