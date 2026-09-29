import assert from 'node:assert/strict';
import fs from 'node:fs';

const revisionPath = 'site/public-route-patch/assets/release-source-revisions/ganjumanji.txt';
const registryPath = 'site/deployment/public-apps.json';
const portfolioPath = 'data/game-registry-v2.json';
const routeRevisionPath = 'site/public-route-patch/games/ganjumanji/source-revision.txt';

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
assert.equal(lines.version, '0.4.1');
assert.equal(lines.route, '/games/ganjumanji/');
assert.equal(lines.status, 'release-candidate');

const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
const portfolioGame = portfolio.games.find((candidate) => candidate.id === 'ganjumanji');
assert.ok(portfolioGame, 'Ganjumanji must remain registered in game-registry-v2.');
assert.equal(lines.repository, portfolioGame.production?.repository, 'pinned repository must match v2 canonical owner');
assert.equal(lines.route, portfolioGame.publicRoute, 'pinned route must match v2 route');
assert.equal(lines.commit, portfolioGame.release?.candidateRevision, 'pinned source must match v2 candidateRevision');

const routeRevision = Object.fromEntries(
  fs.readFileSync(routeRevisionPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('=');
      assert.ok(index > 0, `Invalid route source revision line: ${line}`);
      return [line.slice(0, index), line.slice(index + 1)];
    })
);
assert.equal(routeRevision.commit, lines.commit, 'route source revision must match central pinned source');
assert.equal(routeRevision.repository, lines.repository, 'route source repository must match central pinned source');
assert.equal(routeRevision.route, lines.route, 'route source route must match central pinned source');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const app = registry.apps.find((candidate) => candidate.id === 'ganjumanji');
assert.ok(app, 'Ganjumanji must remain registered in the central public-app registry.');
assert.equal(app.repository, lines.repository, 'registry repository must match the pinned source');
assert.equal(app.route, lines.route, 'registry route must match the pinned release route');
assert.equal(app.verifiedRevision, lines.commit, 'registry verifiedRevision must match the pinned source');
assert.ok(['ready-to-package', 'release-candidate'].includes(app.status), `unexpected Ganjumanji registry status: ${app.status}`);
assert.equal(app.runtime, 'static-phaser');
assert.equal(app.machineData?.regions, 5, 'Ganjumanji registry must describe all five 0.4.1 regions');
assert.equal(app.machineData?.relicSeeds, 10, 'Ganjumanji registry must describe all ten 0.4.1 relic seeds');
assert.equal(app.machineData?.saveVersion, 5, 'Ganjumanji registry must require save v5');
assert.doesNotMatch(String(app.build || ''), /playwright|test:e2e/i, 'Ganjumanji packaging must not restore Playwright');
assert.match(String(app.build || ''), /validate:ui/, 'Ganjumanji packaging must run deterministic UI validation');

console.log(`Ganjumanji central source contract verified at ${lines.commit}.`);
