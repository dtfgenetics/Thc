#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
import zipfile

MANIFEST = '.dtf-suite-manifest.json'


def resource_owned_specs(repo_root: Path) -> list[dict[str, str]]:
    config = json.loads((repo_root / 'site/deployment/release-resources.json').read_text())
    specs: list[dict[str, str]] = []
    for resource_id, resource in config.get('resources', {}).items():
        if resource.get('publicSuiteOwnership') != 'resource':
            continue
        route = str(resource.get('route') or '')
        root = str(resource.get('artifactRoot') or '').rstrip('/')
        if not route.startswith('/games/') or not route.endswith('/'):
            raise SystemExit(f'unsafe resource-owned route: {resource_id}: {route!r}')
        if not re.fullmatch(r'games/[a-z0-9][a-z0-9-]*', root):
            raise SystemExit(f'unsafe resource-owned artifact root: {resource_id}: {root!r}')
        if route.strip('/') != root:
            raise SystemExit(f'resource route/artifact root mismatch: {resource_id}: {route!r} != {root!r}')
        specs.append({'id': resource_id, 'route': route, 'root': root})
    roots = [spec['root'] for spec in specs]
    routes = [spec['route'] for spec in specs]
    if len(roots) != len(set(roots)) or len(routes) != len(set(routes)):
        raise SystemExit('duplicate resource-owned route or artifact root')
    return sorted(specs, key=lambda spec: spec['root'])


def _php_array_items(text: str, variable: str) -> tuple[re.Match[str], list[str]]:
    pattern = rf'(?P<head>    \${re.escape(variable)} = \[\n)(?P<body>.*?)(?P<tail>\n    \];)'
    match = re.search(pattern, text, re.S)
    if not match:
        raise SystemExit(f'bridge array ${variable} not found')
    items = re.findall(r"'([^']+)'", match.group('body'))
    if not items:
        raise SystemExit(f'bridge array ${variable} is empty or unparsable')
    return match, items


def _rewrite_php_array(text: str, variable: str, items: list[str]) -> str:
    match, _ = _php_array_items(text, variable)
    body = ''.join(f"        {item!r},\n" for item in items).rstrip('\n')
    replacement = match.group('head') + body + match.group('tail')
    return text[:match.start()] + replacement + text[match.end():]


def transform_bridge(text: str, repo_root: Path) -> tuple[str, dict[str, object]]:
    specs = resource_owned_specs(repo_root)
    roots = {spec['root'] for spec in specs}
    routes = {spec['route'] for spec in specs}

    _, targets = _php_array_items(text, 'targets')
    _, required = _php_array_items(text, 'required')
    _, prefixes = _php_array_items(text, 'prefixes')

    targets = [value for value in targets if value not in roots]
    required = [value for value in required if not any(value.startswith(root + '/') for root in roots)]
    prefixes = [value for value in prefixes if value.rstrip('/') not in roots]

    text = _rewrite_php_array(text, 'targets', targets)
    text = _rewrite_php_array(text, 'required', required)
    text = _rewrite_php_array(text, 'prefixes', prefixes)

    live_match = re.search(r'(?P<head>const liveChecks = \[\n)(?P<body>.*?)(?P<tail>\n\];)', text, re.S)
    if not live_match:
        raise SystemExit('suite liveChecks array not found')
    pairs = re.findall(r"\[\s*'([^']+)'\s*,\s*'([^']*)'\s*\]", live_match.group('body'))
    if not pairs:
        raise SystemExit('suite liveChecks array is empty or unparsable')
    kept_pairs = [(route, marker) for route, marker in pairs if route not in routes]
    body = ''.join(f"  [{route!r}, {marker!r}],\n" for route, marker in kept_pairs).rstrip('\n')
    replacement = live_match.group('head') + body + live_match.group('tail')
    text = text[:live_match.start()] + replacement + text[live_match.end():]

    _, final_targets = _php_array_items(text, 'targets')
    _, final_required = _php_array_items(text, 'required')
    _, final_prefixes = _php_array_items(text, 'prefixes')
    for spec in specs:
        root = spec['root']
        route = spec['route']
        if root in final_targets:
            raise SystemExit(f'resource-owned target remained in suite bridge: {root}')
        if any(value.startswith(root + '/') for value in final_required):
            raise SystemExit(f'resource-owned required path remained in suite bridge: {root}')
        if any(value.rstrip('/') == root for value in final_prefixes):
            raise SystemExit(f'resource-owned prefix remained in suite bridge: {root}')
        if re.search(rf"\[\s*{re.escape(route)!r}", text):
            raise SystemExit(f'resource-owned live check remained in suite bridge: {route}')

    return text, {
        'ok': True,
        'resourceOwnedRoutesExcluded': [spec['route'] for spec in specs],
        'resourceOwnedTargetsExcluded': [spec['root'] for spec in specs],
        'targets': len(final_targets),
        'required': len(final_required),
        'prefixes': len(final_prefixes),
        'liveChecks': len(kept_pairs),
    }


