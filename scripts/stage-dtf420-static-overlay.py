#!/usr/bin/env python3
"""Build and stage the approved Dtf420 static child-route overlay.

The source application remains in dtfgenetics/Dtf420. This importer clones its
current main branch, builds the explicit static export, requires the source
ownership manifest to exactly match this repository's production contract, and
copies only approved child routes/shared assets under an isolated staging
namespace. Nothing is written directly to /learn, /community, /games, or /.

After staging, every standalone HTML document is reconciled through the same
DTFSeeds V5 header/responsive/UX shell used by the rest of the public suite.
This is intentionally performed after the external Dtf420 build because those
files do not exist yet when the normal public-suite header pass runs.
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
SHELL_MARKERS = (
    'data-dtf-shell="header-v5"',
    'id="dtf-responsive-layout-v1"',
    'id="dtf-sitewide-ux-polish-v1"',
)


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


def verify_shared_shell(staging_root: Path, route_prefixes: list[str]) -> int:
    """Require the canonical shell on every staged route HTML document."""
    checked = 0
    for prefix in route_prefixes:
        prefix_root = staging_root / prefix
        for html_path in prefix_root.rglob("*.html"):
            source = html_path.read_text(errors="replace")
            if "<html" not in source.lower() or "<body" not in source.lower():
                continue
            checked += 1
            missing = [marker for marker in SHELL_MARKERS if marker not in source]
            if missing:
                rel = html_path.relative_to(staging_root).as_posix()
                raise SystemExit(f"staged Dtf420 route is missing shared shell marker(s) {missing}: {rel}")
    if checked < 200:
        raise SystemExit(f"too few staged Dtf420 HTML routes received the shared shell: {checked}")
    return checked


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

        # Seed Ascent is a Next wrapper around the dedicated /seed-ascent.html runtime.
        # The route reconciler verifies canonical ownership as well as the runtime link.
        # Stamp that ownership into the staged wrapper so a correct HTTP 200 page cannot
        # be rejected merely because the generated Next HTML used relative URLs only.
        seed_wrapper = staging_root / "games" / "seed-ascent" / "index.html"
        seed_html = seed_wrapper.read_text()
        if "/seed-ascent.html" not in seed_html:
            raise SystemExit("Seed Ascent wrapper no longer references /seed-ascent.html")
        if contract["canonicalOrigin"] not in seed_html:
            canonical_marker = f"<!-- dtf-canonical-origin: {contract['canonicalOrigin']} -->"
            if "</head>" in seed_html:
                seed_html = seed_html.replace("</head>", f"{canonical_marker}\n</head>", 1)
            else:
                seed_html = f"{canonical_marker}\n{seed_html}"
            seed_wrapper.write_text(seed_html)

        # The Dtf420 pages are created after the normal public-suite shell pass. Re-run
        # the canonical reconciler over only this isolated staging tree so child routes
        # cannot ship without the approved V5 navigation, responsive system, and UX layer.
        shell_reconciler = repo_root / "scripts" / "apply-sitewide-header.mjs"
        if not shell_reconciler.is_file():
            raise SystemExit(f"shared shell reconciler is missing: {shell_reconciler}")
        run("node", str(shell_reconciler), str(staging_root), cwd=repo_root)
        run("node", str(shell_reconciler), str(staging_root), "--check", cwd=repo_root)
        shell_route_count = verify_shared_shell(staging_root, list(contract["routePrefixes"]))

        metadata = {
            "schemaVersion": 2,
            "purpose": contract["purpose"],
            "canonicalOrigin": contract["canonicalOrigin"],
            "repository": "dtfgenetics/Dtf420",
            "commit": source_sha,
            "routePrefixes": contract["routePrefixes"],
            "sharedPaths": contract["sharedPaths"],
            "wordpressOwnedRoutes": contract["wordpressOwnedRoutes"],
            "requiredRoutes": contract["requiredRoutes"],
            "sharedShell": {
                "header": "v5",
                "responsiveLayout": "v1",
                "sitewideUxPolish": "v1",
                "verifiedHtmlRoutes": shell_route_count,
            },
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
            "shellVerifiedHtmlRoutes": shell_route_count,
            "routePrefixes": len(contract["routePrefixes"]),
            "sharedPaths": len(contract["sharedPaths"]),
        }, separators=(",", ":")))


if __name__ == "__main__":
    main()
