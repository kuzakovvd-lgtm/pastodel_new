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

check_status() {
  local path="$1"
  local code
  code="$(curl -s --connect-timeout 5 --max-time 20 -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")"
  if [[ "$code" != "200" ]]; then
    echo "[smoke] FAIL status ${code} for ${path}" >&2
    return 1
  fi
  echo "[smoke] OK status 200 ${path}"
}

check_html_meta() {
  local path="$1"
  local out="$TMP_DIR/page.html"
  curl -s --connect-timeout 5 --max-time 20 "${BASE_URL}${path}" > "$out"

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
  curl -s --connect-timeout 5 --max-time 20 "${BASE_URL}${path}" > "$out"

  grep -Eo '(href|src)="/[^"#?]+(\?[^"#]*)?"' "$out" \
    | sed -E 's/^(href|src)="//; s/"$//' \
    | grep -E '^/(_astro|images|fonts|favicon|assets)' \
    | sort -u > "$assets_file" || true

  local failed=0
  while IFS= read -r asset; do
    [[ -z "$asset" ]] && continue
    local code
    code="$(curl -s --connect-timeout 5 --max-time 20 -o /dev/null -w "%{http_code}" "${BASE_URL}${asset}")"
    if [[ "$code" != "200" ]]; then
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
    curl -s --connect-timeout 5 --max-time 20 "${BASE_URL}${path}" > "$out"
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
    code="$(curl -s --connect-timeout 5 --max-time 20 -o /dev/null -w "%{http_code}" "${BASE_URL}${asset}")"
    if [[ "$code" != "200" ]]; then
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
  check_assets "$route"
done
check_key_images

robots="$(curl -s --connect-timeout 5 --max-time 20 "${BASE_URL}/robots.txt")"
if ! printf "%s" "$robots" | grep -Eq 'Sitemap:[[:space:]]+https://pastodel\.ru/sitemap-index\.xml'; then
  echo "[smoke] FAIL robots sitemap does not target production host" >&2
  exit 1
fi
if printf "%s" "$robots" | grep -Eqi '127\.0\.0\.1|localhost'; then
  echo "[smoke] FAIL robots references preview host" >&2
  exit 1
fi
echo "[smoke] OK robots.txt"

sitemap_index="$(curl -s --connect-timeout 5 --max-time 20 "${BASE_URL}/sitemap-index.xml")"
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
curl -s --connect-timeout 5 --max-time 20 "${BASE_URL}/partneram/" > "$forms_page"
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
