#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('site/deployment/release-resources.json', 'utf8'));
const resources = config.resources;

assert.equal(config.schemaVersion, 1);
assert.deepEqual(Object.keys(resources).sort(), ['high-iq', 'high-land']);

const targets = Object.values(resources).map((r) => r.productionTarget);
const checkpoints = Object.values(resources).map((r) => r.checkpointTag);
assert.equal(new Set(targets).size, targets.length, 'production targets must be unique');
assert.equal(new Set(checkpoints).size, checkpoints.length, 'checkpoint tags must be unique');

function affected(file, resource) {
  return resource.exactPaths.includes(file) || resource.sourcePrefixes.some((prefix) => file.startsWith(prefix));
}

assert.equal(affected('apps/high-land-web/src/main.js', resources['high-land']), true);
assert.equal(affected('apps/high-land-web/src/main.js', resources['high-iq']), false);
assert.equal(affected('games/high-iq/data/questions.json', resources['high-iq']), true);
assert.equal(affected('games/high-iq/data/questions.json', resources['high-land']), false);
assert.equal(affected('site/public-route-patch/games/high-iq/index.html', resources['high-iq']), true);
assert.equal(affected('site/deployment/public-apps.json', resources['high-land']), true);
assert.equal(affected('site/deployment/public-apps.json', resources['high-iq']), true);

for (const [id, resource] of Object.entries(resources)) {
  assert.ok(resource.route.startsWith('/games/') && resource.route.endsWith('/'), `${id} route must be a game route`);
  assert.equal(resource.productionTarget, `route:${resource.route}`);
  assert.ok(resource.artifactRoot.startsWith('games/'));
  assert.ok(resource.requiredFiles.length > 0);
  for (const file of resource.requiredFiles) {
    assert.ok(file.startsWith(`${resource.artifactRoot}/`), `${id} required file escaped artifact root: ${file}`);
  }
  assert.equal(resource.publicSuiteOwnership, 'resource', `${id} must stay outside the broad Public Suite writer`);
  assert.equal(resource.publisher?.status, 'gateway-managed', `${id} publisher must be gateway-managed`);
  assert.equal(resource.publisher?.coordinator, 'dtfseeds-production-gateway.yml', `${id} must use the central production coordinator`);
}

assert.equal(resources['high-land'].publisher.type, 'hostinger-ssh');
assert.equal(resources['high-land'].publisher.workflow, 'deploy-dtfseeds-public-resource.yml');
assert.equal(resources['high-iq'].publisher.type, 'wordpress-transactional-resource');
assert.equal(resources['high-iq'].publisher.workflow, 'deploy-dtfseeds-wordpress-resource.yml');
assert.equal(resources['high-iq'].publisher.sharedProductionTarget, 'wordpress:temporary-code-snippets-bridge');
assert.notEqual(resources['high-iq'].publisher.sharedProductionTarget, resources['high-land'].productionTarget);

for (const path of [
  'scripts/assemble-wordpress-resource-v2.py',
  'scripts/public_suite_resource_ownership.py',
  'scripts/assemble-wordpress-suite-resource-aware.py',
  'scripts/package-public-suite-wordpress-resource-aware.py',
  '.github/workflows/deploy-dtfseeds-public-resource.yml',
  '.github/workflows/deploy-dtfseeds-wordpress-resource.yml',
]) {
  assert.ok(config.globalBuildPaths.includes(path), `shared resource control path missing: ${path}`);
}

for (const path of config.globalBuildPaths) {
  assert.ok(typeof path === 'string' && path.length > 0);
}

console.log('DTF resource release isolation tests passed.');
