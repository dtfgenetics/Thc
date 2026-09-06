#!/usr/bin/env python3
"""Rebuild reviewed external game contracts from exact pinned commits into a release tree.

This module is shared by the canonical public-suite build and the WordPress packager so
qualification, artifact generation, and deployment cannot disagree about which external
release candidates are present.
"""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

PROMOTABLE_STATUSES = {"release-candidate", "ready-to-package"}


def parse_revision_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise SystemExit(f"external game source revision missing: {path}")
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, sep, value = line.partition("=")
        if not sep:
            raise SystemExit(f"malformed source revision line in {path}: {line!r}")
        values[key.strip()] = value.strip()
    return values


def stage_external_game(contract_path: Path, repo_root: Path, release_root: Path) -> dict[str, str]:
    contract = json.loads(contract_path.read_text())
    if contract.get("status") not in PROMOTABLE_STATUSES:
        raise SystemExit(f"external game contract is not promotable: {contract_path.name}")

    route = str(contract.get("route") or "")
    repository = str(contract.get("repository") or "")
    if not route.startswith("/games/") or not route.endswith("/") or route.count("/") != 3:
        raise SystemExit(f"unsafe external game route in {contract_path.name}: {route!r}")
    if not repository.startswith("dtfgenetics/"):
        raise SystemExit(f"unsafe external game repository in {contract_path.name}: {repository!r}")

    target = route.strip("/")
    revision_path = repo_root / "site" / "public-route-patch" / target / "source-revision.txt"
    revision = parse_revision_file(revision_path)
    if revision.get("repository") != repository:
        raise SystemExit(f"external game repository/source pin mismatch for {target}")
    commit = revision.get("commit", "")
    if len(commit) != 40 or any(ch not in "0123456789abcdef" for ch in commit):
        raise SystemExit(f"invalid pinned commit for {target}: {commit!r}")
    if revision.get("route") != route:
        raise SystemExit(f"external game route/source pin mismatch for {target}")

    with tempfile.TemporaryDirectory(prefix=f"dtf-{contract['id']}-") as temp:
        checkout = Path(temp) / "repo"
        subprocess.run(["git", "init", str(checkout)], check=True)
        subprocess.run(
            ["git", "-C", str(checkout), "remote", "add", "origin", f"https://github.com/{repository}.git"],
            check=True,
        )
        subprocess.run(["git", "-C", str(checkout), "fetch", "--depth=1", "origin", commit], check=True)
        subprocess.run(["git", "-C", str(checkout), "checkout", "--detach", "FETCH_HEAD"], check=True)
        actual = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
        if actual != commit:
            raise SystemExit(f"external game checkout drift for {target}: expected {commit}, got {actual}")

        subprocess.run(["npm", "install", "--ignore-scripts"], cwd=checkout, check=True)
        subprocess.run(["npm", "test"], cwd=checkout, check=True)
        subprocess.run(["npm", "run", "build"], cwd=checkout, check=True)
        subprocess.run(["npm", "run", "validate:release"], cwd=checkout, check=True)

        dist = checkout / "dist"
        if not (dist / "index.html").is_file():
            raise SystemExit(f"external game build did not produce index.html: {target}")
        destination = release_root / target
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(dist, destination)
        shutil.copy2(revision_path, destination / "source-revision.txt")

    return {
        "id": str(contract["id"]),
        "target": target,
        "route": route,
        "repository": repository,
        "commit": commit,
        "artifact": str(contract.get("artifact") or ""),
        "status": str(contract.get("status") or ""),
    }


def stage_external_games(repo_root: Path, release_root: Path) -> list[dict[str, str]]:
    contracts_dir = repo_root / "site" / "deployment" / "external-games"
    contracts = sorted(contracts_dir.glob("*.json"))
    if not contracts:
        return []
    return [stage_external_game(path, repo_root, release_root) for path in contracts]


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("usage: external_game_packaging.py RELEASE_DIR [MANIFEST_JSON]")
    repo_root = Path(__file__).resolve().parents[1]
    release_root = Path(sys.argv[1]).resolve()
    if not release_root.is_dir():
        raise SystemExit(f"release directory not found: {release_root}")
    games = stage_external_games(repo_root, release_root)
    payload = {"externalGames": games}
    if len(sys.argv) == 3:
        manifest = Path(sys.argv[2]).resolve()
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps(payload, separators=(",", ":")))


if __name__ == "__main__":
    main()
