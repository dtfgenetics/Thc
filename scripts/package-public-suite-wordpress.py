#!/usr/bin/env python3
"""Build an allowlisted DTFSeeds public-app archive for WordPress-mediated deployment.

The package intentionally excludes the WordPress-owned root and direct /learn/ routes so a
static suite deployment cannot recreate the shadowing incident fixed on 2026-08-21.
Dtf420 child routes are built from its current main branch, verified against a reviewed
cross-repository ownership contract, and staged below /dtf-content-overlay/ for a later
atomic promotion step. The transactional publisher therefore never receives direct
ownership of /learn/, /community/, /games/, or the site root.
Registered local static game routes are derived from the canonical public-app registry
so a tested game cannot be registered for deployment and then silently omitted from
the WordPress archive by a stale hand-maintained allowlist.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys
import zipfile

if len(sys.argv) != 3:
    raise SystemExit("usage: package-public-suite-wordpress.py RELEASE_DIR OUTPUT_ZIP")

root = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
repo_root = Path(__file__).resolve().parents[1]
if not root.is_dir():
    raise SystemExit(f"release directory not found: {root}")

# Build the reviewed Dtf420 child-route export into an isolated staging namespace.
# Direct WordPress-owned paths remain forbidden below when the archive is assembled.
subprocess.run(
    [sys.executable, str(repo_root / "scripts" / "stage-dtf420-static-overlay.py"), str(root)],
    check=True,
)

overlay_manifest_path = root / "dtf-content-overlay" / "overlay-manifest.json"
if not overlay_manifest_path.is_file() or overlay_manifest_path.stat().st_size == 0:
    raise SystemExit("Dtf420 overlay staging did not produce overlay-manifest.json")
overlay_manifest = json.loads(overlay_manifest_path.read_text())
if overlay_manifest.get("canonicalOrigin") != "https://dtfseeds.com":
    raise SystemExit("Dtf420 staged overlay has the wrong canonical origin")
if overlay_manifest.get("repository") != "dtfgenetics/Dtf420":
    raise SystemExit("Dtf420 staged overlay has the wrong source repository")
if not str(overlay_manifest.get("commit") or "").isalnum() or len(str(overlay_manifest.get("commit") or "")) != 40:
    raise SystemExit("Dtf420 staged overlay does not record a 40-character source revision")

allowed = [
    "games/index.html",
    "games/dtf-route.css",
    "games/dtf-shell.css",
    "games/high-land",
    "games/high-iq",
    "games/high-life",
    "games/grower-conversations",
    "games/seed-man-platformer",
    "games/protect-the-plants",
    "games/bud-or-bluff",
    "games/strain-showdown",
    "games/terpocalypse",
    "games/phenoquest",
    "games/strain-match",
    "games/lost-in-the-terps",
    "games/weedopolis",
    "games/crossword",
    "games/who-took-it",
    "growlens",
    "thc-grow-doc",
    "tools",
    "projects",
    "puzzles",
    "atlas",
    "assets/images/atlas",
    "dtf-content-overlay",
]

public_apps_path = repo_root / "site" / "deployment" / "public-apps.json"
public_apps = json.loads(public_apps_path.read_text())
registered_local_game_targets: list[str] = []
for app in public_apps.get("apps", []):
    source = str(app.get("sourcePath") or "").rstrip("/")
    route = str(app.get("route") or "")
    if (
        app.get("repository") == "dtfgenetics/Thc"
        and app.get("runtime") == "static"
        and app.get("status") == "ready-to-package"
        and source.startswith("site/public-route-patch/games/")
        and route.startswith("/games/")
        and route.endswith("/")
    ):
        target = route.strip("/")
        if target.count("/") != 1 or not target.startswith("games/"):
            raise SystemExit(f"unsafe registered local game route: {route}")
        registered_local_game_targets.append(target)
        if target not in allowed:
            allowed.append(target)

if len(registered_local_game_targets) != len(set(registered_local_game_targets)):
    raise SystemExit("duplicate registered local game targets in public-app registry")

required = [
    "games/index.html",
    "games/dtf-shell.css",
    "games/high-land/index.html",
    "games/high-iq/index.html",
    "games/high-iq/app.js",
    "games/high-iq/app-v3.js",
    "games/high-iq/game-core.mjs",
    "games/high-iq/high-iq.css",
    "games/high-iq/high-iq-v3.css",
    "games/high-iq/data/manifest.json",
    "games/high-iq/data/questions-001-010.v2.2.json",
    "games/high-iq/data/questions-011-020.v2.2.json",
    "games/high-iq/data/questions-021-030.v2.2.json",
    "games/high-iq/data/questions-031-040.v2.2.json",
    "games/high-iq/data/questions-041-050.v2.2.json",
    "games/high-iq/data/questions-051-060.v2.2.json",
    "games/high-iq/data/questions-061-070.v2.2.json",
    "games/high-iq/data/questions-071-080.v2.2.json",
    "games/high-iq/data/sources-001-025.v2.2.json",
    "games/high-iq/data/sources-026-050.v2.2.json",
    "games/high-life/index.html",
    "games/grower-conversations/index.html",
    "games/seed-man-platformer/index.html",
    "games/protect-the-plants/index.html",
    "games/protect-the-plants/api.php",
    "games/protect-the-plants/presence.php",
    "games/protect-the-plants/gameplay-v3.js",
    "games/protect-the-plants/gameplay-v3.css",
    "games/bud-or-bluff/index.html",
    "games/bud-or-bluff/app-v2.js",
    "games/bud-or-bluff/styles.css",
    "games/bud-or-bluff/v2.css",
    "games/bud-or-bluff/api-v2.php",
    "games/strain-showdown/index.html",
    "games/strain-showdown/app.js",
    "games/strain-showdown/engine.mjs",
    "games/strain-showdown/styles.css",
    "games/strain-showdown/data/families.json",
    "games/strain-showdown/data/roster/kush.json",
    "games/strain-showdown/data/roster/haze.json",
    "games/strain-showdown/data/roster/skunk.json",
    "games/strain-showdown/data/roster/gas.json",
    "games/strain-showdown/data/roster/cookies.json",
    "games/strain-showdown/data/roster/fruit.json",
    "games/strain-showdown/data/roster/purple.json",
    "games/strain-showdown/data/roster/frost.json",
    "games/terpocalypse/index.html",
    "games/terpocalypse/main.js",
    "games/terpocalypse/game-data.js",
    "games/terpocalypse/styles.css",
    "games/phenoquest/index.html",
    "games/phenoquest/game.js",
    "games/phenoquest/lineage-runtime.js",
    "games/phenoquest/style.css",
    "games/phenoquest/build-meta.json",
    "games/strain-match/index.html",
    "games/strain-match/app.js",
    "games/strain-match/strain-match.css",
    "games/strain-match/data/decks.json",
    "games/lost-in-the-terps/index.html",
    "games/lost-in-the-terps/app.js",
    "games/lost-in-the-terps/terps.css",
    "games/lost-in-the-terps/data/puzzles.json",
    "games/weedopolis/index.html",
    "games/crossword/index.html",
    "games/who-took-it/index.html",
    "growlens/index.html",
    "thc-grow-doc/index.html",
    "thc-grow-doc/api/visual-observations.php",
    "tools/index.html",
    "projects/index.html",
    "puzzles/current.json",
    "atlas/index.html",
    "atlas/atlas-v3.css",
    "atlas/atlas-v3.js",
    "atlas/atlas-3d.js",
    "atlas/module.js",
    "atlas/data/systems.json",
    "atlas/leaf-module/index.html",
    "atlas/root-system/index.html",
    "atlas/root-system/rhizosphere/index.html",
    "atlas/downloads/index.html",
    "assets/images/atlas/root-system/rhizosphere-microbe-interaction.svg",
    "dtf-content-overlay/overlay-manifest.json",
    "dtf-content-overlay/learn/academy/index.html",
    "dtf-content-overlay/learn/atlas/seed-germination/seed-anatomy/index.html",
    "dtf-content-overlay/learn/cultivation-science/outdoor-site-and-sun-mapping/index.html",
    "dtf-content-overlay/learn/glossary/index.html",
    "dtf-content-overlay/learn/plant-health/two-spotted-spider-mite/index.html",
    "dtf-content-overlay/learn/sops/ph-meter-calibration-and-measurement/index.html",
    "dtf-content-overlay/learn/symptoms/lower-leaf-yellowing/index.html",
    "dtf-content-overlay/learn/tools/plant-health-intake/index.html",
    "dtf-content-overlay/community/grow-offs/solo-cup-grow-off/index.html",
    "dtf-content-overlay/games/seed-ascent/index.html",
    "dtf-content-overlay/seed-ascent.html",
    "dtf-content-overlay/seed-ascent/engine.js",
]
for target in registered_local_game_targets:
    index_path = f"{target}/index.html"
    if index_path not in required:
        required.append(index_path)

for rel in required:
    path = root / rel
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"required deploy file missing or empty: {rel}")

for forbidden in ["index.html", "learn/index.html", "blog/index.html"]:
    if forbidden in allowed:
        raise SystemExit(f"forbidden WordPress-owned route entered allowlist: {forbidden}")

files: dict[str, dict[str, int | str]] = {}

def add_file(path: Path, rel: str) -> None:
    pure = PurePosixPath(rel)
    if pure.is_absolute() or ".." in pure.parts or rel.startswith("./"):
        raise SystemExit(f"unsafe archive path: {rel}")
    st = path.lstat()
    if stat.S_ISLNK(st.st_mode):
        raise SystemExit(f"symlinks are not permitted in public suite archive: {rel}")
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
    elif src.is_dir():
        for path in sorted(src.rglob("*")):
            if path.is_dir():
                continue
            rel = path.relative_to(root).as_posix()
            add_file(path, rel)
    else:
        raise SystemExit(f"unsupported allowlisted release path: {item}")

for rel in files:
    if rel == "index.html" or rel.startswith("learn/") or rel.startswith("blog/"):
        raise SystemExit(f"WordPress-owned route cannot be included directly in static app package: {rel}")

manifest = {
    "schemaVersion": 1,
    "purpose": "dtfseeds-public-apps-only",
    "wordPressOwnedRoutesExcluded": ["/", "/learn/", "/blog/"],
    "targets": allowed,
    "registeredLocalGameTargets": sorted(registered_local_game_targets),
    "dtf420Overlay": {
        "repository": overlay_manifest["repository"],
        "commit": overlay_manifest["commit"],
        "canonicalOrigin": overlay_manifest["canonicalOrigin"],
        "routePrefixes": overlay_manifest["routePrefixes"],
        "sharedPaths": overlay_manifest["sharedPaths"],
    },
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
    info = zipfile.ZipInfo(".dtf-suite-manifest.json")
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (0o100644 & 0xFFFF) << 16
    zf.writestr(info, manifest_bytes)

archive_sha = hashlib.sha256(out.read_bytes()).hexdigest()
summary = {
    "archive": str(out),
    "archiveBytes": out.stat().st_size,
    "archiveSha256": archive_sha,
    "fileCount": len(files),
    "uncompressedBytes": manifest["uncompressedBytes"],
    "targets": allowed,
    "registeredLocalGameTargets": sorted(registered_local_game_targets),
    "dtf420Overlay": manifest["dtf420Overlay"],
}
print(json.dumps(summary, separators=(",", ":")))
