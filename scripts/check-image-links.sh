#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${BASE_URL:-}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

extract_image_paths() {
  local input_file="$1"
  local output_file="$2"

  : > "$output_file"

  grep -Eo '(src|srcset)="[^"]+"' "$input_file" \
    | sed -E 's/^(src|srcset)="//; s/"$//' \
    | while IFS= read -r raw; do
        if [[ "$raw" == *,* ]]; then
          printf "%s\n" "$raw" \
            | tr ',' '\n' \
            | awk '{print $1}'
        else
          printf "%s\n" "$raw"
        fi
      done \
    | sed -E 's/[[:space:]]+$//' \
    | sed -E 's/[?#].*$//' \
    | grep -E '\.(avif|webp|png|jpe?g|gif|svg|ico)$' \
    | grep -vE '^(https?:)?//|^data:' \
    | sort -u > "$output_file" || true
}

check_local_dist_images() {
  if [[ ! -d dist ]]; then
    echo "[img-links] dist directory not found" >&2
    return 1
  fi

  local routes=(
    "dist/index.html"
    "dist/katalog/index.html"
  )
  local failed=0
  local checked=0
  local astro_checked=0
  local images_checked=0
  local html_file image_paths_file image_path resolved

  for html_file in "${routes[@]}"; do
    if [[ ! -f "$html_file" ]]; then
      echo "[img-links] FAIL required route artifact missing: ${html_file}" >&2
      failed=1
      continue
    fi

    image_paths_file="$TMP_DIR/image-paths.txt"
    extract_image_paths "$html_file" "$image_paths_file"

    while IFS= read -r image_path; do
      [[ -z "$image_path" ]] && continue
      checked=$((checked + 1))

      if [[ "$image_path" == /* ]]; then
        resolved="dist${image_path}"
      else
        resolved="$(cd "$(dirname "$html_file")" && realpath -m "$image_path")"
      fi

      if [[ ! -f "$resolved" ]]; then
        echo "[img-links] FAIL missing image asset ${image_path} (referenced in ${html_file#dist/})" >&2
        failed=1
      else
        if [[ "$image_path" == /_astro/* ]]; then
          astro_checked=$((astro_checked + 1))
        fi
        if [[ "$image_path" == /images/* ]]; then
          images_checked=$((images_checked + 1))
        fi
      fi
    done < "$image_paths_file"
  done

  if [[ "$checked" -eq 0 ]]; then
    echo "[img-links] FAIL no image references found in key dist routes" >&2
    return 1
  fi
  if [[ "$astro_checked" -eq 0 ]]; then
    echo "[img-links] FAIL no /_astro/* images found on key dist routes" >&2
    return 1
  fi
  if [[ "$images_checked" -eq 0 ]]; then
    echo "[img-links] FAIL no /images/* images found on key dist routes" >&2
    return 1
  fi

  if [[ "$failed" -ne 0 ]]; then
    return 1
  fi

  echo "[img-links] OK local dist image references (${checked} checked; /_astro=${astro_checked}, /images=${images_checked})"
}

check_remote_images() {
  local routes=("/" "/katalog/")
  local failed=0
  local checked=0
  local astro_checked=0
  local images_checked=0
  local route html_file image_paths_file image_path code

  for route in "${routes[@]}"; do
    html_file="$TMP_DIR/route.html"
    curl -sS --connect-timeout 5 --max-time 20 "${BASE_URL}${route}" > "$html_file"

    image_paths_file="$TMP_DIR/image-paths.txt"
    extract_image_paths "$html_file" "$image_paths_file"

    while IFS= read -r image_path; do
      [[ -z "$image_path" ]] && continue

      if [[ "$image_path" != /* ]]; then
        continue
      fi

      code="$(curl -s --connect-timeout 5 --max-time 20 -o /dev/null -w "%{http_code}" "${BASE_URL}${image_path}")"
      if [[ "$code" != "200" ]]; then
        echo "[img-links] FAIL image ${code} ${image_path} (from ${route})" >&2
        failed=1
      else
        checked=$((checked + 1))
        if [[ "$image_path" == /_astro/* ]]; then
          astro_checked=$((astro_checked + 1))
        fi
        if [[ "$image_path" == /images/* ]]; then
          images_checked=$((images_checked + 1))
        fi
      fi
    done < "$image_paths_file"
  done

  if [[ "$checked" -eq 0 ]]; then
    echo "[img-links] FAIL no images checked for routes / and /katalog/" >&2
    return 1
  fi
  if [[ "$astro_checked" -eq 0 ]]; then
    echo "[img-links] FAIL no /_astro/* images detected on smoke routes" >&2
    return 1
  fi
  if [[ "$images_checked" -eq 0 ]]; then
    echo "[img-links] FAIL no /images/* images detected on smoke routes" >&2
    return 1
  fi
  if [[ "$failed" -ne 0 ]]; then
    return 1
  fi

  echo "[img-links] OK remote image links (${checked} checked; /_astro=${astro_checked}, /images=${images_checked})"
}

if [[ -n "$BASE_URL" ]]; then
  echo "[img-links] Checking image links over HTTP (${BASE_URL})"
  check_remote_images
else
  echo "[img-links] Checking image links in local dist/"
  check_local_dist_images
fi
