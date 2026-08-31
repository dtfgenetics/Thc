#!/usr/bin/env bash
set -Eeuo pipefail

die() {
  echo "hostinger-overlay: $*" >&2
  exit 1
}

require_public_root() {
  local root="$1"
  [[ "$root" == /* ]] || die "public root must be an absolute path"
  [[ "$root" != "/" ]] || die "refusing to use / as the public root"
  [[ "$(basename "$root")" == "public_html" ]] || die "public root must end in /public_html"
  [[ -d "$root" ]] || die "public root does not exist: $root"
}

require_scope() {
  case "$1" in
    games|public-suite) ;;
    *) die "unsupported scope: $1" ;;
  esac
}

scope_items() {
  local scope="$1"
  if [[ "$scope" == "games" ]]; then
    ITEMS=(games dtf-build.json)
    REQUIRED=(games/index.html games/bud-or-bluff/index.html games/bud-or-bluff/api-v2.php dtf-build.json)
  else
    # WordPress/Learning-owned roots such as /learn are intentionally excluded.
    # The public-suite worker may ship independent apps and static surfaces, but
    # it must never replace a route owned by a different production writer.
    ITEMS=(
      assets
      atlas
      blog
      explore-dtf-genetics-your-destination-for-cannabis-themed-apparel-and-art
      exploring-dtf-genetics-a-hub-for-cannabis-art-and-gardening-tools
      games
      projects
      tools
      growlens
      thc-grow-doc
      puzzles
      dtf-build.json
    )
    REQUIRED=(
      assets
      games/index.html
      games/bud-or-bluff/index.html
      games/bud-or-bluff/api-v2.php
      projects
      tools
      growlens/index.html
      thc-grow-doc/index.html
      puzzles/current.json
      dtf-build.json
    )
  fi
}

backup_metadata() {
  local public_root="$1"
  local backup="$2"
  local meta_dir="$backup/metadata"
  mkdir -p "$meta_dir"
  local name
  for name in .dtf-deployed-sha .dtf-deployed-scope .dtf-last-backup; do
    if [[ -e "$public_root/$name" || -L "$public_root/$name" ]]; then
      cp -a "$public_root/$name" "$meta_dir/$name"
    else
      : > "$meta_dir/$name.missing"
    fi
  done
}

restore_metadata() {
  local public_root="$1"
  local backup="$2"
  local meta_dir="$backup/metadata"
  local name
  for name in .dtf-deployed-sha .dtf-deployed-scope .dtf-last-backup; do
    rm -rf "$public_root/$name"
    if [[ -e "$meta_dir/$name" || -L "$meta_dir/$name" ]]; then
      mv "$meta_dir/$name" "$public_root/$name"
    fi
  done
}

restore_manifest() {
  local public_root="$1"
  local backup="$2"
  local preserve_dir="$3"
  local manifest="$backup/manifest.tsv"
  [[ -s "$manifest" ]] || return 0

  mkdir -p "$preserve_dir"
  mapfile -t rows < "$manifest"
  local i row item had_old current
  for (( i=${#rows[@]}-1; i>=0; i-- )); do
    row="${rows[$i]}"
    IFS=$'\t' read -r item had_old <<< "$row"
    current="$public_root/$item"

    if [[ -e "$current" || -L "$current" ]]; then
      mkdir -p "$(dirname "$preserve_dir/$item")"
      mv "$current" "$preserve_dir/$item"
    fi

    if [[ "$had_old" == "1" ]]; then
      [[ -e "$backup/$item" || -L "$backup/$item" ]] || die "backup is missing previous item: $item"
      mkdir -p "$(dirname "$current")"
      mv "$backup/$item" "$current"
    fi
  done
}

validate_stage() {
  local stage="$1"
  local source_sha="$2"
  local required
  [[ -s "$stage/.dtf-source-sha" ]] || die "stage is missing .dtf-source-sha"
  [[ "$(cat "$stage/.dtf-source-sha")" == "$source_sha" ]] || die "stage source SHA does not match requested source"
  for required in "${REQUIRED[@]}"; do
    [[ -e "$stage/$required" || -L "$stage/$required" ]] || die "stage is missing required path: $required"
  done
  grep -Fq '25 playable browser games' "$stage/games/index.html" || die "game hub validation marker is missing"
}

activate() {
  [[ "$#" -eq 4 ]] || die "activate requires PUBLIC_ROOT SOURCE_SHA SCOPE INCOMING_ARCHIVE"
  local public_root="${1%/}"
  local source_sha="$2"
  local scope="$3"
  local incoming="$4"

  require_public_root "$public_root"
  require_scope "$scope"
  [[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || die "source SHA must be a 40-character lowercase Git SHA"
  [[ "$incoming" == /* ]] || incoming="$HOME/$incoming"
  [[ -s "$incoming" ]] || die "incoming release archive does not exist: $incoming"

  scope_items "$scope"

  local parent stage backup_root backup_id backup manifest
  parent="$(dirname "$public_root")"
  stage="$parent/.dtf-stage-${source_sha}-$$"
  backup_root="$parent/.dtf-backups"
  backup_id="$(date -u +%Y%m%dT%H%M%SZ)-${source_sha:0:12}-${scope}-$$"
  backup="$backup_root/$backup_id"
  manifest="$backup/manifest.tsv"

  rm -rf "$stage"
  mkdir -p "$stage" "$backup"
  tar -xzf "$incoming" -C "$stage"
  validate_stage "$stage" "$source_sha"
  backup_metadata "$public_root" "$backup"
  printf '%s\n' "$scope" > "$backup/scope"
  printf '%s\n' "$source_sha" > "$backup/source-sha"
  : > "$manifest"

  local mutated=0
  rollback_partial() {
    local status=$?
    trap - ERR INT TERM
    if [[ "$mutated" == "1" ]]; then
      set +e
      restore_manifest "$public_root" "$backup" "$backup/failed-activation"
      restore_metadata "$public_root" "$backup"
      set -e
    fi
    rm -rf "$stage"
    exit "$status"
  }
  trap rollback_partial ERR INT TERM

  local item had_old
  for item in "${ITEMS[@]}"; do
    [[ -e "$stage/$item" || -L "$stage/$item" ]] || continue
    had_old=0
    if [[ -e "$public_root/$item" || -L "$public_root/$item" ]]; then
      had_old=1
    fi

    printf '%s\t%s\n' "$item" "$had_old" >> "$manifest"
    mutated=1

    if [[ "$had_old" == "1" ]]; then
      mkdir -p "$(dirname "$backup/$item")"
      mv "$public_root/$item" "$backup/$item"
    fi

    mv "$stage/$item" "$public_root/$item"
  done

  printf '%s\n' "$source_sha" > "$public_root/.dtf-deployed-sha"
  printf '%s\n' "$scope" > "$public_root/.dtf-deployed-scope"
  printf '%s\n' "$backup_id" > "$public_root/.dtf-last-backup"

  [[ -s "$public_root/games/index.html" ]] || die "activated game hub is missing"
  [[ -s "$public_root/games/bud-or-bluff/index.html" ]] || die "activated Bud or Bluff route is missing"
  [[ -s "$public_root/games/bud-or-bluff/api-v2.php" ]] || die "activated Bud or Bluff PHP API is missing"
  grep -Fq '25 playable browser games' "$public_root/games/index.html" || die "activated game hub failed marker validation"

  trap - ERR INT TERM
  rm -rf "$stage"
  rm -f "$incoming"
  echo "backup_id=$backup_id"
}

rollback() {
  [[ "$#" -eq 3 ]] || die "rollback requires PUBLIC_ROOT BACKUP_ID SCOPE"
  local public_root="${1%/}"
  local backup_id="$2"
  local scope="$3"

  require_public_root "$public_root"
  require_scope "$scope"
  [[ "$backup_id" =~ ^[A-Za-z0-9._-]+$ ]] || die "unsafe backup id"

  local parent backup failed
  parent="$(dirname "$public_root")"
  backup="$parent/.dtf-backups/$backup_id"
  [[ -d "$backup" ]] || die "backup does not exist: $backup_id"
  [[ -s "$backup/manifest.tsv" ]] || die "backup manifest is missing"
  [[ -s "$backup/scope" ]] || die "backup scope marker is missing"
  [[ "$(cat "$backup/scope")" == "$scope" ]] || die "rollback scope does not match backup scope"

  failed="$backup/failed-release-$(date -u +%Y%m%dT%H%M%SZ)"
  restore_manifest "$public_root" "$backup" "$failed"
  restore_metadata "$public_root" "$backup"

  [[ -s "$public_root/games/index.html" ]] || die "rollback did not restore the game hub"
  printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$backup/rolled-back-at"
  echo "rolled_back=$backup_id"
}

main() {
  [[ "$#" -ge 1 ]] || die "usage: $0 {activate|rollback} ..."
  local action="$1"
  shift
  case "$action" in
    activate) activate "$@" ;;
    rollback) rollback "$@" ;;
    *) die "unknown action: $action" ;;
  esac
}

main "$@"
