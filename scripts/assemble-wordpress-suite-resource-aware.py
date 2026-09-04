#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from public_suite_resource_ownership import transform_bridge

if len(sys.argv) != 2:
    raise SystemExit('usage: assemble-wordpress-suite-resource-aware.py OUTPUT_MJS')

ATLAS_TARGETS = ['atlas', 'assets/images/atlas']
ATLAS_REQUIRED = [
    'atlas/index.html',
    'atlas/leaf-module/index.html',
    'atlas/root-system/index.html',
    'atlas/root-system/rhizosphere/index.html',
    'atlas/downloads/index.html',
    'assets/images/atlas/root-system/rhizosphere-microbe-interaction.svg',
]
ATLAS_PREFIXES = ['atlas/', 'assets/images/atlas/']


def extend_php_array(text: str, variable: str, additions: list[str]) -> str:
    pattern = rf'(?P<head>    \${re.escape(variable)} = \[\n)(?P<body>.*?)(?P<tail>\n    \];)'
    match = re.search(pattern, text, re.S)
    if not match:
        raise SystemExit(f'bridge array ${variable} not found')
    current = re.findall(r"'([^']+)'", match.group('body'))
    if not current:
        raise SystemExit(f'bridge array ${variable} is empty or unparsable')
    merged = [*current]
    for value in additions:
        if value not in merged:
            merged.append(value)
    if len(merged) != len(set(merged)):
        raise SystemExit(f'bridge array ${variable} contains duplicate entries after Atlas scope merge')
    body = ''.join(f"        {value!r},\n" for value in merged).rstrip('\n')
    return text[:match.start()] + match.group('head') + body + match.group('tail') + text[match.end():]


def add_atlas_scope(text: str) -> str:
    text = extend_php_array(text, 'targets', ATLAS_TARGETS)
    text = extend_php_array(text, 'required', ATLAS_REQUIRED)
    text = extend_php_array(text, 'prefixes', ATLAS_PREFIXES)
    return text


repo = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='dtf-suite-resource-aware-') as temp:
    base = Path(temp) / 'suite-v2.mjs'
    subprocess.run([sys.executable, str(repo / 'scripts/assemble-wordpress-suite-v2.py'), str(base)], cwd=repo, check=True)
    scoped = add_atlas_scope(base.read_text())
    transformed, report = transform_bridge(scoped, repo)

    for marker in [*ATLAS_TARGETS, *ATLAS_REQUIRED, *ATLAS_PREFIXES]:
        if repr(marker) not in transformed:
            raise SystemExit(f'Atlas scope marker disappeared from resource-aware bridge: {marker}')
    if "'games/high-land'" in transformed or "'games/high-iq'" in transformed:
        raise SystemExit('resource-owned game target remained after Atlas scope merge')

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(transformed)

print(json.dumps({
    **report,
    'atlasScope': {
        'targets': ATLAS_TARGETS,
        'required': ATLAS_REQUIRED,
        'prefixes': ATLAS_PREFIXES,
    },
    'output': str(output),
}, indent=2))
