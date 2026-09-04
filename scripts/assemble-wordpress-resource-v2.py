#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

if len(sys.argv) not in (2, 3):
    raise SystemExit('usage: assemble-wordpress-resource-v2.py OUTPUT_MJS [RESOURCE_ID]')

output = Path(sys.argv[1]).resolve()
resource_id = sys.argv[2] if len(sys.argv) == 3 else 'high-iq'
repo = Path(__file__).resolve().parents[1]
config = json.loads((repo / 'site/deployment/release-resources.json').read_text())
resource = config['resources'].get(resource_id)
if not resource:
    raise SystemExit(f'unknown resource: {resource_id}')
if resource_id != 'high-iq':
    raise SystemExit('WordPress resource bridge pilot currently supports high-iq only')

base_assembler = repo / 'scripts/assemble-wordpress-suite-v2.py'
with tempfile.TemporaryDirectory(prefix='dtf-resource-bridge-') as temp_dir:
    base_output = Path(temp_dir) / 'base-suite-v2.mjs'
    subprocess.run([sys.executable, str(base_assembler), str(base_output)], cwd=repo, check=True)
    text = base_output.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one {label}, found {count}')
    text = text.replace(old, new, 1)


def replace_regex_once(pattern: str, replacement: str, label: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'expected exactly one {label}, found {count}')


def replace_all_checked(old: str, new: str, label: str, minimum: int) -> None:
    global text
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'expected at least {minimum} {label} occurrences, found {count}')
    text = text.replace(old, new)


def js_single(value: str) -> str:
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


required = resource['requiredFiles']
route = resource['route']
artifact_root = resource['artifactRoot']
production_target = resource['productionTarget']
checkpoint_tag = resource['checkpointTag']
marker = resource['verifyMarker']
slug = resource_id.replace('-', '_')

# Narrow every filesystem authority list to the one resource directory.
replace_regex_once(
    r"    \$targets = \[.*?\n    \];",
    "    $targets = [\n        " + js_single(artifact_root) + "\n    ];",
    'deployment target array',
)
replace_regex_once(
    r"    \$required = \[.*?\n    \];",
    "    $required = [\n        " + ',\n        '.join(js_single(path) for path in required) + "\n    ];",
    'required-file array',
)
replace_regex_once(
    r"    \$exact_files = \[.*?\];",
    "    $exact_files = [];",
    'exact-file allowlist',
)
replace_regex_once(
    r"    \$prefixes = \[.*?\n    \];",
    "    $prefixes = [\n        " + js_single(artifact_root + '/') + "\n    ];",
    'prefix allowlist',
)

# Give this resource its own mutation state. The workflow separately serializes
# the shared temporary Code Snippets bridge lifecycle.
replace_once("ABSPATH . '.dtf-suite-work'", f"ABSPATH . '.dtf-resource-{resource_id}-work'", 'resource work root')
replace_once("$lock_key = 'dtf_suite_deploy_lock';", f"$lock_key = 'dtf_resource_{slug}_deploy_lock';", 'resource lock key')
replace_once("'dtf_suite_state_' . $id", f"'dtf_resource_{slug}_state_' . $id", 'resource state key')

# Namespace every temporary REST bridge per resource and per deployment ID.
replace_all_checked(
    "'dtf-suite/v2-${deploymentId}'",
    f"'dtf-resource-{resource_id}/v1-${{deploymentId}}'",
    'server REST namespace',
    6,
)
replace_all_checked(
    "/wp-json/dtf-suite/v2-${deploymentId}/",
    f"/wp-json/dtf-resource-{resource_id}/v1-${{deploymentId}}/",
    'client REST namespace',
    2,
)

