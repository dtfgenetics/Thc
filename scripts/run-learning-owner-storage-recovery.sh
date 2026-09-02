#!/usr/bin/env bash
set -euo pipefail

: "${WP_API_USERNAME:?WP_API_USERNAME is required}"
: "${WP_API_PASSWORD:?WP_API_PASSWORD is required}"

export WP_SITE_URL="${WP_SITE_URL:-https://dtfseeds.com}"
export APPLY_LEARNING_V3=true
export APPLY_LEARNING_V3_OWNERSHIP=true
export APPLY_SHARED_SHELL_V3=true
export BACKUP_ROOT="${BACKUP_ROOT:-/tmp/dtf-learning-storage-recovery}"
export LEARNING_V4_BACKUP_ROOT="${LEARNING_V4_BACKUP_ROOT:-/tmp/dtf-learning-v4-recovery}"
export LEARNING_V3_ATLAS_PUBLISHER="${LEARNING_V3_ATLAS_PUBLISHER:-/tmp/rebuild-wordpress-learning-experience-v3-atlas.mjs}"
export LEARNING_V3_PUBLISHER_PATH="$LEARNING_V3_ATLAS_PUBLISHER"

mkdir -p "$BACKUP_ROOT" "$LEARNING_V4_BACKUP_ROOT"

node scripts/prepare-learning-v3-atlas-publisher.mjs | tee /tmp/dtf-learning-atlas-publisher.json
node --check "$LEARNING_V3_ATLAS_PUBLISHER"
grep -Fq 'Open the THC Living Plant Atlas' "$LEARNING_V3_ATLAS_PUBLISHER"
grep -Fq '/learn/atlas/' "$LEARNING_V3_ATLAS_PUBLISHER"

echo 'Reconciling canonical Learning V3 route ownership before storage seeding.'
LEARNING_V3_OWNERSHIP_MODE=reconcile \
TOPIC_LITERATURE_PATH=site/wordpress/education/topic-literature.json \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/reconcile-wordpress-learning-v3-ownership.mjs \
  | tee /tmp/dtf-learning-recovery-ownership-reconcile.json

echo 'Seeding the authoritative V3 Home/Learn/topic payload into WordPress storage.'
set +e
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/run-learning-v3-production.mjs \
  2>&1 | tee /tmp/dtf-learning-recovery-storage-seed.log
seed_status=${PIPESTATUS[0]}
set -e
if [[ "$seed_status" -ne 0 ]]; then
  if grep -Fq 'Visitor verification failed:' /tmp/dtf-learning-recovery-storage-seed.log; then
    echo 'V3 storage seed reached the known stale visitor-render gate; continuing only to authenticated storage verification.'
  else
    echo 'V3 storage seed failed before the known visitor-render gate; refusing recovery.' >&2
    exit "$seed_status"
  fi
fi

test -s /tmp/dtf-topic-literature-v3-normalized.json
node scripts/verify-learning-v3-storage-recovery.mjs \
  | tee /tmp/dtf-learning-recovery-storage-verify.json

LEARNING_V3_OWNERSHIP_MODE=verify \
TOPIC_LITERATURE_PATH=/tmp/dtf-topic-literature-v3-normalized.json \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/reconcile-wordpress-learning-v3-ownership.mjs \
  | tee /tmp/dtf-learning-recovery-ownership-verify.json

echo 'Stored canonical owner is proven. Disabling only the exact confirmed stale MU renderer.'
bash scripts/run-dtf-wordpress-override-repair-current.sh \
  | tee /tmp/dtf-learning-recovery-mu-repair.json

echo 'Refreshing the shared V3 shell now that the stale MU renderer no longer masks WordPress.'
BACKUP_ROOT=/tmp/dtf-shared-shell-v3-recovery \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/rebuild-wordpress-shared-shell-v3.mjs \
  | tee /tmp/dtf-learning-recovery-shared-shell.json

echo 'Running the normal connected V3 -> V4 -> expanded references -> visual owner transaction.'
LEARNING_V3_PUBLISHER_PATH="$LEARNING_V3_ATLAS_PUBLISHER" \
BACKUP_ROOT="$BACKUP_ROOT" \
LEARNING_V4_BACKUP_ROOT="$LEARNING_V4_BACKUP_ROOT" \
bash scripts/run-learning-v3-connected-production.sh \
  | tee /tmp/dtf-learning-recovery-connected.json

node scripts/verify-learning-v3-storage-recovery.mjs \
  | tee /tmp/dtf-learning-recovery-final-storage.json

verify_public() {
  local path="$1"
  shift
  local body="/tmp/dtf-learning-recovery-public-$(printf '%s' "$path" | tr '/?' '__').html"
  local joiner='?'
  local ok=0
  [[ "$path" == *\?* ]] && joiner='&'
  for attempt in 1 2 3 4 5 6 7 8; do
    if curl -4 --fail --silent --show-error --location --retry 2 --retry-all-errors --retry-delay 2 \
      --connect-timeout 15 --max-time 60 \
      -H 'Cache-Control: no-cache, no-store, max-age=0' \
      -H 'Pragma: no-cache' \
      "${WP_SITE_URL}${path}${joiner}dtf_learning_recovery=${GITHUB_RUN_ID:-manual}-${attempt}" \
      -o "$body"; then
      ok=1
      for marker in "$@"; do
        if ! grep -Fqi -- "$marker" "$body"; then ok=0; break; fi
      done
      if [[ "$ok" -eq 1 ]]; then break; fi
    fi
    sleep 5
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "Final visitor verification failed for $path" >&2
    head -c 5000 "$body" >&2 || true
    return 1
  fi
  echo "$path live marker set verified"
}

verify_public '/' 'data-dtf-layout="home-v3"'
verify_public '/learn/' 'data-dtf-layout="learn-v3"' 'data-dtf-learning-map="v4"' 'Open the THC Living Plant Atlas'
verify_public '/learn/atlas/' 'THC Living Plant Atlas'
verify_public '/learn/atlas/atlas-3d/index.html' 'atlas-runtime.js'
verify_public '/games/' '25 playable browser games'
verify_public '/tools/' 'Grow with records. Diagnose with evidence.'

echo 'Learning owner storage recovery completed with strict stored-owner and visitor acceptance.'
