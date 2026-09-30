#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
public_root="${2:-}"
source_sha="${3:-}"
archive="${4:-}"
backup_id="${5:-}"

[[ "$public_root" == /*/public_html ]] || { echo "public_root must end in /public_html" >&2; exit 2; }
[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "source_sha must be a full commit SHA" >&2; exit 2; }

plugin_dir="$public_root/wp-content/mu-plugins"
plugin_file="$plugin_dir/dtf-learning-search.php"
asset_dir="$plugin_dir/dtf-learning-search"
state_root="$HOME/.dtf-deploy/learning-search"
mkdir -p "$state_root/incoming" "$state_root/backups"

case "$mode" in
  activate)
    [[ -f "$archive" ]] || { echo "archive missing: $archive" >&2; exit 2; }
    stage="$state_root/incoming/$source_sha"
    rm -rf "$stage"
    mkdir -p "$stage"
    tar -C "$stage" -xzf "$archive"
    test -s "$stage/dtf-learning-search.php"
    test -s "$stage/dtf-learning-search/search-v1.js"
    test -s "$stage/dtf-learning-search/encyclopedia-v1.js"
    php -l "$stage/dtf-learning-search.php" >/dev/null

    backup_id="learning-search-$(date -u +%Y%m%dT%H%M%SZ)-${source_sha:0:12}"
    backup="$state_root/backups/$backup_id"
    mkdir -p "$backup"
    if [[ -f "$plugin_file" ]]; then cp -a "$plugin_file" "$backup/dtf-learning-search.php"; fi
    if [[ -d "$asset_dir" ]]; then cp -a "$asset_dir" "$backup/dtf-learning-search"; fi

    mkdir -p "$plugin_dir"
    tmp_file="$plugin_dir/.dtf-learning-search.php.$source_sha"
    tmp_dir="$plugin_dir/.dtf-learning-search.$source_sha"
    rm -f "$tmp_file"; rm -rf "$tmp_dir"
    cp "$stage/dtf-learning-search.php" "$tmp_file"
    cp -a "$stage/dtf-learning-search" "$tmp_dir"
    chmod 0644 "$tmp_file"
    find "$tmp_dir" -type f -exec chmod 0644 {} +
    find "$tmp_dir" -type d -exec chmod 0755 {} +

    rm -rf "$asset_dir"
    mv "$tmp_dir" "$asset_dir"
    mv "$tmp_file" "$plugin_file"
    php -l "$plugin_file" >/dev/null
    printf '%s\n' "$source_sha" > "$state_root/current-source-sha"
    echo "backup_id=$backup_id"
    ;;
  rollback)
    [[ -n "$backup_id" ]] || { echo "backup_id required" >&2; exit 2; }
    backup="$state_root/backups/$backup_id"
    [[ -d "$backup" ]] || { echo "backup not found: $backup_id" >&2; exit 2; }
    if [[ -f "$backup/dtf-learning-search.php" ]]; then
      cp -a "$backup/dtf-learning-search.php" "$plugin_file"
    else
      rm -f "$plugin_file"
    fi
    rm -rf "$asset_dir"
    if [[ -d "$backup/dtf-learning-search" ]]; then cp -a "$backup/dtf-learning-search" "$asset_dir"; fi
    if [[ -f "$plugin_file" ]]; then php -l "$plugin_file" >/dev/null; fi
    echo "rolled_back=$backup_id"
    ;;
  *)
    echo "usage: $0 activate|rollback PUBLIC_ROOT SOURCE_SHA ARCHIVE [BACKUP_ID]" >&2
    exit 2
    ;;
esac