# Consume the exact immutable resource artifact created by CI.
replace_all_checked('.dtf-suite-manifest.json', '.dtf-resource-manifest.json', 'resource manifest filename', 5)
replace_once("'dtfseeds-public-apps-only'", "'dtfseeds-public-resource'", 'resource manifest purpose')
manifest_guard = (
    "            if (($manifest['resourceId'] ?? '') !== " + js_single(resource_id)
    + " || ($manifest['route'] ?? '') !== " + js_single(route)
    + " || ($manifest['artifactRoot'] ?? '') !== " + js_single(artifact_root)
    + " || ($manifest['productionTarget'] ?? '') !== " + js_single(production_target)
    + " || ($manifest['checkpointTag'] ?? '') !== " + js_single(checkpoint_tag)
    + ") { $zip->close(); return new WP_Error('dtf_resource_manifest', 'Resource manifest identity does not match the fixed publisher.', ['status'=>400]); }"
)
manifest_line_pattern = r"(            if \(!is_array\(\$manifest\).*?return new WP_Error\('dtf_manifest'.*?\n)"
match = re.search(manifest_line_pattern, text)
if not match:
    raise SystemExit('could not find decoded manifest validation line')
text = text[:match.end()] + manifest_guard + "\n" + text[match.end():]

# Resource manifests already prove route ownership through their fixed resource
# identity. The suite-only manifest field below is intentionally absent from
# resource artifacts, so remove only that inherited two-line ownership guard.
replace_regex_once(
    r"            \$excluded = is_array\(\$manifest\['wordPressOwnedRoutesExcluded'\].*?\n            foreach \(\['/','/learn/','/blog/'\] as \$route\).*?\n",
    '',
    'suite-only WordPress ownership manifest guard',
)

# Verify only the route this bridge is authorized to mutate.
replace_regex_once(
    r"const liveChecks = \[.*?\n\];",
    "const liveChecks = [\n  [" + json.dumps(route) + ", " + json.dumps(marker) + "],\n];",
    'live route checks',
)
replace_regex_once(
    r"  const puzzle = await fetch\(`\$\{siteUrl\}/puzzles/current\.json.*?await verifyRoute\('/learn/'.*?\n",
    '',
    'suite-only verification tail',
)
replace_once('verifiedRoutes: liveChecks.length + 3', 'verifiedRoutes: liveChecks.length', 'verified-route count')

# Resource-specific temporary snippets prevent stale cleanup from targeting
# another deployment family.
replace_all_checked('DTF Public Suite Deploy V2', f'DTF Resource {resource_id} Deploy V1', 'temporary snippet family', 2)
replace_all_checked('DTFSeedsSuiteDeployV2', f'DTFSeedsResource{resource_id.replace("-", "").title()}DeployV1', 'MCP client name', 1)

# Keep output language and environment variable compatibility while making logs
# unambiguous when several resource publishers are active in the repository.
text = text.replace('Public-suite archive not found:', f'Resource {resource_id} archive not found:')
text = text.replace('app-only DTFSeeds suite deployment', f'DTFSeeds {resource_id} resource deployment')
text = text.replace('DTFSeeds suite deployment', f'DTFSeeds {resource_id} resource deployment')

# Final fail-closed assertions: the generated bridge may mention the generic
# suite implementation in comments/logs, but must not retain broad route lists,
# the global lock, or suite-only manifest contracts.
for forbidden in [
    "'games/high-land','games/high-iq'",
    "'growlens','thc-grow-doc'",
    "dtf_suite_deploy_lock",
    ".dtf-suite-manifest.json",
    "'dtfseeds-public-apps-only'",
    "wordPressOwnedRoutesExcluded",
]:
    if forbidden in text:
        raise SystemExit(f'generated resource bridge retained forbidden broad authority: {forbidden}')
if text.count(js_single(artifact_root)) < 1:
    raise SystemExit('generated resource bridge lost its only deployment target')
if marker not in text:
    raise SystemExit('generated resource bridge lost its live verification marker')

output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(text)
print(json.dumps({
    'ok': True,
    'resource': resource_id,
    'route': route,
    'artifactRoot': artifact_root,
    'productionTarget': production_target,
    'output': str(output),
}, indent=2))
