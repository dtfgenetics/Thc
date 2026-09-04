#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

if len(sys.argv) != 4:
    raise SystemExit('usage: package-dtf-public-resource.py RESOURCE_ID RELEASE_DIR OUTPUT_ZIP')

resource_id, release_dir, output_zip = sys.argv[1:]
root = Path(release_dir).resolve()
out = Path(output_zip).resolve()
repo = Path(__file__).resolve().parents[1]
config = json.loads((repo / 'site/deployment/release-resources.json').read_text())
resource = config['resources'].get(resource_id)
if not resource:
    raise SystemExit(f'unknown resource: {resource_id}')

artifact_root = PurePosixPath(resource['artifactRoot'])
source_root = root / artifact_root.as_posix()
if not source_root.is_dir():
    raise SystemExit(f'resource artifact root missing: {artifact_root}')

for required in resource['requiredFiles']:
    path = root / required
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f'required resource file missing or empty: {required}')

files: dict[str, dict[str, int | str]] = {}
for path in sorted(source_root.rglob('*')):
    if path.is_dir():
        continue
    rel = path.relative_to(root).as_posix()
    pure = PurePosixPath(rel)
    if pure.is_absolute() or '..' in pure.parts:
        raise SystemExit(f'unsafe archive path: {rel}')
    st = path.lstat()
    if stat.S_ISLNK(st.st_mode) or not stat.S_ISREG(st.st_mode):
        raise SystemExit(f'unsafe resource entry: {rel}')
    data = path.read_bytes()
    files[rel] = {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

if not files:
    raise SystemExit('resource archive would be empty')

manifest = {
    'schemaVersion': 1,
    'purpose': 'dtfseeds-public-resource',
    'resourceId': resource_id,
    'studioResource': resource['studioResource'],
    'route': resource['route'],
    'artifactRoot': resource['artifactRoot'],
    'productionTarget': resource['productionTarget'],
    'checkpointTag': resource['checkpointTag'],
    'files': files,
}

out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for rel in files:
        archive.write(root / rel, rel)
    archive.writestr('.dtf-resource-manifest.json', json.dumps(manifest, sort_keys=True, indent=2) + '\n')

print(json.dumps({
    'ok': True,
    'resource': resource_id,
    'route': resource['route'],
    'archive': str(out),
    'fileCount': len(files),
    'archiveSha256': hashlib.sha256(out.read_bytes()).hexdigest(),
}, indent=2))
