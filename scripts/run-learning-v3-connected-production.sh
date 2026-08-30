#!/usr/bin/env bash
set -euo pipefail

learning_root="${BACKUP_ROOT:-/tmp/dtf-learning-v3}"
map_root="${LEARNING_V4_BACKUP_ROOT:-/tmp/dtf-learning-v4-final}"

node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/run-learning-v3-production.mjs | tee /tmp/dtf-learning-v3-output.json

APPLY_LEARNING_V4=true \
BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/improve-wordpress-learning-v4.mjs | tee /tmp/dtf-learning-v4-final-output.json

test -s "$map_root/learning-v4-backup-path.txt"
echo "Canonical Learning V3 and connected Learning V4 map published as one owner transaction."
