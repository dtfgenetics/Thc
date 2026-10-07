import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const capability of ['code', 'reasoning', 'structured-extraction']) {
  const result = spawnSync(process.execPath, ['scripts/plan-local-ai-worker.mjs', capability, '--json'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.controlPlane, 'project-os');
  assert.equal(plan.productionAuthority, false);
  assert(plan.runtime?.id);
  assert(plan.model?.id);
  assert(plan.mandatoryGates.includes('verification-profile'));
}

const invalid = spawnSync(process.execPath, ['scripts/plan-local-ai-worker.mjs', 'unknown'], { encoding: 'utf8' });
assert.equal(invalid.status, 2);
console.log('Local AI worker planner tests passed.');
