#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOYER="$ROOT_DIR/scripts/deploy/hostinger-overlay.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "hostinger-overlay test: $*" >&2
  exit 1
}

make_archive() {
  local destination="$1"
  local sha="$2"
  local complete="${3:-yes}"
  local payload="$TMP/payload-$sha"
  rm -rf "$payload"
  mkdir -p "$payload/games/bud-or-bluff"

  printf '%s\n' '25 playable browser games - replacement' > "$payload/games/index.html"
  printf '%s\n' '<title>Bud or Bluff</title>' > "$payload/games/bud-or-bluff/index.html"
  if [[ "$complete" == "yes" ]]; then
    printf '%s\n' '<?php echo "ok";' > "$payload/games/bud-or-bluff/api-v2.php"
  fi
  printf '{"master":"%s"}\n' "$sha" > "$payload/dtf-build.json"
  printf '%s\n' "$sha" > "$payload/.dtf-source-sha"
  tar -C "$payload" -czf "$destination" .
}

make_public_suite_archive() {
  local destination="$1"
  local sha="$2"
  local payload="$TMP/public-suite-$sha"
  rm -rf "$payload"
  mkdir -p \
    "$payload/assets" \
    "$payload/blog" \
    "$payload/games/bud-or-bluff" \
    "$payload/projects" \
    "$payload/tools" \
    "$payload/growlens" \
    "$payload/thc-grow-doc" \
    "$payload/puzzles" \
    "$payload/learn/infographics"

  printf '%s\n' 'asset replacement' > "$payload/assets/marker.txt"
  printf '%s\n' '25 playable browser games - public suite replacement' > "$payload/games/index.html"
  printf '%s\n' '<title>Bud or Bluff</title>' > "$payload/games/bud-or-bluff/index.html"
  printf '%s\n' '<?php echo "ok";' > "$payload/games/bud-or-bluff/api-v2.php"
  printf '%s\n' 'projects replacement' > "$payload/projects/index.html"
  printf '%s\n' 'tools replacement' > "$payload/tools/index.html"
  printf '%s\n' 'growlens replacement' > "$payload/growlens/index.html"
  printf '%s\n' 'grow doc replacement' > "$payload/thc-grow-doc/index.html"
  printf '%s\n' '{}' > "$payload/puzzles/current.json"

  # Deliberately include staged Blog and Learn trees. The deployer must ignore
  # both because canonical WordPress owns /blog and Learning owns /learn.
  printf '%s\n' 'Redirect 301 /blog/ /learn/' > "$payload/blog/.htaccess"
  printf '%s\n' 'staged learn content must never be activated' > "$payload/learn/infographics/index.html"

  printf '{"master":"%s"}\n' "$sha" > "$payload/dtf-build.json"
  printf '%s\n' "$sha" > "$payload/.dtf-source-sha"
  tar -C "$payload" -czf "$destination" .
}

DOMAIN="$TMP/domains/dtfseeds.com"
PUBLIC_ROOT="$DOMAIN/public_html"
mkdir -p "$PUBLIC_ROOT/games/bud-or-bluff" "$TMP/home"
printf '%s\n' 'old game hub' > "$PUBLIC_ROOT/games/index.html"
printf '%s\n' 'old bob page' > "$PUBLIC_ROOT/games/bud-or-bluff/index.html"
printf '%s\n' '<?php echo "old";' > "$PUBLIC_ROOT/games/bud-or-bluff/api-v2.php"
printf '%s\n' '{"master":"old"}' > "$PUBLIC_ROOT/dtf-build.json"
printf '%s\n' 'previous-sha' > "$PUBLIC_ROOT/.dtf-deployed-sha"

SOURCE_SHA="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
ARCHIVE="$TMP/release-$SOURCE_SHA.tgz"
make_archive "$ARCHIVE" "$SOURCE_SHA"

OUTPUT="$(HOME="$TMP/home" bash "$DEPLOYER" activate "$PUBLIC_ROOT" "$SOURCE_SHA" games "$ARCHIVE")"
BACKUP_ID="$(printf '%s\n' "$OUTPUT" | sed -n 's/^backup_id=//p')"
[[ -n "$BACKUP_ID" ]] || fail "activation did not return a backup id"
grep -Fq 'replacement' "$PUBLIC_ROOT/games/index.html" || fail "new game hub was not activated"
[[ "$(cat "$PUBLIC_ROOT/.dtf-deployed-sha")" == "$SOURCE_SHA" ]] || fail "deployment SHA marker was not written"
grep -Fq 'old game hub' "$DOMAIN/.dtf-backups/$BACKUP_ID/games/index.html" || fail "previous game hub was not backed up"

HOME="$TMP/home" bash "$DEPLOYER" rollback "$PUBLIC_ROOT" "$BACKUP_ID" games >/dev/null
grep -Fq 'old game hub' "$PUBLIC_ROOT/games/index.html" || fail "rollback did not restore the previous game hub"
grep -Fq 'old bob page' "$PUBLIC_ROOT/games/bud-or-bluff/index.html" || fail "rollback did not restore Bud or Bluff"
[[ "$(cat "$PUBLIC_ROOT/.dtf-deployed-sha")" == "previous-sha" ]] || fail "rollback did not restore deployment metadata"

