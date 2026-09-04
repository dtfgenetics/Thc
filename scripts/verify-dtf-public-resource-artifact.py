#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

if len(sys.argv) != 4:
    raise SystemExit('usage: verify-dtf-public-resource-artifact.py RESOURCE_ID ARCHIVE OUTPUT_DIR')

resource_id, archive_path, output_dir = sys.argv[1:]
repo = Path(__file__).resolve().parents[1]
archive_path = Path(archive_path).resolve()
out = Path(output_dir).resolve()
config = json.loads((repo / 'site/deployment/release-resources.json').read_text())
resource = config['resources'].get(resource_id)
if not resource:
    raise SystemExit(f'unknown resource: {resource_id}')
if not archive_path.is_file() or archive_path.stat().st_size == 0:
    raise SystemExit(f'artifact archive missing or empty: {archive_path}')

with zipfile.ZipFile(archive_path) as archive:
    names = archive.namelist()
    if len(names) != len(set(names)):
        raise SystemExit('resource archive contains duplicate entries')
    if '.dtf-resource-manifest.json' not in names:
        raise SystemExit('resource manifest missing')
    manifest = json.loads(archive.read('.dtf-resource-manifest.json'))
    expected = {
        'resourceId': resource_id,
        'studioResource': resource['studioResource'],
        'route': resource['route'],
        'artifactRoot': resource['artifactRoot'],
        'productionTarget': resource['productionTarget'],
        'checkpointTag': resource['checkpointTag'],
    }
    for key, value in expected.items():
        if manifest.get(key) != value:
            raise SystemExit(f'manifest {key} mismatch: expected {value!r}, got {manifest.get(key)!r}')
    root = PurePosixPath(resource['artifactRoot'])
    files = manifest.get('files') or {}
    payload_names = [name for name in names if name != '.dtf-resource-manifest.json']
    if set(payload_names) != set(files):
        raise SystemExit('manifest file list does not exactly match archive payload')
    for name in payload_names:
        pure = PurePosixPath(name)
        if pure.is_absolute() or '..' in pure.parts or tuple(pure.parts[:len(root.parts)]) != root.parts:
            raise SystemExit(f'archive entry escaped resource root: {name}')
        data = archive.read(name)
        meta = files[name]
        if len(data) != meta.get('size'):
            raise SystemExit(f'file size mismatch: {name}')
        if hashlib.sha256(data).hexdigest() != meta.get('sha256'):
            raise SystemExit(f'file hash mismatch: {name}')
    for required in resource['requiredFiles']:
        if required not in payload_names:
            raise SystemExit(f'required file missing from artifact: {required}')

    out.mkdir(parents=True, exist_ok=True)
    for name in payload_names:
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.read(name))
        if stat.S_ISLNK(target.lstat().st_mode):
            raise SystemExit(f'extracted symlink rejected: {name}')

print(json.dumps({
    'ok': True,
    'resource': resource_id,
    'route': resource['route'],
    'productionTarget': resource['productionTarget'],
    'checkpointTag': resource['checkpointTag'],
    'fileCount': len(payload_names),
    'archiveSha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
    'output': str(out),
}, indent=2))
