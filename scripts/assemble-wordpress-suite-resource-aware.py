#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile

from public_suite_resource_ownership import transform_bridge

if len(sys.argv) != 2:
    raise SystemExit('usage: assemble-wordpress-suite-resource-aware.py OUTPUT_MJS')

repo = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='dtf-suite-resource-aware-') as temp:
    base = Path(temp) / 'suite-v2.mjs'
    subprocess.run([sys.executable, str(repo / 'scripts/assemble-wordpress-suite-v2.py'), str(base)], cwd=repo, check=True)
    transformed, report = transform_bridge(base.read_text(), repo)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(transformed)

print(json.dumps({**report, 'output': str(output)}, indent=2))
