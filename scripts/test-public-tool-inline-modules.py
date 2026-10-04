#!/usr/bin/env python3
"""Syntax-check inline ES modules embedded in canonical public tool pages."""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "site" / "public-route-patch"
INLINE_MODULE = re.compile(
    r'<script\s+type=["\']module["\']\s*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)

checked: list[str] = []
failures: list[dict[str, str]] = []
for page in sorted(PUBLIC_ROOT.glob("*/index.html")):
    for index, source in enumerate(INLINE_MODULE.findall(page.read_text()), start=1):
        if not source.strip():
            continue
        with tempfile.NamedTemporaryFile(suffix=".mjs") as module:
            module.write(source.encode())
            module.flush()
            result = subprocess.run(
                ["node", "--check", module.name],
                capture_output=True,
                text=True,
                check=False,
            )
        identity = f"{page.relative_to(ROOT)}#inline-module-{index}"
        checked.append(identity)
        if result.returncode:
            failures.append({"module": identity, "error": result.stderr.strip()})

if failures:
    raise SystemExit("inline public-tool module syntax failure: " + json.dumps(failures))

print(json.dumps({"ok": True, "checked": checked, "count": len(checked)}, separators=(",", ":")))
