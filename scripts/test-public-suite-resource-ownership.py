#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import tempfile
import zipfile

from public_suite_resource_ownership import MANIFEST, filter_archive, resource_owned_specs, transform_bridge

repo = Path(__file__).resolve().parents[1]
specs = resource_owned_specs(repo)
assert {spec['id'] for spec in specs} == {'high-iq'}
assert {spec['root'] for spec in specs} == {'games/high-iq'}

bridge = """const snippetCode = String.raw`
    $targets = [
        'games/index.html','games/high-land','games/high-iq','games/high-life'
    ];
    $required = [
        'games/index.html','games/high-land/index.html','games/high-iq/index.html','games/high-iq/app.js','games/high-life/index.html'
    ];
    $prefixes = [
        'games/high-land/','games/high-iq/','games/high-life/'
    ];
`.trim();
const liveChecks = [
  ['/games/', 'Games'], ['/games/high-iq/', 'Build your High IQ run'], ['/games/high-life/', 'High Life'],
  ['/games/high-land/', 'High Land'],
];
"""
filtered_bridge, bridge_report = transform_bridge(bridge, repo)
assert "'games/high-iq'" not in filtered_bridge
assert "'games/high-iq/'" not in filtered_bridge
assert '/games/high-iq/' not in filtered_bridge
assert "'games/high-land'" in filtered_bridge
assert "'games/high-land/'" in filtered_bridge
assert '/games/high-land/' in filtered_bridge
assert "'games/high-life'" in filtered_bridge
assert '/games/high-life/' in filtered_bridge
assert bridge_report['resourceOwnedTargetsExcluded'] == ['games/high-iq']

with tempfile.TemporaryDirectory(prefix='dtf-suite-ownership-test-') as temp:
    temp = Path(temp)
    source = temp / 'source.zip'
    output = temp / 'filtered.zip'
    payloads = {
        'games/index.html': b'<html>hub</html>',
        'games/high-land/index.html': b'<html>high land</html>',
        'games/high-iq/index.html': b'<html>high iq</html>',
        'games/high-iq/app.js': b'console.log("hiq")',
        'games/high-life/index.html': b'<html>high life</html>',
    }
    files = {
        rel: {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        for rel, data in payloads.items()
    }
    manifest = {
        'schemaVersion': 1,
        'purpose': 'dtfseeds-public-apps-only',
        'wordPressOwnedRoutesExcluded': ['/', '/learn/', '/blog/'],
        'targets': ['games/index.html', 'games/high-land', 'games/high-iq', 'games/high-life'],
        'registeredLocalGameTargets': ['games/high-iq', 'games/high-life'],
        'externalGames': [],
        'required': list(payloads),
        'fileCount': len(payloads),
        'uncompressedBytes': sum(len(data) for data in payloads.values()),
        'files': files,
    }
    unhashed = (json.dumps(manifest, sort_keys=True, separators=(',', ':')) + '\n').encode()
    manifest['manifestSha256'] = hashlib.sha256(unhashed).hexdigest()
    with zipfile.ZipFile(source, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for rel, data in payloads.items():
            archive.writestr(rel, data)
        archive.writestr(MANIFEST, json.dumps(manifest, sort_keys=True, separators=(',', ':')) + '\n')

    report = filter_archive(source, output, repo)
    assert report['resourceOwnedTargetsExcluded'] == ['games/high-iq']
    with zipfile.ZipFile(output) as archive:
        names = archive.namelist()
        filtered_manifest = json.loads(archive.read(MANIFEST))
        assert 'games/high-iq/index.html' not in names
        assert 'games/high-iq/app.js' not in names
        assert 'games/high-land/index.html' in names
        assert 'games/high-life/index.html' in names
        assert 'games/high-iq' not in filtered_manifest['targets']
        assert 'games/high-land' in filtered_manifest['targets']
        assert 'games/high-life' in filtered_manifest['targets']
        assert filtered_manifest['registeredLocalGameTargets'] == ['games/high-life']
        assert set(filtered_manifest['resourceOwnedRoutesExcluded']) == {'/games/high-iq/'}
        assert filtered_manifest['fileCount'] == len(filtered_manifest['files']) == 3
        assert set(filtered_manifest['files']) == {
            'games/index.html',
            'games/high-land/index.html',
            'games/high-life/index.html',
        }

print('Public Suite resource ownership cutover tests passed.')
