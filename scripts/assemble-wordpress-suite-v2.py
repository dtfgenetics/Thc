#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import pathlib
import sys

# Canonical SHA-256 of the seven GitHub-stored v2 fragments. The validation
# workflow independently runs Node and embedded-PHP syntax checks after this
# integrity gate, so this hash protects fragment completeness/order while the
# language parsers validate executable correctness.
EXPECTED_SHA256 = "a7041f53148643971293f3634197909c4f7609d389f7ecdebd6c3502057d0e90"
PART_DIR = pathlib.Path(__file__).resolve().parent / "wordpress-suite-v2"
OUTPUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "deploy-public-suite-via-wordpress-v2.mjs")

parts = sorted(PART_DIR.glob("part-*.jsfrag"))
if [p.name for p in parts] != [f"part-{i:02d}.jsfrag" for i in range(7)]:
    raise SystemExit(f"unexpected v2 fragment set: {[p.name for p in parts]}")

payload = b"".join(p.read_bytes() for p in parts)
actual = hashlib.sha256(payload).hexdigest()
if actual != EXPECTED_SHA256:
    raise SystemExit(f"v2 deployer fragment SHA-256 mismatch: expected {EXPECTED_SHA256}, got {actual}")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_bytes(payload)
print(f"assembled={OUTPUT} bytes={len(payload)} sha256={actual}")
