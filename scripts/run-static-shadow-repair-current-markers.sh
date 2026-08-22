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
    "['/', 'Genetics. Plant science. Tools. Games. Community.']": "['/', 'Genetics, cultivation education, practical tools, and original cannabis games.']",
    "['/learn/', 'Explore by subject']": "['/learn/', 'Understand the plant. Build the environment. Make better decisions.']",
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f'Expected verifier marker not found: {old}')
    s = s.replace(old, new, 1)
p.write_text(s)
PY

node --check "$script"
node --check "$runner"
node "$runner"
