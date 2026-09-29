import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderScopeMaster } from './generate-game-registry-docs.mjs';

const scope = fs.readFileSync('docs/DTF_GAME_SCOPE_MASTER.md', 'utf8');
const registry = JSON.parse(fs.readFileSync('data/game-registry-v2.json', 'utf8'));
const navigation = JSON.parse(fs.readFileSync('data/public-navigation.json', 'utf8'));
const hub = fs.readFileSync('site/public-route-patch/games/index.html', 'utf8');

const expectedScope = renderScopeMaster(registry) + '\n';
assert.equal(scope, expectedScope, 'DTF_GAME_SCOPE_MASTER.md is stale; run npm run games:registry:docs');

const registryPublic = registry.games
  .filter((game) => ['public-unverified', 'public-verified'].includes(game.release?.status))
  .sort((a, b) => a.id.localeCompare(b.id));

const navigationPublic = navigation.games
  .filter((game) => game.public === true)
  .sort((a, b) => a.id.localeCompare(b.id));

assert.ok(registryPublic.length > 0, 'v2 registry must contain public-route games');
assert.equal(
  navigationPublic.length,
  registryPublic.length,
  `public navigation has ${navigationPublic.length} games but v2 has ${registryPublic.length} public-route games`
);

for (let i = 0; i < registryPublic.length; i += 1) {
  const expected = registryPublic[i];
  const actual = navigationPublic[i];
  assert.equal(actual.id, expected.id, `public game id drift at index ${i}`);
  assert.equal(actual.route, expected.publicRoute, `${expected.id}: navigation route differs from v2`);
  assert.equal(actual.title, expected.title, `${expected.id}: navigation title differs from v2`);
}

const markerMatch = hub.match(/deployment-verification-marker:\s*(\d+)\s+playable browser games/i);
assert.ok(markerMatch, 'Game Hub is missing its playable-count deployment marker');
assert.equal(Number(markerMatch[1]), registryPublic.length, 'Game Hub deployment marker disagrees with v2 public-route count');

const heroCountMatch = hub.match(/<strong>(\d+)<\/strong><span>playable browser games<\/span>/i);
assert.ok(heroCountMatch, 'Game Hub hero is missing its playable-game count');
assert.equal(Number(heroCountMatch[1]), registryPublic.length, 'Game Hub hero count disagrees with v2 public-route count');

const rootCause = registry.games.find((game) => game.id === 'root-cause');
assert.ok(rootCause, 'v2 registry is missing Root Cause');
assert.notEqual(rootCause.release?.status, 'public-verified', 'Root Cause cannot become confirmed live without exact verification evidence');
assert.ok(!registryPublic.some((game) => game.id === 'root-cause'), 'Root Cause is in the public-route catalog without an explicit promotion decision');

console.log(`Game scope verified from v2: ${registryPublic.length} public-route games, ${registry.concepts.length} concepts.`);
