import assert from 'node:assert/strict';
import fs from 'node:fs';

const revisionPath = 'site/public-route-patch/assets/release-source-revisions/thc-rpg.txt';
const registryPath = 'site/deployment/public-apps.json';
const contractPath = 'site/deployment/external-games/thc-rpg.json';
const expectedRevision = 'bff31f0d6425f822a2647a7601c09cbd1b30a01d';

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
assert.equal(lines.commit, expectedRevision);
assert.match(lines.commit || '', /^[0-9a-f]{40}$/);
assert.equal(lines.version, '2.1.0');
assert.equal(lines.route, '/games/thc-rpg/');
assert.equal(lines.status, 'release-candidate');
assert.equal(lines.artifact, 'thc-rpg-production-build');

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
assert.equal(contract.repository, lines.repository);
assert.equal(contract.route, lines.route);
assert.equal(contract.verifiedRevision, expectedRevision);
assert.equal(contract.runtime, 'static-es-modules');
assert.equal(contract.status, 'release-candidate');
assert.match(contract.build, /npm run validate:ui/);
assert.doesNotMatch(contract.build, /test:e2e|playwright/i);
assert.equal(contract.promotionGate?.standaloneCI, 'passed');
assert.equal(contract.promotionGate?.deterministicUiValidation, 'passed');
assert.equal(contract.promotionGate?.browserAcceptance, undefined);
assert.equal(contract.machineData?.saveVersion, 6);
assert.equal(contract.machineData?.modalGameplayShortcutGuard, true);

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const app = registry.apps.find((candidate) => candidate.id === 'thc-rpg');
assert.ok(app, 'THC RPG must remain registered in the central public-app registry.');
assert.equal(app.repository, lines.repository, 'registry repository must match the pinned source');
assert.equal(app.route, lines.route, 'registry route must match the pinned release route');
assert.equal(app.verifiedRevision, lines.commit, 'registry verifiedRevision must match the pinned source');
assert.equal(app.runtime, 'static-es-modules');
assert.equal(app.status, 'release-candidate');
assert.equal(app.machineData?.saveVersion, 6);
assert.equal(app.machineData?.modalGameplayShortcutGuard, true);
assert.match(app.build, /npm run validate:ui/);
assert.doesNotMatch(app.build, /test:e2e|playwright/i);

console.log(`THC RPG central source contract verified at ${lines.commit}.`);
