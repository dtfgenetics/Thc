#!/usr/bin/env python3
"""Require package and WordPress bridge shared-asset allowlists to stay synchronized."""

from __future__ import annotations

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "scripts" / "package-public-suite-wordpress.py"
BRIDGE = ROOT / "scripts" / "wordpress_suite_registry_patch.py"


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

missing_from_bridge = sorted(package_exact - bridge_exact)
missing_from_package = sorted(bridge_exact - package_exact)
if missing_from_bridge or missing_from_package:
    raise SystemExit(
        "public-suite shared-asset allowlist drift: "
        + json.dumps(
            {
                "missingFromBridge": missing_from_bridge,
                "missingFromPackage": missing_from_package,
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
        },
        separators=(",", ":"),
    )
)
