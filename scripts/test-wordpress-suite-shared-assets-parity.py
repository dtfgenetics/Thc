#!/usr/bin/env python3
"""Require package and WordPress bridge shared-asset allowlists to stay synchronized."""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "scripts" / "package-public-suite-wordpress.py"
BRIDGE = ROOT / "scripts" / "wordpress_suite_registry_patch.py"
PUBLIC_ROOT = ROOT / "site" / "public-route-patch"
ASSET_ROOT = PUBLIC_ROOT / "assets"
PUBLIC_ASSET_REFERENCE = re.compile(r"/assets/(thc-[a-z0-9-]+\.(?:mjs|js|css))")
LOCAL_MODULE_IMPORT = re.compile(r"(?:from\s+|import\s*)[\"']\./([^\"']+\.mjs)[\"']")


def literal_collection(path: Path, name: str) -> list[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    for node in tree.body:
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        if not any(isinstance(target, ast.Name) and target.id == name for target in targets):
            continue
        value = node.value
        if not isinstance(value, (ast.List, ast.Tuple)):
            raise SystemExit(f"{path.name}:{name} must remain a literal list or tuple")
        result: list[str] = []
        for element in value.elts:
            if not isinstance(element, ast.Constant) or not isinstance(element.value, str):
                raise SystemExit(f"{path.name}:{name} contains a non-literal value")
            result.append(element.value)
        return result
    raise SystemExit(f"{path.name}:{name} was not found")


package_allowed = literal_collection(PACKAGE, "allowed")
bridge_shared = literal_collection(BRIDGE, "SHARED_EXACT_FILES")

package_exact = {
    path
    for path in package_allowed
    if path.startswith("assets/")
    and path != "assets/vendor"
    and not path.startswith("assets/images/")
}
bridge_exact = {path for path in bridge_shared if not path.startswith("assets/vendor/")}

referenced_assets: set[str] = set()
for suffix in ("*.html", "*.js", "*.mjs"):
    for source in PUBLIC_ROOT.rglob(suffix):
        referenced_assets.update(
            f"assets/{match}" for match in PUBLIC_ASSET_REFERENCE.findall(source.read_text())
        )

pending_modules = [path for path in referenced_assets if path.endswith(".mjs")]
seen_modules: set[str] = set()
while pending_modules:
    module = pending_modules.pop()
    if module in seen_modules:
        continue
    seen_modules.add(module)
    source = ASSET_ROOT / Path(module).name
    if not source.is_file():
        raise SystemExit(f"referenced first-party module is missing from source: {module}")
    for dependency in LOCAL_MODULE_IMPORT.findall(source.read_text()):
        dependency_path = f"assets/{dependency}"
        referenced_assets.add(dependency_path)
        if dependency_path not in seen_modules:
            pending_modules.append(dependency_path)

missing_referenced_from_package = sorted(referenced_assets - package_exact)
missing_referenced_from_bridge = sorted(referenced_assets - bridge_exact)

missing_from_bridge = sorted(package_exact - bridge_exact)
missing_from_package = sorted(bridge_exact - package_exact)
if (
    missing_from_bridge
    or missing_from_package
    or missing_referenced_from_package
    or missing_referenced_from_bridge
):
    raise SystemExit(
        "public-suite shared-asset allowlist drift: "
        + json.dumps(
            {
                "missingFromBridge": missing_from_bridge,
                "missingFromPackage": missing_from_package,
                "referencedMissingFromPackage": missing_referenced_from_package,
                "referencedMissingFromBridge": missing_referenced_from_bridge,
            },
            sort_keys=True,
        )
    )

print(
    json.dumps(
        {
            "ok": True,
            "sharedExactFiles": sorted(package_exact),
            "count": len(package_exact),
            "referencedAssetCount": len(referenced_assets),
        },
        separators=(",", ":"),
    )
)
