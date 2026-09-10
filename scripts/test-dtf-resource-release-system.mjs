#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('site/deployment/release-resources.json', 'utf8'));
const resources = config.resources;

assert.equal(config.schemaVersion, 1);
assert.ok(resources && typeof resources === 'object' && !Array.isArray(resources), 'resources must be an object');

const targets = Object.values(resources).map((r) => r.productionTarget).filter(Boolean);
const checkpoints = Object.values(resources).map((r) => r.checkpointTag).filter(Boolean);
assert.equal(new Set(targets).size, targets.length, 'production targets must be unique');
assert.equal(new Set(checkpoints).size, checkpoints.length, 'checkpoint tags must be unique');

function affected(file, resource) {
  return (resource.exactPaths || []).includes(file) || (resource.sourcePrefixes || []).some((prefix) => file.startsWith(prefix));
}

for (const [id, resource] of Object.entries(resources)) {
  if (resource.route) assert.ok(resource.route.startsWith('/') && resource.route.endsWith('/'), `${id} route must be an absolute directory route`);
  if (resource.productionTarget && resource.route) assert.equal(resource.productionTarget, `route:${resource.route}`);
  if (resource.artifactRoot) assert.ok(typeof resource.artifactRoot === 'string' && resource.artifactRoot.length > 0);
  assert.ok(Array.isArray(resource.sourcePrefixes || []), `${id} sourcePrefixes must be an array`);
  assert.ok(Array.isArray(resource.exactPaths || []), `${id} exactPaths must be an array`);
  assert.ok(Array.isArray(resource.requiredFiles || []), `${id} requiredFiles must be an array`);
  for (const file of resource.requiredFiles || []) {
    assert.ok(typeof file === 'string' && file.length > 0, `${id} has an invalid required file`);
    if (resource.artifactRoot) assert.ok(file.startsWith(`${resource.artifactRoot}/`), `${id} required file escaped artifact root: ${file}`);
  }
  for (const prefix of resource.sourcePrefixes || []) assert.ok(typeof prefix === 'string' && prefix.length > 0, `${id} has invalid source prefix`);
  for (const file of resource.exactPaths || []) assert.ok(typeof file === 'string' && file.length > 0, `${id} has invalid exact path`);
  if (resource.publisher) assert.ok(typeof resource.publisher === 'object' && !Array.isArray(resource.publisher), `${id} publisher must be an object`);
}

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

console.log('DTF resource release consistency tests passed.');
