#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import re
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
# drifts away from the canonical eight-section shell or the shared progressive-
# disclosure layer. This keeps production from publishing a mixed shell or a
# long hub page without the content-density behavior validated by V6.
expected_labels = ['Home', 'Seeds', 'Learn', 'Courses', 'Diagnostic', 'Games', 'Community', 'Shop']
for relative in ('tools/index.html', 'games/index.html', 'projects/index.html'):
    candidate = release_dir / relative
    if not candidate.is_file() or candidate.stat().st_size < 1:
        raise SystemExit(f'canonical public-suite hub is missing: {relative}')
    html = candidate.read_text(errors='replace')
    required_markers = (
        'data-dtf-shell="header-v6"',
        'data-dtf-sitewide-header="canonical-eight-v1"',
        'id="dtf-sitewide-header-v6-script"',
        'id="dtf-responsive-layout-v1"',
        'id="dtf-sitewide-ux-polish-v1"',
        'id="dtf-content-density-v1-style"',
        'id="dtf-content-density-v1-script"',
        'id="dtf-sitewide-visual-repair-v2-style"',
        'id="dtf-sitewide-visual-repair-v2-script"',
    )
    for marker in required_markers:
        count = html.count(marker)
        if count != 1:
            raise SystemExit(
                f'{relative} expected exactly one canonical V6/content-density marker '
                f'{marker}; found {count}'
            )

    nav_match = re.search(
        r'<nav\b[^>]*id=["\']dtf-global-primary-nav["\'][^>]*>([\s\S]*?)</nav>',
        html,
        re.IGNORECASE,
    )
    if not nav_match:
        raise SystemExit(f'{relative} is missing canonical primary navigation')
    labels = [
        re.sub(r'<[^>]+>', '', match).strip()
        for match in re.findall(r'<a\b[^>]*>([\s\S]*?)</a>', nav_match.group(1), re.IGNORECASE)
    ]
    if labels != expected_labels:
        raise SystemExit(f'{relative} has unexpected primary navigation: {labels!r}')

with tempfile.TemporaryDirectory(prefix='dtf-suite-package-resource-aware-') as temp:
    base = Path(temp) / 'suite-base.zip'
    subprocess.run(
        [sys.executable, str(repo / 'scripts/package-public-suite-wordpress.py'), str(release_dir), str(base)],
        cwd=repo,
        check=True,
    )
    report = filter_archive(base, output, repo)

print(json.dumps(report, indent=2))
