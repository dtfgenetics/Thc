#!/usr/bin/env python3
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import zipfile
from public_suite_resource_ownership import filter_archive

repo = Path(__file__).resolve().parents[1]
source = ast.parse((repo / 'scripts/package-public-suite-wordpress.py').read_text())
for name in ('allowed', 'required'):
    value = next(ast.literal_eval(node.value) for node in source.body if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == name for target in node.targets))
    assert value.count('dtf-build.json') == 1, name
    assert value.count('data/research/evidence/latest.json') == 1, name
    assert 'data' not in value and 'data/research' not in value, 'data ownership must stay exact'
    assert 'index.html' not in value, 'WordPress root must remain excluded'

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    bridge = root / 'bridge.mjs'
    subprocess.run([sys.executable, str(repo / 'scripts/assemble-wordpress-suite-resource-aware.py'), str(bridge)], check=True, capture_output=True)
    text = bridge.read_text()
    for variable in ('targets', 'required', 'exact_files'):
        match = re.search(r'\$' + variable + r' = \[(.*?)\];', text, re.S)
        assert match, variable
        entries = re.findall(r"'([^']+)'", match[1])
        assert entries.count('dtf-build.json') == 1, variable
        assert entries.count('data/research/evidence/latest.json') == 1, variable
        assert 'data/' not in entries and 'data/research/' not in entries
        assert 'index.html' not in entries, variable
    subprocess.run(['node', '--check', str(bridge)], check=True)
    build = b'{"master":"' + b'a' * 40 + b'"}\n'
    manifest = {'schemaVersion': 1, 'purpose': 'dtfseeds-public-apps-only', 'targets': ['dtf-build.json'], 'required': ['dtf-build.json'], 'files': {}}
    endpoint = 'data/research/evidence/latest.json'
    evidence = (repo / 'site/public-route-patch' / endpoint).read_bytes()
    manifest['targets'].append(endpoint)
    manifest['required'].append(endpoint)
    archive = root / 'source.zip'
    with zipfile.ZipFile(archive, 'w') as out:
        out.writestr('.dtf-suite-manifest.json', json.dumps(manifest))
        out.writestr('dtf-build.json', build)
        out.writestr(endpoint, evidence)
    filtered = root / 'filtered.zip'
    filter_archive(archive, filtered, repo)
    with zipfile.ZipFile(filtered) as result:
        assert result.read('dtf-build.json') == build, 'revision metadata must remain unchanged'
        assert result.read(endpoint) == evidence, 'research evidence must survive resource filtering'
        final = json.loads(result.read('.dtf-suite-manifest.json'))
        assert endpoint in final['targets'] and endpoint in final['required']
        assert final['files'][endpoint]['sha256'] == hashlib.sha256(evidence).hexdigest()
        assert 'dtf-build.json' in final['targets'] and 'dtf-build.json' in final['required']
        assert final['files']['dtf-build.json']['sha256'] == hashlib.sha256(build).hexdigest()
print('WordPress suite build-manifest integration checks passed.')
