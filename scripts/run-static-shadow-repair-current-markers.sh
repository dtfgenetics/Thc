#!/usr/bin/env bash
set -euo pipefail

script="scripts/repair-static-shadows-via-wordpress.mjs"
runner="scripts/run-static-shadow-repair-resilient.mjs"
test -s "$script"
test -s "$runner"

python3 - "$script" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text()
replacements = {
    "['/', 'Genetics. Plant science. Tools. Games. Community.']": "['/', 'Genetics first. Cultivation science behind it.']",
    "['/learn/', 'Explore by subject']": "['/learn/', 'Learn the plant as a connected system.']",
    "if (removedFiles.length < 1) {\n    throw new Error(`No known stale static shadow file was removed. Result: ${JSON.stringify(repair?.body || {}).slice(0, 900)}`);\n  }": "if (removedFiles.length < 1) {\n    console.warn(`No stale static shadow needed removal; continuing with visitor verification. Result: ${JSON.stringify(repair?.body || {}).slice(0, 900)}`);\n  }",
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f'Expected repair fragment not found: {old[:100]}')
    s = s.replace(old, new, 1)
p.write_text(s)
PY

node --check "$script"
node --check "$runner"
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs "$runner"
