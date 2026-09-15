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

# Fail closed before archive construction if a suite-owned top-level hub ever
# drifts away from the canonical six-section shell. This keeps the production
# transaction from publishing a mixed V5/V6 navigation state.
for relative in ('tools/index.html', 'games/index.html', 'projects/index.html'):
    candidate = release_dir / relative
    if not candidate.is_file() or candidate.stat().st_size < 1:
        raise SystemExit(f'canonical public-suite hub is missing: {relative}')
    html = candidate.read_text(errors='replace')
    for marker in (
        'data-dtf-shell="header-v6"',
        'data-dtf-sitewide-header="canonical-six-v1"',
        '>Genetics</a>',
        '>Learn</a>',
        '>Tools</a>',
        '>Games</a>',
        '>Community</a>',
        '>Shop</a>',
    ):
        if marker not in html:
            raise SystemExit(f'{relative} is missing canonical V6 shell marker: {marker}')

with tempfile.TemporaryDirectory(prefix='dtf-suite-package-resource-aware-') as temp:
    base = Path(temp) / 'suite-base.zip'
    subprocess.run(
        [sys.executable, str(repo / 'scripts/package-public-suite-wordpress.py'), str(release_dir), str(base)],
        cwd=repo,
        check=True,
    )
    report = filter_archive(base, output, repo)

print(json.dumps(report, indent=2))
