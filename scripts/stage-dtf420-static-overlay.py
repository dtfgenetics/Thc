#!/usr/bin/env python3
"""Build and stage the approved Dtf420 static child-route overlay.

The source application remains in dtfgenetics/Dtf420. This importer clones its
current main branch, builds the explicit static export, requires the source
ownership manifest to exactly match this repository's production contract, and
copies only approved child routes/shared assets under an isolated staging
namespace. Nothing is written directly to /learn, /community, /games, or /.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

REPO_URL = "https://github.com/dtfgenetics/Dtf420.git"
STAGING_NAME = "dtf-content-overlay"


def run(*args: str, cwd: Path | None = None) -> None:
    subprocess.run(args, cwd=cwd, check=True)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def copy_path(source_root: Path, destination_root: Path, rel: str) -> None:
    src = source_root / rel
    dst = destination_root / rel
    if not src.exists():
        raise SystemExit(f"approved Dtf420 overlay source is missing: {rel}")
    if dst.exists() or dst.is_symlink():
        if dst.is_dir() and not dst.is_symlink():
            shutil.rmtree(dst)
        else:
            dst.unlink()
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dst, symlinks=False)
    elif src.is_file():
        shutil.copy2(src, dst)
    else:
        raise SystemExit(f"unsupported Dtf420 overlay source type: {rel}")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: stage-dtf420-static-overlay.py RELEASE_DIR")

    repo_root = Path(__file__).resolve().parents[1]
    release_root = Path(sys.argv[1]).resolve()
    if not release_root.is_dir():
        raise SystemExit(f"release directory not found: {release_root}")

    contract_path = repo_root / "site" / "deployment" / "dtf420-static-overlay.json"
    contract = load_json(contract_path)
    if contract.get("canonicalOrigin") != "https://dtfseeds.com":
        raise SystemExit("production overlay contract has the wrong canonical origin")

    forbidden = {"", "learn", "blog", "journal", "community", "games", "seeds", "tools"}
    for prefix in contract.get("routePrefixes", []):
        normalized = str(prefix).strip("/")
        if normalized in forbidden or "/" not in normalized:
            raise SystemExit(f"unsafe broad production overlay prefix: {prefix!r}")

    with tempfile.TemporaryDirectory(prefix="dtf420-overlay-") as tmp:
        source_repo = Path(tmp) / "Dtf420"
        run("git", "clone", "--depth=1", "--branch", "main", REPO_URL, str(source_repo))
        source_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source_repo, text=True).strip()
        if not re.fullmatch(r"[0-9a-f]{40}", source_sha):
            raise SystemExit("could not resolve Dtf420 source revision")

        run("npm", "ci", "--no-audit", "--no-fund", cwd=source_repo)
        run("npm", "run", "build:static-overlay", cwd=source_repo)
        run("npm", "run", "verify:static-overlay", cwd=source_repo)

        source_contract = load_json(source_repo / "deployment" / "static-overlay.json")
        if source_contract != contract:
            raise SystemExit(
                "Dtf420 overlay ownership manifest differs from the reviewed production contract; "
                "update both repositories together before publishing"
            )

        source_out = source_repo / "out"
        staging_root = release_root / STAGING_NAME
        if staging_root.exists():
            shutil.rmtree(staging_root)
        staging_root.mkdir(parents=True)

        for rel in [*contract["routePrefixes"], *contract["sharedPaths"]]:
            copy_path(source_out, staging_root, rel)

        for rel in contract["requiredRoutes"]:
            target = staging_root / rel
            if not target.is_file() or target.stat().st_size < 1:
                raise SystemExit(f"staged Dtf420 required route is missing or empty: {rel}")

        metadata = {
            "schemaVersion": 1,
            "purpose": contract["purpose"],
            "canonicalOrigin": contract["canonicalOrigin"],
            "repository": "dtfgenetics/Dtf420",
            "commit": source_sha,
            "routePrefixes": contract["routePrefixes"],
            "sharedPaths": contract["sharedPaths"],
            "wordpressOwnedRoutes": contract["wordpressOwnedRoutes"],
            "requiredRoutes": contract["requiredRoutes"],
        }
        (staging_root / "overlay-manifest.json").write_text(
            json.dumps(metadata, indent=2, sort_keys=True) + "\n"
        )

        index_count = sum(1 for prefix in contract["routePrefixes"] for _ in (staging_root / prefix).rglob("index.html"))
        if index_count < 200:
            raise SystemExit(f"staged Dtf420 overlay contains too few page routes: {index_count}")

        print(json.dumps({
            "ok": True,
            "repository": "dtfgenetics/Dtf420",
            "commit": source_sha,
            "stagingDirectory": STAGING_NAME,
            "publishableIndexRoutes": index_count,
            "routePrefixes": len(contract["routePrefixes"]),
            "sharedPaths": len(contract["sharedPaths"]),
        }, separators=(",", ":")))


if __name__ == "__main__":
    main()
