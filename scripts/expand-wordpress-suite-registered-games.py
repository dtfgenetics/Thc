#!/usr/bin/env python3
"""Expand an assembled DTF Public Suite bridge with registered local static games.

The canonical bridge assembler remains fail-closed and hash-pinned. This post-assembly
step widens only missing approved game target, required-index, route-prefix, and
live-verification entries for local static games present in public-apps.json.
Every promoted route must have a source index whose HTML contains the registry title.

The canonical assembler can already apply wordpress_suite_registry_patch.py. This
expander is therefore deliberately idempotent: it never assumes those server-side
arrays still have their historic adjacency, and only patches a list when one or more
registered values are actually absent.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
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


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label} anchor, found {count}")
    text = text.replace(old, new, 1)


def array_values(variable: str) -> set[str]:
    match = re.search(rf"(?:const\s+)?{re.escape(variable)}\s*=\s*\[(.*?)\n\s*\];", text, re.S)
    if not match:
        # The deployer embeds PHP arrays as $targets/$required/$prefixes.
        match = re.search(rf"\${re.escape(variable)}\s*=\s*\[(.*?)\n\s*\];", text, re.S)
    if not match:
        raise SystemExit(f"assembled bridge array {variable!r} not found")
    return set(re.findall(r"'([^']+)'", match.group(1)))


# Strain Match and Lost in the Terps are the historic anchors already present in
# the guarded bridge. Newer canonical assembly can already populate target,
# required-file, and prefix arrays from the registry, so patch each independently.
historic_targets = {"games/strain-match", "games/lost-in-the-terps"}
for item in registered:
    if item["target"] in historic_targets and item["target"] not in text:
        raise SystemExit(f"historic registered game is missing from assembled bridge: {item['target']}")

current_targets = array_values("targets")
missing_target_items = [item for item in registered if item["target"] not in current_targets]
if missing_target_items:
    insertion = ",".join(f"'{item['target']}'" for item in missing_target_items)
    replace_once(
        "'games/strain-match','games/lost-in-the-terps','games/protect-the-plants'",
        f"'games/strain-match','games/lost-in-the-terps',{insertion},'games/protect-the-plants'",
        "registered game target allowlist",
    )

current_required = array_values("required")
missing_required_items = [
    item for item in registered if f"{item['target']}/index.html" not in current_required
]
if missing_required_items:
    insertion = ",".join(f"'{item['target']}/index.html'" for item in missing_required_items)
    replace_once(
        "'games/lost-in-the-terps/data/puzzles.json','games/protect-the-plants/index.html'",
        f"'games/lost-in-the-terps/data/puzzles.json',{insertion},'games/protect-the-plants/index.html'",
        "registered game required-index list",
    )

current_prefixes = array_values("prefixes")
missing_prefix_items = [
    item for item in registered if f"{item['target']}/" not in current_prefixes
]
if missing_prefix_items:
    insertion = ",".join(f"'{item['target']}/'" for item in missing_prefix_items)
    replace_once(
        "'games/strain-match/','games/lost-in-the-terps/','games/protect-the-plants/'",
        f"'games/strain-match/','games/lost-in-the-terps/',{insertion},'games/protect-the-plants/'",
        "registered game route-prefix allowlist",
    )

# Browser/live checks are a separate concern from server-side allowlists. Add
# only routes whose exact public path is not yet represented in the deployer.
missing_verify_items = [
    item
    for item in registered
    if f"['{item['route']}'," not in text and f'["{item["route"]}",' not in text
]
if missing_verify_items:
    extra_verify = ", ".join(
        f"['{item['route']}', {json.dumps(item['title'])}]" for item in missing_verify_items
    )
    replace_once(
        "['/games/strain-match/', 'Strain Match'], ['/games/lost-in-the-terps/', 'Lost in the Terps'], ['/games/protect-the-plants/', 'Protect the Plants']",
        f"['/games/strain-match/', 'Strain Match'], ['/games/lost-in-the-terps/', 'Lost in the Terps'], {extra_verify}, ['/games/protect-the-plants/', 'Protect the Plants']",
        "registered game live-verification list",
    )

# Re-read the arrays after any mutations and require complete registry parity.
current_targets = array_values("targets")
current_required = array_values("required")
current_prefixes = array_values("prefixes")
for item in registered:
    if item["target"] not in current_targets:
        raise SystemExit(f"assembled bridge still missing target {item['target']}")
    if f"{item['target']}/index.html" not in current_required:
        raise SystemExit(f"assembled bridge still missing required index {item['target']}/index.html")
    if f"{item['target']}/" not in current_prefixes:
        raise SystemExit(f"assembled bridge still missing prefix {item['target']}/")
    if item["route"] not in text:
        raise SystemExit(f"assembled bridge still missing live route {item['route']}")

# Keep WordPress-owned surfaces outside the widened app transaction.
if "games/" in current_prefixes:
    raise SystemExit("unsafe broad games/ route prefix entered assembled bridge")
for forbidden in ["'index.html'", "'learn/'", "'blog/'"]:
    if forbidden not in text:
        raise SystemExit(f"assembled bridge lost protected WordPress ownership marker: {forbidden}")

deployer_path.write_text(text)
print(
    "expanded assembled bridge for "
    f"{len(registered)} registered local static games; "
    f"added targets={len(missing_target_items)} "
    f"required={len(missing_required_items)} "
    f"prefixes={len(missing_prefix_items)} "
    f"live_checks={len(missing_verify_items)}"
)
