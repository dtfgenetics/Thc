import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameQaCatalog } from './lib/game-qa-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const state = loadGameQaCatalog(root);

assert.ok(state.catalog.length >= 25, `expected at least 25 game routes, found ${state.catalog.length}`);
assert.ok(state.site.startsWith('https://'), `expected an https site URL, found ${state.site}`);

const ids = new Set();
const routes = new Set();
for (const game of state.catalog) {
  assert.ok(game.id, 'game id is required');
  assert.ok(game.title, `${game.id}: title is required`);
  assert.ok(game.route.startsWith('/games/'), `${game.id}: route must live under /games/`);
  assert.ok(game.route.endsWith('/'), `${game.id}: route must end with /`);
  assert.ok(game.canonicalRepository, `${game.id}: canonical repository is required`);
  assert.ok(Array.isArray(game.canonicalSourcePaths) && game.canonicalSourcePaths.length > 0, `${game.id}: canonical source paths are required`);
  assert.ok(!ids.has(game.id), `duplicate game id ${game.id}`);
  assert.ok(!routes.has(game.route), `duplicate game route ${game.route}`);
  ids.add(game.id);
  routes.add(game.route);
}

const deploymentBacked = state.catalog.filter((game) => game.deployment);
assert.ok(deploymentBacked.length >= 25, `expected at least 25 deployment-backed games, found ${deploymentBacked.length}`);

const localStatic = state.catalog.filter((game) => game.integrationMode === 'local-static');
assert.ok(localStatic.length > 0, 'expected at least one local-static game integration');
for (const game of localStatic) {
  assert.ok(game.integrationPath, `${game.id}: local-static integration must declare an integration path`);
}

console.log(`game QA catalog OK: ${state.catalog.length} routes, ${deploymentBacked.length} deployment-backed, ${localStatic.length} local-static`);
if (state.warnings.length) {
  console.log('catalog warnings:');
  for (const warning of state.warnings) console.log(`- ${warning}`);
}
