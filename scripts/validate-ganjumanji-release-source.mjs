import assert from 'node:assert/strict';
import fs from 'node:fs';

const revisionPath = 'site/public-route-patch/assets/release-source-revisions/ganjumanji.txt';
const registryPath = 'site/deployment/public-apps.json';

const lines = Object.fromEntries(
  fs.readFileSync(revisionPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('=');
      assert.ok(index > 0, `Invalid source revision line: ${line}`);
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

assert.equal(lines.repository, 'dtfgenetics/GANJUMANJI-The-Lost-Grower-s-Temple');
assert.match(lines.commit || '', /^[0-9a-f]{40}$/);
assert.equal(lines.commit, 'e82580daa684fc7733ef6cfcb12a502939a609dd');
assert.equal(lines.version, '0.3.0');
assert.equal(lines.route, '/games/ganjumanji/');
assert.equal(lines.status, 'release-candidate');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const app = registry.apps.find((candidate) => candidate.id === 'ganjumanji');
assert.ok(app, 'Ganjumanji must remain registered in the central public-app registry.');
assert.equal(app.repository, lines.repository, 'registry repository must match the pinned source');
assert.equal(app.route, lines.route, 'registry route must match the pinned release route');
assert.equal(app.verifiedRevision, lines.commit, 'registry verifiedRevision must match the pinned source');
assert.ok(['ready-to-package', 'release-candidate'].includes(app.status), `unexpected Ganjumanji registry status: ${app.status}`);
assert.equal(app.runtime, 'static-phaser');

console.log(`Ganjumanji central source contract verified at ${lines.commit}.`);