def _owned_path(rel: str, roots: set[str]) -> bool:
    return any(rel == root or rel.startswith(root + '/') for root in roots)


def filter_archive(source_zip: Path, output_zip: Path, repo_root: Path) -> dict[str, object]:
    specs = resource_owned_specs(repo_root)
    roots = {spec['root'] for spec in specs}
    routes = [spec['route'] for spec in specs]

    with zipfile.ZipFile(source_zip) as source:
        names = source.namelist()
        if names.count(MANIFEST) != 1:
            raise SystemExit('suite archive must contain exactly one manifest')
        manifest = json.loads(source.read(MANIFEST))
        if manifest.get('schemaVersion') != 1 or manifest.get('purpose') != 'dtfseeds-public-apps-only':
            raise SystemExit('suite manifest identity is invalid')

        retained: dict[str, bytes] = {}
        for name in names:
            if name == MANIFEST or name.endswith('/'):
                continue
            pure = PurePosixPath(name)
            if pure.is_absolute() or '..' in pure.parts:
                raise SystemExit(f'unsafe suite archive path: {name}')
            if _owned_path(name, roots):
                continue
            retained[name] = source.read(name)

    manifest.pop('manifestSha256', None)
    manifest['targets'] = [value for value in manifest.get('targets', []) if value not in roots]
    manifest['required'] = [value for value in manifest.get('required', []) if not _owned_path(value, roots)]
    manifest['registeredLocalGameTargets'] = [
        value for value in manifest.get('registeredLocalGameTargets', []) if value not in roots
    ]
    manifest['externalGames'] = [
        game for game in manifest.get('externalGames', []) if str(game.get('target') or '') not in roots
    ]
    manifest['resourceOwnedRoutesExcluded'] = routes
    manifest['files'] = {
        rel: {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        for rel, data in sorted(retained.items())
    }
    manifest['fileCount'] = len(retained)
    manifest['uncompressedBytes'] = sum(len(data) for data in retained.values())

    required_missing = [rel for rel in manifest['required'] if rel not in retained]
    if required_missing:
        raise SystemExit('filtered suite manifest still requires missing files: ' + ', '.join(required_missing))
    for spec in specs:
        if any(_owned_path(rel, {spec['root']}) for rel in retained):
            raise SystemExit(f'resource-owned payload remained in suite archive: {spec["root"]}')

    unhashed = (json.dumps(manifest, sort_keys=True, separators=(',', ':')) + '\n').encode()
    manifest['manifestSha256'] = hashlib.sha256(unhashed).hexdigest()
    manifest_bytes = (json.dumps(manifest, sort_keys=True, separators=(',', ':')) + '\n').encode()

    output_zip.parent.mkdir(parents=True, exist_ok=True)
    if output_zip.exists():
        output_zip.unlink()
    with zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as out:
        for rel, data in sorted(retained.items()):
            info = zipfile.ZipInfo(rel)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o100644 & 0xFFFF) << 16
            out.writestr(info, data)
        info = zipfile.ZipInfo(MANIFEST)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100644 & 0xFFFF) << 16
        out.writestr(info, manifest_bytes)

    return {
        'ok': True,
        'archive': str(output_zip),
        'archiveSha256': hashlib.sha256(output_zip.read_bytes()).hexdigest(),
        'fileCount': len(retained),
        'resourceOwnedRoutesExcluded': routes,
        'resourceOwnedTargetsExcluded': sorted(roots),
    }


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    if len(sys.argv) < 2:
        raise SystemExit('usage: public_suite_resource_ownership.py bridge INPUT OUTPUT | archive INPUT OUTPUT | report')
    command = sys.argv[1]
    if command == 'report':
        print(json.dumps({'resources': resource_owned_specs(repo_root)}, indent=2))
        return
    if len(sys.argv) != 4:
        raise SystemExit(f'usage: public_suite_resource_ownership.py {command} INPUT OUTPUT')
    source = Path(sys.argv[2]).resolve()
    output = Path(sys.argv[3]).resolve()
    if command == 'bridge':
        transformed, report = transform_bridge(source.read_text(), repo_root)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(transformed)
        print(json.dumps(report, indent=2))
    elif command == 'archive':
        print(json.dumps(filter_archive(source, output, repo_root), indent=2))
    else:
        raise SystemExit(f'unknown command: {command}')


if __name__ == '__main__':
    main()
