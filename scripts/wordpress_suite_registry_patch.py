#!/usr/bin/env python3
"""Synchronize the hardened WordPress Public Suite bridge with public-apps.json.

The canonical bridge remains hash-pinned. This module is applied only after that
base hash passes. It derives only local, static, ready-to-package game routes
from the canonical registry and widens the bridge with those exact directories.
No wildcard games/ ownership is permitted.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

SAFE_TARGET = re.compile(r"^games/[a-z0-9][a-z0-9-]*$")


def _replace_once(payload: bytes, old: bytes, new: bytes, label: str) -> bytes:
    count = payload.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label} anchor, found {count}")
    return payload.replace(old, new, 1)


def registered_local_static_games(repo_root: pathlib.Path) -> list[str]:
    registry_path = repo_root / "site" / "deployment" / "public-apps.json"
    registry = json.loads(registry_path.read_text())
    targets: list[str] = []
    for app in registry.get("apps", []):
        source = str(app.get("sourcePath") or "").rstrip("/")
        route = str(app.get("route") or "")
        if not (
            app.get("repository") == "dtfgenetics/Thc"
            and app.get("runtime") == "static"
            and app.get("status") == "ready-to-package"
            and source.startswith("site/public-route-patch/games/")
            and route.startswith("/games/")
            and route.endswith("/")
        ):
            continue
        target = route.strip("/")
        if not SAFE_TARGET.fullmatch(target):
            raise SystemExit(f"unsafe registered local game target: {target!r}")
        expected_source = f"site/public-route-patch/{target}"
        if source != expected_source:
            raise SystemExit(
                f"registry source/route mismatch for {target}: source={source!r}, expected={expected_source!r}"
            )
        targets.append(target)
    if len(targets) != len(set(targets)):
        raise SystemExit("duplicate local static game targets in public-apps registry")
    return sorted(targets)


def _array_values(payload: bytes, variable: bytes) -> set[str]:
    pattern = rb"\$" + re.escape(variable) + rb"\s*=\s*\[(.*?)\n\s*\];"
    match = re.search(pattern, payload, re.S)
    if not match:
        raise SystemExit(f"bridge array ${variable.decode()} not found")
    return {item.decode() for item in re.findall(rb"'([^']+)'", match.group(1))}


def patch_payload(payload: bytes, repo_root: pathlib.Path) -> bytes:
    registry_targets = registered_local_static_games(repo_root)

    existing_targets = _array_values(payload, b"targets")
    missing_targets = [target for target in registry_targets if target not in existing_targets]
    if missing_targets:
        insertion = "        " + ",".join(repr(target) for target in missing_targets) + ",\n"
        payload = _replace_once(
            payload,
            b"        'growlens','thc-grow-doc','tools','projects','puzzles'\n",
            insertion.encode() + b"        'growlens','thc-grow-doc','tools','projects','puzzles'\n",
            "registry target tail",
        )

    existing_required = _array_values(payload, b"required")
    missing_required = [f"{target}/index.html" for target in registry_targets if f"{target}/index.html" not in existing_required]
    if missing_required:
        insertion = "        " + ",".join(repr(path) for path in missing_required) + ",\n"
        payload = _replace_once(
            payload,
            b"        'thc-grow-doc/api/visual-observations.php','tools/index.html','projects/index.html','puzzles/current.json'\n",
            insertion.encode() + b"        'thc-grow-doc/api/visual-observations.php','tools/index.html','projects/index.html','puzzles/current.json'\n",
            "registry required-file tail",
        )

    existing_prefixes = _array_values(payload, b"prefixes")
    missing_prefixes = [f"{target}/" for target in registry_targets if f"{target}/" not in existing_prefixes]
    if missing_prefixes:
        insertion = ",".join(repr(prefix) for prefix in missing_prefixes) + ","
        payload = _replace_once(
            payload,
            b"'games/protect-the-plants/','games/weedopolis/','games/crossword/','games/who-took-it/','growlens/'",
            insertion.encode() + b"'games/protect-the-plants/','games/weedopolis/','games/crossword/','games/who-took-it/','growlens/'",
            "registry prefix tail",
        )

    targets = _array_values(payload, b"targets")
    required = _array_values(payload, b"required")
    prefixes = _array_values(payload, b"prefixes")
    for target in registry_targets:
        if target not in targets:
            raise SystemExit(f"bridge target missing after registry patch: {target}")
        if f"{target}/index.html" not in required:
            raise SystemExit(f"bridge required index missing after registry patch: {target}/index.html")
        if f"{target}/" not in prefixes:
            raise SystemExit(f"bridge prefix missing after registry patch: {target}/")

    if "games/" in prefixes:
        raise SystemExit("unsafe broad games/ prefix is forbidden")
    for forbidden in ("index.html", "learn", "blog"):
        if forbidden in targets:
            raise SystemExit(f"WordPress-owned target entered bridge: {forbidden}")

    return payload


def validate_payload(payload: bytes, repo_root: pathlib.Path) -> dict[str, object]:
    registry_targets = registered_local_static_games(repo_root)
    targets = _array_values(payload, b"targets")
    required = _array_values(payload, b"required")
    prefixes = _array_values(payload, b"prefixes")
    missing = []
    for target in registry_targets:
        if target not in targets:
            missing.append(target)
        if f"{target}/index.html" not in required:
            missing.append(f"{target}/index.html")
        if f"{target}/" not in prefixes:
            missing.append(f"{target}/")
    if missing:
        raise SystemExit("bridge/registry parity failure: " + ", ".join(missing))
    if "games/" in prefixes:
        raise SystemExit("unsafe broad games/ prefix is forbidden")
    return {
        "ok": True,
        "registeredLocalStaticGames": registry_targets,
        "targets": len(targets),
        "required": len(required),
        "prefixes": len(prefixes),
    }


def main() -> None:
    repo_root = pathlib.Path(__file__).resolve().parents[1]
    if len(sys.argv) != 2:
        raise SystemExit("usage: wordpress_suite_registry_patch.py ASSEMBLED_DEPLOYER")
    path = pathlib.Path(sys.argv[1])
    payload = path.read_bytes()
    report = validate_payload(payload, repo_root)
    print(json.dumps(report, separators=(",", ":")))


if __name__ == "__main__":
    main()