BAD_SHA="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
BAD_ARCHIVE="$TMP/release-$BAD_SHA.tgz"
make_archive "$BAD_ARCHIVE" "$BAD_SHA" no
BEFORE="$(sha256sum "$PUBLIC_ROOT/games/index.html" | awk '{print $1}')"
if HOME="$TMP/home" bash "$DEPLOYER" activate "$PUBLIC_ROOT" "$BAD_SHA" games "$BAD_ARCHIVE" >/dev/null 2>&1; then
  fail "incomplete payload was accepted"
fi
AFTER="$(sha256sum "$PUBLIC_ROOT/games/index.html" | awk '{print $1}')"
[[ "$BEFORE" == "$AFTER" ]] || fail "validation failure mutated the public route"

UNSAFE_ROOT="$TMP/not-public-root"
mkdir -p "$UNSAFE_ROOT"
UNSAFE_SHA="cccccccccccccccccccccccccccccccccccccccc"
UNSAFE_ARCHIVE="$TMP/release-$UNSAFE_SHA.tgz"
make_archive "$UNSAFE_ARCHIVE" "$UNSAFE_SHA"
if HOME="$TMP/home" bash "$DEPLOYER" activate "$UNSAFE_ROOT" "$UNSAFE_SHA" games "$UNSAFE_ARCHIVE" >/dev/null 2>&1; then
  fail "unsafe public root was accepted"
fi

# Regression: public-suite activation must preserve WordPress-owned Blog and
# Learning-owned Learn, even when a stale release archive contains both trees.
mkdir -p "$PUBLIC_ROOT/blog" "$PUBLIC_ROOT/learn"
printf '%s\n' 'canonical WordPress Blog owner marker' > "$PUBLIC_ROOT/blog/owner-marker.txt"
printf '%s\n' 'canonical Learning owner marker' > "$PUBLIC_ROOT/learn/owner-marker.txt"
BLOG_BEFORE="$(sha256sum "$PUBLIC_ROOT/blog/owner-marker.txt" | awk '{print $1}')"
LEARN_BEFORE="$(sha256sum "$PUBLIC_ROOT/learn/owner-marker.txt" | awk '{print $1}')"

SUITE_SHA="dddddddddddddddddddddddddddddddddddddddd"
SUITE_ARCHIVE="$TMP/release-$SUITE_SHA.tgz"
make_public_suite_archive "$SUITE_ARCHIVE" "$SUITE_SHA"
SUITE_OUTPUT="$(HOME="$TMP/home" bash "$DEPLOYER" activate "$PUBLIC_ROOT" "$SUITE_SHA" public-suite "$SUITE_ARCHIVE")"
SUITE_BACKUP_ID="$(printf '%s\n' "$SUITE_OUTPUT" | sed -n 's/^backup_id=//p')"
[[ -n "$SUITE_BACKUP_ID" ]] || fail "public-suite activation did not return a backup id"

BLOG_AFTER="$(sha256sum "$PUBLIC_ROOT/blog/owner-marker.txt" | awk '{print $1}')"
LEARN_AFTER="$(sha256sum "$PUBLIC_ROOT/learn/owner-marker.txt" | awk '{print $1}')"
[[ "$BLOG_BEFORE" == "$BLOG_AFTER" ]] || fail "public-suite activation changed the WordPress-owned Blog route"
[[ "$LEARN_BEFORE" == "$LEARN_AFTER" ]] || fail "public-suite activation changed the Learning-owned route"
[[ ! -e "$PUBLIC_ROOT/blog/.htaccess" ]] || fail "staged Blog redirect was incorrectly activated"
[[ ! -e "$PUBLIC_ROOT/learn/infographics/index.html" ]] || fail "staged Learn content was incorrectly activated"
if grep -Eq '^blog\t' "$DOMAIN/.dtf-backups/$SUITE_BACKUP_ID/manifest.tsv"; then
  fail "Blog entered the public-suite mutation manifest"
fi
if grep -Eq '^learn\t' "$DOMAIN/.dtf-backups/$SUITE_BACKUP_ID/manifest.tsv"; then
  fail "Learn entered the public-suite mutation manifest"
fi

HOME="$TMP/home" bash "$DEPLOYER" rollback "$PUBLIC_ROOT" "$SUITE_BACKUP_ID" public-suite >/dev/null
[[ "$(sha256sum "$PUBLIC_ROOT/blog/owner-marker.txt" | awk '{print $1}')" == "$BLOG_BEFORE" ]] || fail "public-suite rollback changed the WordPress-owned Blog route"
[[ "$(sha256sum "$PUBLIC_ROOT/learn/owner-marker.txt" | awk '{print $1}')" == "$LEARN_BEFORE" ]] || fail "public-suite rollback changed the Learning-owned route"

echo "Hostinger overlay activation, rollback, Blog ownership, and Learn ownership tests passed."
