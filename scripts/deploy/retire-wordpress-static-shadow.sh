#!/usr/bin/env bash
set -Eeuo pipefail

die() {
  echo "retire-wordpress-static-shadow: $*" >&2
  exit 1
}

TARGET_REL='seeds/index.html'
STALE_MARKER_ONE='DTF Genetics catalog pages built around strain identity and grow context.'
STALE_MARKER_TWO='Seed profiles, lineage language, product imagery, cultivation notes, and release details are organized for adult cultivators.'

require_public_root() {
  local root="${1%/}"
  [[ "$root" == /* ]] || die "public root must be an absolute path"
  [[ "$root" != "/" ]] || die "refusing to use / as the public root"
  [[ "$(basename "$root")" == 'public_html' ]] || die "public root must end in /public_html"
  [[ -d "$root" ]] || die "public root does not exist: $root"
}

require_backup_id() {
  [[ "$1" =~ ^[A-Za-z0-9._-]+$ ]] || die "unsafe backup id"
}

classify_target() {
  local public_root="${1%/}"
  local target="$public_root/$TARGET_REL"

  if [[ ! -e "$target" && ! -L "$target" ]]; then
    printf '%s\n' absent
    return 0
  fi

  [[ -f "$target" ]] || die "target exists but is not a regular file: $TARGET_REL"
  if grep -Fq "$STALE_MARKER_ONE" "$target" || grep -Fq "$STALE_MARKER_TWO" "$target"; then
    printf '%s\n' stale
    return 0
  fi
  printf '%s\n' unknown
}

inspect() {
  [[ $# -eq 1 ]] || die "inspect requires PUBLIC_ROOT"
  local public_root="${1%/}"
  require_public_root "$public_root"
  echo "state=$(classify_target "$public_root")"
}

retire() {
  [[ $# -eq 2 ]] || die "retire requires PUBLIC_ROOT RUN_ID"
  local public_root="${1%/}"
  local run_id="$2"
  require_public_root "$public_root"
  [[ "$run_id" =~ ^[A-Za-z0-9._-]+$ ]] || die "unsafe run id"

  local state target parent backup_root backup_id backup
  state="$(classify_target "$public_root")"
  target="$public_root/$TARGET_REL"

  if [[ "$state" == 'absent' ]]; then
    echo 'state=already-absent'
    echo 'backup_id='
    return 0
  fi
  [[ "$state" == 'stale' ]] || die "refusing to retire unrecognized content at $TARGET_REL"

  parent="$(dirname "$public_root")"
  backup_root="$parent/.dtf-backups"
  backup_id="$(date -u +%Y%m%dT%H%M%SZ)-seeds-shadow-${run_id}-$$"
  backup="$backup_root/$backup_id"
  mkdir -p "$backup/seeds"

  cp -a "$target" "$backup/$TARGET_REL"
  [[ -s "$backup/$TARGET_REL" ]] || die "backup copy is missing or empty"
  [[ "$(sha256sum "$target" | awk '{print $1}')" == "$(sha256sum "$backup/$TARGET_REL" | awk '{print $1}')" ]] || die "backup checksum mismatch"
  printf '%s\n' "$TARGET_REL" > "$backup/manifest.txt"
  printf '%s\n' "$run_id" > "$backup/run-id"

  local mutated=0
  restore_partial() {
    local status=$?
    trap - ERR INT TERM
    if [[ "$mutated" == '1' && ! -e "$target" && ! -L "$target" ]]; then
      mkdir -p "$(dirname "$target")"
      cp -a "$backup/$TARGET_REL" "$target" || true
    fi
    exit "$status"
  }
  trap restore_partial ERR INT TERM

  rm -- "$target"
  mutated=1
  [[ ! -e "$target" && ! -L "$target" ]] || die "target still exists after retirement"

  trap - ERR INT TERM
  echo 'state=retired'
  echo "backup_id=$backup_id"
}

rollback() {
  [[ $# -eq 2 ]] || die "rollback requires PUBLIC_ROOT BACKUP_ID"
  local public_root="${1%/}"
  local backup_id="$2"
  require_public_root "$public_root"
  require_backup_id "$backup_id"

  local parent backup source target failed_dir
  parent="$(dirname "$public_root")"
  backup="$parent/.dtf-backups/$backup_id"
  source="$backup/$TARGET_REL"
  target="$public_root/$TARGET_REL"

  [[ -s "$source" ]] || die "backup file is missing: $backup_id/$TARGET_REL"
  grep -Fxq "$TARGET_REL" "$backup/manifest.txt" || die "backup manifest does not authorize $TARGET_REL"

  if [[ -e "$target" || -L "$target" ]]; then
    failed_dir="$backup/failed-current-$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -p "$failed_dir/seeds"
    mv "$target" "$failed_dir/$TARGET_REL"
  fi

  mkdir -p "$(dirname "$target")"
  cp -a "$source" "$target"
  [[ -s "$target" ]] || die "rollback did not restore $TARGET_REL"
  echo "rolled_back=$backup_id"
}

main() {
  [[ $# -ge 1 ]] || die "usage: $0 {inspect|retire|rollback} ..."
  local action="$1"
  shift
  case "$action" in
    inspect) inspect "$@" ;;
    retire) retire "$@" ;;
    rollback) rollback "$@" ;;
    *) die "unknown action: $action" ;;
  esac
}

main "$@"
