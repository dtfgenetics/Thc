#!/usr/bin/env bash
set -Eeuo pipefail

script="${1:-scripts/deploy/retire-wordpress-static-shadow.sh}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

root="$tmp/domain/public_html"
mkdir -p "$root/seeds"
printf '%s\n' '<h1>DTF Genetics catalog pages built around strain identity and grow context.</h1>' > "$root/seeds/index.html"

[[ "$(bash "$script" inspect "$root")" == 'state=stale' ]]
retire_output="$(bash "$script" retire "$root" 12345)"
grep -Fxq 'state=retired' <<<"$retire_output"
backup_id="$(sed -n 's/^backup_id=//p' <<<"$retire_output")"
[[ -n "$backup_id" ]]
[[ ! -e "$root/seeds/index.html" ]]
[[ -s "$tmp/domain/.dtf-backups/$backup_id/seeds/index.html" ]]

bash "$script" rollback "$root" "$backup_id" | grep -Fq "rolled_back=$backup_id"
grep -Fq 'DTF Genetics catalog pages built around strain identity and grow context.' "$root/seeds/index.html"

rm -f "$root/seeds/index.html"
[[ "$(bash "$script" inspect "$root")" == 'state=absent' ]]
already_output="$(bash "$script" retire "$root" 12346)"
grep -Fxq 'state=already-absent' <<<"$already_output"

printf '%s\n' '<h1>unrecognized content</h1>' > "$root/seeds/index.html"
[[ "$(bash "$script" inspect "$root")" == 'state=unknown' ]]
if bash "$script" retire "$root" 12347 >/dev/null 2>&1; then
  echo 'expected unknown content retirement to fail' >&2
  exit 1
fi
grep -Fq 'unrecognized content' "$root/seeds/index.html"

if bash "$script" inspect "$tmp/not-public" >/dev/null 2>&1; then
  echo 'expected unsafe public root to fail' >&2
  exit 1
fi

echo 'Seeds shadow retirement tests passed.'
