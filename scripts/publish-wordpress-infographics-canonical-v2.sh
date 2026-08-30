#!/usr/bin/env bash
set -euo pipefail

# The checked-in parent Outdoor dataset intentionally keeps the first chapter inline
# and stores the other completed chapters as separate files. Production must assemble
# those eight chapters before the canonical publisher validates/publishes Outdoor.
assembly_report="${RUNNER_TEMP:-/tmp}/outdoor-assembly.json"
node scripts/assemble-outdoor-quantification-v1.mjs --write > "$assembly_report"
test -s "$assembly_report"
node -e "const r=require(process.argv[1]); if(r.sections!==8||r.subtopics!==32||r.metrics<100) throw new Error('Outdoor assembly contract failed')" "$assembly_report"

exec bash scripts/publish-wordpress-infographics-canonical.sh
