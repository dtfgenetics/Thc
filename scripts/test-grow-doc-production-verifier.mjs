import assert from 'node:assert/strict';
import fs from 'node:fs';

const verifier=fs.readFileSync('scripts/verify-grow-doc-production.mjs','utf8');

for(const token of [
  "release-source-revisions/thc-grow-doc.txt",
  "process.env.EXPECTED_SOURCE_SHA || localRevision.commit",
  "const revisionRoute = '/thc-grow-doc/source-revision.txt'",
  "liveRevision.repository === 'dtfgenetics/Thc-dataset'",
  "liveRevision.route === route",
  "liveRevision.commit === expectedSourceSha",
  'sourceRevision: {',
  'expectedCommit: expectedSourceSha',
  'exactMatch: liveRevision.commit === expectedSourceSha'
]){
  assert.ok(verifier.includes(token), `Grow Doc production verifier contract missing: ${token}`);
}

console.log('Grow Doc production verifier contract passed.');
