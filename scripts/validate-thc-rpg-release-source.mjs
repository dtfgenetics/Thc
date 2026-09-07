import assert from 'node:assert/strict';
import fs from 'node:fs';

const revisionPath = 'site/public-route-patch/assets/release-source-revisions/thc-rpg.txt';
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

assert.equal(lines.repository, 'dtfgenetics/Thc-rpg');
assert.equal(lines.commit, '15fe22d69afaee906714a1ad0933505e437202dd');
assert.match(lines.commit || '', /^[0-9a-f]{40}$/);
assert.equal(lines.version, '2.0.0');
assert.equal(lines.route, '/games/thc-rpg/');
assert.equal(lines.status, 'release-candidate');
assert.equal(lines.artifact, 'thc-rpg-production-build');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const app = registry.apps.find((candidate) => candidate.id === 'thc-rpg');
assert.ok(app, 'THC RPG must remain registered in the central public-app registry.');
assert.equal(app.repository, lines.repository, 'registry repository must match the pinned source');
assert.equal(app.route, lines.route, 'registry route must match the pinned release route');
assert.equal(app.verifiedRevision, lines.commit, 'registry verifiedRevision must match the pinned source');
assert.equal(app.runtime, 'static-es-modules');
assert.equal(app.status, 'release-candidate');

console.log(`THC RPG central source contract verified at ${lines.commit}.`);
