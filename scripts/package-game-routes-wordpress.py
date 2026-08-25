#!/usr/bin/env python3
"""Package only the DTF game routes that need an atomic WordPress-side directory swap."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

if len(sys.argv) != 3:
    raise SystemExit("usage: package-game-routes-wordpress.py RELEASE_DIR OUTPUT_ZIP")

root = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
if not root.is_dir():
    raise SystemExit(f"release directory not found: {root}")

allowed = [
    "games/index.html",
    "games/dtf-route.css",
    "games/high-iq",
    "games/grower-conversations",
]
required = [
    "games/index.html",
    "games/dtf-route.css",
    "games/high-iq/index.html",
    "games/high-iq/app.js",
    "games/high-iq/high-iq.css",
    "games/high-iq/data/manifest.json",
    "games/grower-conversations/index.html",
    "games/grower-conversations/app.js",
    "games/grower-conversations/grower-conversations.css",
    "games/grower-conversations/data/prompt-bank.json",
]

for rel in required:
    path = root / rel
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"required deploy file missing or empty: {rel}")

files: dict[str, dict[str, int | str]] = {}

def add_file(path: Path, rel: str) -> None:
    pure = PurePosixPath(rel)
    if pure.is_absolute() or ".." in pure.parts or rel.startswith("./"):
        raise SystemExit(f"unsafe archive path: {rel}")
    st = path.lstat()
    if stat.S_ISLNK(st.st_mode):
        raise SystemExit(f"symlinks are not permitted: {rel}")
    if not stat.S_ISREG(st.st_mode):
        raise SystemExit(f"non-regular archive entry rejected: {rel}")
    data = path.read_bytes()
    files[rel] = {"size": len(data), "sha256": hashlib.sha256(data).hexdigest()}

for item in allowed:
    src = root / item
    if not src.exists():
        raise SystemExit(f"allowlisted release path missing: {item}")
    if src.is_file():
        add_file(src, item)
    else:
        for path in sorted(src.rglob("*")):
            if path.is_dir():
                continue
            add_file(path, path.relative_to(root).as_posix())

for rel in files:
    if rel == "index.html" or rel.startswith("learn/") or rel.startswith("blog/") or rel.startswith("wp-"):
        raise SystemExit(f"forbidden WordPress-owned path entered archive: {rel}")

manifest = {
    "schemaVersion": 1,
    "purpose": "dtfseeds-game-route-directory-swap",
    "wordPressOwnedRoutesExcluded": ["/", "/learn/", "/blog/", "/shop/", "/seeds/"],
    "targets": allowed,
    "required": required,
    "fileCount": len(files),
    "uncompressedBytes": sum(int(meta["size"]) for meta in files.values()),
    "files": files,
}
manifest_bytes = (json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n").encode()
manifest["manifestSha256"] = hashlib.sha256(manifest_bytes).hexdigest()
manifest_bytes = (json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n").encode()

out.parent.mkdir(parents=True, exist_ok=True)
if out.exists():
    out.unlink()
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zf:
    for rel in sorted(files):
        zf.write(root / rel, arcname=rel)
    info = zipfile.ZipInfo(".dtf-game-route-manifest.json")
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (0o100644 & 0xFFFF) << 16
    zf.writestr(info, manifest_bytes)

summary = {
    "archive": str(out),
    "archiveBytes": out.stat().st_size,
    "archiveSha256": hashlib.sha256(out.read_bytes()).hexdigest(),
    "fileCount": len(files),
    "uncompressedBytes": manifest["uncompressedBytes"],
    "targets": allowed,
}
print(json.dumps(summary, separators=(",", ":")))