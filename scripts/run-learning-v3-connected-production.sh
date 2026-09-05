#!/usr/bin/env bash
set -euo pipefail

learning_root="${BACKUP_ROOT:-/tmp/dtf-learning-v3}"
map_root="${LEARNING_V4_BACKUP_ROOT:-/tmp/dtf-learning-v4-final}"
owner_v3=/tmp/rebuild-wordpress-learning-experience-v3-owner-aware.mjs
owner_v4=/tmp/improve-wordpress-learning-v4-owner-aware.mjs
owner_visual=/tmp/apply-learning-visual-v1-owner-aware.mjs

# Learning Experience V3 is the sole Home/Learn WordPress owner. Refuse to
# publish if the independent static Hostinger overlay ever regains /learn/.
if grep -Eq '^[[:space:]]+learn$' scripts/deploy/hostinger-overlay.sh; then
  echo 'Learning ownership violation: static Hostinger overlay contains /learn.' >&2
  exit 1
fi

# Root owner state is proved through authenticated WordPress storage. Topic and
# child routes still require anonymous visitor verification in their publishers.
# Canonical stored markers remain:
# data-dtf-learning-map="v4"
# data-dtf-learning-expanded-reference="v1"
# Learn the plant as a connected system.
export DTF_REQUIRE_CACHE_CONVERGENCE=true

LEARNING_V3_SOURCE_PUBLISHER="${LEARNING_V3_PUBLISHER_PATH:-scripts/rebuild-wordpress-learning-experience-v3.mjs}" \
LEARNING_V3_OWNER_AWARE_PUBLISHER="$owner_v3" \
node scripts/prepare-learning-v3-owner-aware-publisher.mjs \
  | tee /tmp/dtf-learning-v3-owner-aware-prepare.json

LEARNING_V4_OWNER_AWARE_PUBLISHER="$owner_v4" \
LEARNING_VISUAL_OWNER_AWARE_PUBLISHER="$owner_visual" \
node scripts/prepare-learning-owner-aware-followup-publishers.mjs \
  | tee /tmp/dtf-learning-followup-owner-aware-prepare.json

LEARNING_V3_PUBLISHER_PATH="$owner_v3" \
BACKUP_ROOT="$learning_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/run-learning-v3-production.mjs \
  | tee /tmp/dtf-learning-v3-output.json

LEARNING_OWNER_STAGE=v3 \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/verify-learning-owner-storage.mjs \
  | tee /tmp/dtf-learning-owner-v3-storage.json

APPLY_LEARNING_V4=true \
BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs "$owner_v4" \
  | tee /tmp/dtf-learning-v4-final-output.json

LEARNING_OWNER_STAGE=v4 \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/verify-learning-owner-storage.mjs \
  | tee /tmp/dtf-learning-owner-v4-storage.json

EXPANDED_REFERENCE_BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/publish-learning-expanded-references-owner-aware.mjs \
  | tee /tmp/dtf-learning-expanded-reference-output.json

LEARNING_OWNER_STAGE=expanded \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/verify-learning-owner-storage.mjs \
  | tee /tmp/dtf-learning-owner-expanded-storage.json

APPLY_LEARNING_VISUAL_V1=true \
BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs "$owner_visual" \
  | tee /tmp/dtf-learning-visual-v1-output.json

LEARNING_OWNER_STAGE=visual \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/verify-learning-owner-storage.mjs \
  | tee /tmp/dtf-learning-owner-visual-storage.json

test -s "$map_root/learning-v4-backup-path.txt"
test -s "$map_root/learning-visual-v1-backup-path.txt"
echo "Canonical Learning V3, connected Learning V4 map, expanded THC references, and DTF Visual V1 stored as one owner transaction; child/topic visitor verification remains independent."
