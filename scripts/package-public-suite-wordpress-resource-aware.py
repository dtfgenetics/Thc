#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile

from public_suite_resource_ownership import filter_archive

if len(sys.argv) != 3:
    raise SystemExit('usage: package-public-suite-wordpress-resource-aware.py RELEASE_DIR OUTPUT_ZIP')

repo = Path(__file__).resolve().parents[1]
release_dir = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()

# Static top-level hubs are public-suite owned, so WordPress template parts cannot
# repair their header. Normalize only those hub documents to the same canonical
# V6 shell immediately before packaging while leaving game/app internals alone.
subprocess.run(
    ['node', str(repo / 'scripts/normalize-public-suite-hub-shells.mjs'), str(release_dir)],
    cwd=repo,
    check=True,
)

with tempfile.TemporaryDirectory(prefix='dtf-suite-package-resource-aware-') as temp:
    base = Path(temp) / 'suite-base.zip'
    subprocess.run(
        [sys.executable, str(repo / 'scripts/package-public-suite-wordpress.py'), str(release_dir), str(base)],
        cwd=repo,
        check=True,
    )
    report = filter_archive(base, output, repo)

print(json.dumps(report, indent=2))
