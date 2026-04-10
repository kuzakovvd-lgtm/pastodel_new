#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  scripts/release-manifest.sh local --root <path> --output <file>
  scripts/release-manifest.sh server --host <user@host> --root <path> --output <file>
  scripts/release-manifest.sh classify --local <file> --server <file> --output <file>

Manifest format:
  <sha256>\t<relative-path>
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

cmd="$1"
shift

hash_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
    return
  fi
  echo "No sha256 tool found (sha256sum or shasum)" >&2
  exit 1
}

case "$cmd" in
  local)
    root=""
    output=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --root)
          root="${2:-}"
          shift 2
          ;;
        --output)
          output="${2:-}"
          shift 2
          ;;
        *)
          echo "Unknown argument for local: $1" >&2
          exit 1
          ;;
      esac
    done

    if [[ -z "$root" || -z "$output" ]]; then
      echo "local requires --root and --output" >&2
      exit 1
    fi

    if [[ ! -d "$root" ]]; then
      echo "Directory not found: $root" >&2
      exit 1
    fi

    : > "$output"
    while IFS= read -r rel; do
      [[ -z "$rel" ]] && continue
      printf "%s\t%s\n" "$(hash_file "$root/$rel")" "$rel" >> "$output"
    done < <(cd "$root" && find . -type f | sed 's#^\./##' | sort)

    echo "[release-manifest] Local manifest written: $output"
    ;;

  server)
    host=""
    root=""
    output=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --host)
          host="${2:-}"
          shift 2
          ;;
        --root)
          root="${2:-}"
          shift 2
          ;;
        --output)
          output="${2:-}"
          shift 2
          ;;
        *)
          echo "Unknown argument for server: $1" >&2
          exit 1
          ;;
      esac
    done

    if [[ -z "$host" || -z "$root" || -z "$output" ]]; then
      echo "server requires --host, --root and --output" >&2
      exit 1
    fi

    ssh -o BatchMode=yes "$host" \
      "cd '$root' && find . -type f -print0 | xargs -0 sha256sum" \
      | sed -E 's#  \./#\t#' \
      | sort > "$output"

    echo "[release-manifest] Server manifest written: $output"
    ;;

  classify)
    local_manifest=""
    server_manifest=""
    output=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --local)
          local_manifest="${2:-}"
          shift 2
          ;;
        --server)
          server_manifest="${2:-}"
          shift 2
          ;;
        --output)
          output="${2:-}"
          shift 2
          ;;
        *)
          echo "Unknown argument for classify: $1" >&2
          exit 1
          ;;
      esac
    done

    if [[ -z "$local_manifest" || -z "$server_manifest" || -z "$output" ]]; then
      echo "classify requires --local, --server and --output" >&2
      exit 1
    fi

    if [[ ! -f "$local_manifest" || ! -f "$server_manifest" ]]; then
      echo "Manifest files not found" >&2
      exit 1
    fi

    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT

    cut -f2 "$local_manifest" | sort > "$tmp_dir/local_paths.txt"
    cut -f2 "$server_manifest" | sort > "$tmp_dir/server_paths.txt"

    comm -12 "$tmp_dir/local_paths.txt" "$tmp_dir/server_paths.txt" > "$tmp_dir/canonical.txt"
    comm -13 "$tmp_dir/local_paths.txt" "$tmp_dir/server_paths.txt" > "$tmp_dir/server_only.txt"
    comm -23 "$tmp_dir/local_paths.txt" "$tmp_dir/server_paths.txt" > "$tmp_dir/local_only.txt"

    grep -E '^(_astro/|js/|fonts/)' "$tmp_dir/server_only.txt" > "$tmp_dir/compatibility_only.txt" || true
    grep -Ev '^(_astro/|js/|fonts/)' "$tmp_dir/server_only.txt" > "$tmp_dir/unknown_manual.txt" || true

    {
      echo "# Manifest Classification Report"
      echo
      echo "Canonical build files (present in both): $(wc -l < "$tmp_dir/canonical.txt" | tr -d ' ')"
      echo "Compatibility-only files (server-only under _astro/js/fonts): $(wc -l < "$tmp_dir/compatibility_only.txt" | tr -d ' ')"
      echo "Unknown/manual server-only files: $(wc -l < "$tmp_dir/unknown_manual.txt" | tr -d ' ')"
      echo "Missing-on-server canonical files: $(wc -l < "$tmp_dir/local_only.txt" | tr -d ' ')"
      echo
      echo "## Missing-on-server canonical files"
      sed -n '1,200p' "$tmp_dir/local_only.txt"
      echo
      echo "## Compatibility-only server files"
      sed -n '1,200p' "$tmp_dir/compatibility_only.txt"
      echo
      echo "## Unknown/manual server-only files"
      sed -n '1,200p' "$tmp_dir/unknown_manual.txt"
    } > "$output"

    echo "[release-manifest] Classification report written: $output"
    ;;

  *)
    usage
    exit 1
    ;;
esac
