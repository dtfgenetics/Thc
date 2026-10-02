import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const script='scripts/build-release-observability.mjs';
const sha='a'.repeat(40);
const baseEnv={
  ...process.env,
  RELEASE_SOURCE_SHA:sha,
  RELEASE_RUN_ID:'12345',
  RELEASE_RUN_ATTEMPT:'1',
  RELEASE_EVENT_NAME:'workflow_dispatch',
  RELEASE_MODE:'full',
  RELEASE_FRESHNESS:'true',
  RELEASE_VERIFY_FRESHNESS:'true',
  RELEASE_ENFORCE_OUTCOME:'success',
  RELEASE_CHECKPOINT_OUTCOME:'success'
};

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dtf-release-observability-'));
const successPath=path.join(temp,'success.json');
execFileSync(process.execPath,[script,'--check',`--output=${successPath}`],{
  env:{
    ...baseEnv,
    RELEASE_WANT_PUBLIC:'true',
    RELEASE_PUBLIC_PUBLISH:'success',
    RELEASE_PUBLIC_VERIFY:'success'
  },
  stdio:'pipe'
});
const success=JSON.parse(fs.readFileSync(successPath,'utf8'));
assert.equal(success.overallState,'live-verified-checkpointed');
assert.equal(success.lanes.publicSuite.deployed.state,'verified');
assert.equal(success.lanes.publicSuite.liveVerified.state,'verified');
assert.equal(success.checkpoint.verified,true);
assert.equal(success.semantics.mergeSuccessIsProductionSuccess,false);

const noopPath=path.join(temp,'noop.json');
execFileSync(process.execPath,[script,'--check',`--output=${noopPath}`],{
  env:{
    ...baseEnv,
    RELEASE_ENFORCE_OUTCOME:'skipped',
    RELEASE_CHECKPOINT_OUTCOME:'skipped'
  },
  stdio:'pipe'
});
const noop=JSON.parse(fs.readFileSync(noopPath,'utf8'));
assert.equal(noop.overallState,'no-production-lanes');
assert.equal(noop.checkpoint.verified,false);

const invalid=spawnSync(process.execPath,[script,'--check'],{
  env:{
    ...baseEnv,
    RELEASE_WANT_PUBLIC:'true',
    RELEASE_PUBLIC_PUBLISH:'failure',
    RELEASE_PUBLIC_VERIFY:'success'
  },
  encoding:'utf8'
});
assert.notEqual(invalid.status,0,'live verification must not be accepted after failed deployment');

fs.rmSync(temp,{recursive:true,force:true});
console.log('Release observability self-test passed: checkpointed success, no-op, and impossible live-without-deploy states are distinguished.');
