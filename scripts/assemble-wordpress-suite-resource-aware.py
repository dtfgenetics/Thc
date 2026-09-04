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
    text = base.read_text()

    def replace_once(old: str, new: str, label: str) -> None:
        nonlocal_text = None
        del nonlocal_text
        global_text_count = text.count(old)
        if global_text_count != 1:
            raise SystemExit(f'expected exactly one {label} block, found {global_text_count}')
        return None

    # Preserve the Atlas scope currently added by the production workflow, but
    # move that guarded widening into the reusable assembler so workflow logic
    # no longer mutates the bridge ad hoc.
    replacements = [
        (
            "'growlens','thc-grow-doc','tools','projects','puzzles'\n    ];",
            "'growlens','thc-grow-doc','tools','projects','puzzles','atlas','assets/images/atlas'\n    ];",
            'Atlas deployment target allowlist',
        ),
        (
            "'thc-grow-doc/api/visual-observations.php','tools/index.html','projects/index.html','puzzles/current.json'\n    ];",
            "'thc-grow-doc/api/visual-observations.php','tools/index.html','projects/index.html','puzzles/current.json',\n        'atlas/index.html','atlas/root-system/index.html','atlas/root-system/rhizosphere/index.html','atlas/downloads/index.html',\n        'assets/images/atlas/root-system/rhizosphere-microbe-interaction.svg'\n    ];",
            'Atlas required-file allowlist',
        ),
        (
            "'games/protect-the-plants/','games/weedopolis/','games/crossword/','games/who-took-it/','growlens/','thc-grow-doc/','tools/','projects/','puzzles/'\n    ];",
            "'games/protect-the-plants/','games/weedopolis/','games/crossword/','games/who-took-it/','growlens/','thc-grow-doc/','tools/','projects/','puzzles/',\n        'atlas/','assets/images/atlas/'\n    ];",
            'Atlas prefix allowlist',
        ),
    ]
    for old, new, label in replacements:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f'expected exactly one {label} block, found {count}')
        text = text.replace(old, new, 1)

    transformed, report = transform_bridge(text, repo)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(transformed)

print(json.dumps({**report, 'atlasScope': True, 'output': str(output)}, indent=2))
