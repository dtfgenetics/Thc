#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import pathlib
import sys

# Canonical SHA-256 of the executable v2 deployer after the guarded fragment-
# boundary normalization below. The source fragments are stored separately to
# stay within the GitHub contents update limits; this assembler is the single
# deterministic source of the executable used by validation and production.
EXPECTED_SHA256 = "a7041f53148643971293f3634197909c4f7609d389f7ecdebd6c3502057d0e90"
PART_DIR = pathlib.Path(__file__).resolve().parent / "wordpress-suite-v2"
OUTPUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "deploy-public-suite-via-wordpress-v2.mjs")

parts = sorted(PART_DIR.glob("part-*.jsfrag"))
if [p.name for p in parts] != [f"part-{i:02d}.jsfrag" for i in range(7)]:
    raise SystemExit(f"unexpected v2 fragment set: {[p.name for p in parts]}")

raw = b"".join(p.read_bytes() for p in parts)
# part-01 historically ended in `register_` while part-02 began in
# `_rest_route`, producing the runtime-only typo `register__rest_route`.
# Normalize exactly that one known boundary and refuse any ambiguous source.
bad_boundary = b"register__rest_route('dtf-suite/v2', '/init'"
good_boundary = b"register_rest_route('dtf-suite/v2', '/init'"
if raw.count(bad_boundary) != 1:
    raise SystemExit(f"expected exactly one known REST-route fragment boundary, found {raw.count(bad_boundary)}")
payload = raw.replace(bad_boundary, good_boundary, 1)
if b"register__rest_route" in payload:
    raise SystemExit("double-underscore register__rest_route remains after boundary normalization")

actual = hashlib.sha256(payload).hexdigest()
if actual != EXPECTED_SHA256:
    raise SystemExit(f"v2 deployer fragment SHA-256 mismatch: expected {EXPECTED_SHA256}, got {actual}")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_bytes(payload)
print(f"assembled={OUTPUT} bytes={len(payload)} sha256={actual}")
