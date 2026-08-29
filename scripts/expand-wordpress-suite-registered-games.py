#!/usr/bin/env python3
"""Expand an assembled DTF Public Suite bridge with registered local static games.

The canonical bridge assembler remains fail-closed and hash-pinned. This post-assembly
step widens only the already-approved game target, required-index, route-prefix, and
live-verification lists for local static games that are present in public-apps.json.
Every promoted route must have a source index whose HTML contains the registry title.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: expand-wordpress-suite-registered-games.py ASSEMBLED_DEPLOYER")

repo_root = Path(__file__).resolve().parents[1]
deployer_path = Path(sys.argv[1]).resolve()
if not deployer_path.is_file():
    raise SystemExit(f"assembled deployer not found: {deployer_path}")

registry = json.loads((repo_root / "site/deployment/public-apps.json").read_text())
registered: list[dict[str, str]] = []
for app in registry.get("apps", []):
    source = str(app.get("sourcePath") or "").rstrip("/")
    route = str(app.get("route") or "")
    title = str(app.get("title") or "").strip()
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
    if target.count("/") != 1 or not target.startswith("games/"):
        raise SystemExit(f"unsafe registered game route: {route}")
    source_index = repo_root / source / "index.html"
    if not source_index.is_file() or source_index.stat().st_size == 0:
        raise SystemExit(f"registered game is missing source index: {source_index.relative_to(repo_root)}")
    html = source_index.read_text()
    if not title or title.lower() not in html.lower():
        raise SystemExit(f"registered game title marker {title!r} missing from {source_index.relative_to(repo_root)}")
    registered.append({"target": target, "route": route, "title": title})

if not registered:
    raise SystemExit("no registered local static games found")

if len({item["target"] for item in registered}) != len(registered):
    raise SystemExit("duplicate registered local game targets")
if len({item["route"] for item in registered}) != len(registered):
    raise SystemExit("duplicate registered local game routes")

text = deployer_path.read_text()

# Strain Match and Lost in the Terps are the historic anchors already present in
# the guarded assembler. Add only registered games not already represented.
historic_targets = {"games/strain-match", "games/lost-in-the-terps"}
extra = [item for item in registered if item["target"] not in historic_targets]

for item in registered:
    if item["target"] in text and item["route"] in text:
        continue
    if item in extra:
        continue
    raise SystemExit(f"historic registered game is missing from assembled bridge: {item['target']}")

extra = [item for item in extra if item["target"] not in text or item["route"] not in text]
if not extra:
    print(f"assembled bridge already covers {len(registered)} registered local static games")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label} anchor, found {count}")
    text = text.replace(old, new, 1)

extra_targets = ",".join(f"'{item['target']}'" for item in extra)
replace_once(
    "'games/strain-match','games/lost-in-the-terps','games/protect-the-plants'",
    f"'games/strain-match','games/lost-in-the-terps',{extra_targets},'games/protect-the-plants'",
    "registered game target allowlist",
)

extra_required = ",".join(f"'{item['target']}/index.html'" for item in extra)
replace_once(
    "'games/lost-in-the-terps/data/puzzles.json','games/protect-the-plants/index.html'",
    f"'games/lost-in-the-terps/data/puzzles.json',{extra_required},'games/protect-the-plants/index.html'",
    "registered game required-index list",
)

extra_prefixes = ",".join(f"'{item['target']}/'" for item in extra)
replace_once(
    "'games/strain-match/','games/lost-in-the-terps/','games/protect-the-plants/'",
    f"'games/strain-match/','games/lost-in-the-terps/',{extra_prefixes},'games/protect-the-plants/'",
    "registered game route-prefix allowlist",
)

extra_verify = ", ".join(f"['{item['route']}', {json.dumps(item['title'])}]" for item in extra)
replace_once(
    "['/games/strain-match/', 'Strain Match'], ['/games/lost-in-the-terps/', 'Lost in the Terps'], ['/games/protect-the-plants/', 'Protect the Plants']",
    f"['/games/strain-match/', 'Strain Match'], ['/games/lost-in-the-terps/', 'Lost in the Terps'], {extra_verify}, ['/games/protect-the-plants/', 'Protect the Plants']",
    "registered game live-verification list",
)

for item in registered:
    if item["target"] not in text:
        raise SystemExit(f"assembled bridge still missing target {item['target']}")
    if item["route"] not in text:
        raise SystemExit(f"assembled bridge still missing live route {item['route']}")

# Keep WordPress-owned surfaces outside the widened app transaction.
for forbidden in ["'index.html'", "'learn/'", "'blog/'"]:
    if forbidden not in text:
        raise SystemExit(f"assembled bridge lost protected WordPress ownership marker: {forbidden}")

deployer_path.write_text(text)
print(f"expanded assembled bridge for {len(registered)} registered local static games; added {len(extra)}")
