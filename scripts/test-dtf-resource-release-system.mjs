#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('site/deployment/release-resources.json', 'utf8'));
const resources = config.resources;

assert.equal(config.schemaVersion, 1);
assert.deepEqual(Object.keys(resources).sort(), ['high-iq', 'high-land', 'seed-man-platformer']);

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
assert.equal(affected('games/seed-man-platformer/data/campaign.json', resources['seed-man-platformer']), true);
assert.equal(affected('site/public-route-patch/games/seed-man-platformer/world-five-v1.js', resources['seed-man-platformer']), true);
assert.equal(affected('scripts/prepare-seed-man-combat-release.mjs', resources['seed-man-platformer']), true);
assert.equal(affected('games/high-iq/data/questions.json', resources['seed-man-platformer']), false);
assert.equal(affected('site/deployment/public-apps.json', resources['high-land']), true);
assert.equal(affected('site/deployment/public-apps.json', resources['high-iq']), true);
assert.equal(affected('site/deployment/public-apps.json', resources['seed-man-platformer']), true);

for (const [id, resource] of Object.entries(resources)) {
  assert.ok(resource.route.startsWith('/games/') && resource.route.endsWith('/'), `${id} route must be a game route`);
  assert.equal(resource.productionTarget, `route:${resource.route}`);
  assert.ok(resource.artifactRoot.startsWith('games/'));
  assert.ok(resource.requiredFiles.length > 0);
  for (const file of resource.requiredFiles) {
    assert.ok(file.startsWith(`${resource.artifactRoot}/`), `${id} required file escaped artifact root: ${file}`);
  }
  assert.ok(['suite', 'resource'].includes(resource.publicSuiteOwnership), `${id} has invalid Public Suite ownership`);
  assert.ok(resource.publisher?.status, `${id} must declare publisher readiness`);
}

assert.equal(resources['high-land'].publicSuiteOwnership, 'suite');
assert.equal(resources['high-land'].publisher.type, 'hostinger-ssh');
assert.equal(resources['high-land'].publisher.status, 'pilot-manual');
assert.equal(resources['high-land'].publisher.workflow, 'deploy-dtfseeds-public-resource.yml');
assert.equal(resources['high-land'].publisher.orchestration, undefined);

assert.equal(resources['high-iq'].publicSuiteOwnership, 'resource');
assert.equal(resources['high-iq'].publisher.type, 'wordpress-transactional-resource');
assert.equal(resources['high-iq'].publisher.status, 'pilot-manual');
assert.equal(resources['high-iq'].publisher.orchestration, 'gateway-managed');
assert.equal(resources['high-iq'].publisher.coordinator, 'dtfseeds-resource-production-gateway.yml');
assert.equal(resources['high-iq'].publisher.workflow, 'deploy-dtfseeds-wordpress-resource.yml');
assert.equal(resources['high-iq'].publisher.sharedProductionTarget, 'wordpress:temporary-code-snippets-bridge');
assert.notEqual(resources['high-iq'].publisher.sharedProductionTarget, resources['high-land'].productionTarget);

assert.equal(resources['seed-man-platformer'].publicSuiteOwnership, 'resource');
assert.equal(resources['seed-man-platformer'].publisher.type, 'wordpress-dedicated-route');
assert.equal(resources['seed-man-platformer'].publisher.status, 'production');
assert.equal(resources['seed-man-platformer'].publisher.orchestration, 'dedicated');
assert.equal(resources['seed-man-platformer'].publisher.workflow, 'publish-seed-man-production.yml');
assert.equal(resources['seed-man-platformer'].publisher.sharedProductionTarget, 'wordpress:seed-man-route');
assert.notEqual(resources['seed-man-platformer'].publisher.sharedProductionTarget, resources['high-iq'].publisher.sharedProductionTarget);

for (const path of [
  'scripts/assemble-wordpress-resource-v2.py',
  'scripts/public_suite_resource_ownership.py',
  'scripts/assemble-wordpress-suite-resource-aware.py',
  'scripts/package-public-suite-wordpress-resource-aware.py',
  'scripts/run-workflow-and-wait.sh',
  '.github/workflows/deploy-dtfseeds-public-resource.yml',
  '.github/workflows/deploy-dtfseeds-wordpress-resource.yml',
  '.github/workflows/dtfseeds-resource-production-gateway.yml',
]) {
  assert.ok(config.globalBuildPaths.includes(path), `shared resource control path missing: ${path}`);
}

for (const path of config.globalBuildPaths) {
  assert.ok(typeof path === 'string' && path.length > 0);
}

const handoffScript = readFileSync('scripts/run-workflow-and-wait.sh', 'utf8');
assert.match(handoffScript, /queue_replaced_exit=75/, 'workflow handoff must expose a retryable queue-replacement status');
assert.match(handoffScript, /displayTitle/, 'workflow handoff must correlate dispatches by exact-source run title when main has advanced');
assert.match(handoffScript, /contains\(\$sha\)/, 'workflow handoff must match the expected source SHA embedded in a run title');

const publisherWorkflow = readFileSync('.github/workflows/deploy-dtfseeds-wordpress-resource.yml', 'utf8');
assert.match(publisherWorkflow, /^run-name:.*inputs\.source_sha.*$/m, 'WordPress resource publisher must expose its exact source SHA in the run title');
assert.match(publisherWorkflow, /dtf-wordpress-temporary-code-snippets-bridge/, 'WordPress resource publisher must stay serialized on the shared bridge');

const gatewayWorkflow = readFileSync('.github/workflows/dtfseeds-resource-production-gateway.yml', 'utf8');
assert.match(gatewayWorkflow, /^\s+source_sha:\s*$/m, 'resource gateway must accept an exact-source recovery SHA');
assert.match(gatewayWorkflow, /^\s+recovery_attempt:\s*$/m, 'resource gateway must bound queue-replacement recovery attempts');
assert.match(gatewayWorkflow, /status" -eq 75/, 'resource gateway must recognize retryable zero-job queue replacement');
assert.match(gatewayWorkflow, /MAX_RECOVERY_ATTEMPTS: '5'/, 'resource gateway recovery must be bounded');
assert.doesNotMatch(gatewayWorkflow, /Detect superseded queued resource release/, 'unrelated newer main commits must not discard an exact-source resource release');

const builderWorkflow = readFileSync('.github/workflows/build-dtfseeds-public-resource.yml', 'utf8');
const helperTriggerCount = (builderWorkflow.match(/scripts\/run-workflow-and-wait\.sh/g) || []).length;
assert.ok(helperTriggerCount >= 2, 'resource builder must run on helper changes for both PR and main push events');

console.log('DTF resource release isolation tests passed.');
