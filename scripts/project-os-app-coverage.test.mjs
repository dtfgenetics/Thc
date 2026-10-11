import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessAppWorkflowCoverage} from './project-os-app-coverage.mjs';
const sha='a'.repeat(40),digest='sha256:'+'b'.repeat(64);
const app={id:'high-land',repository:'dtfgenetics/Thc'};
const observation={category:'build',repository:'dtfgenetics/Thc',sha,runId:12,attempt:1};
const job={id:8,status:'completed',conclusion:'success',appIds:['high-land'],headSha:sha,runId:12,runAttempt:1};
const artifact={id:7,appId:'high-land',headSha:sha,runId:12,runAttempt:1,digest,expired:false};
test('requires matching app-scoped successful job and immutable artifact',()=>{
  assert.equal(assessAppWorkflowCoverage(app,observation,{jobs:[job],artifacts:[artifact]}).verified,true);
});
test('successful workflow alone never certifies an application',()=>{
  assert.equal(assessAppWorkflowCoverage(app,observation).verified,false);
});
test('other app jobs and artifacts cannot certify this app',()=>{
  const otherJob={...job,appIds:['weedopolis']};
  const otherArtifact={...artifact,appId:'weedopolis'};
  const result=assessAppWorkflowCoverage(app,observation,{jobs:[otherJob],artifacts:[otherArtifact]});
  assert.equal(result.verified,false);
  assert(result.reasons.includes('no-successful-app-scoped-job'));
});
test('failed or skipped jobs never count',()=>{
  for(const conclusion of ['failure','skipped','cancelled']) {
    assert.equal(assessAppWorkflowCoverage(app,observation,{jobs:[{...job,conclusion}],artifacts:[artifact]}).verified,false);
  }
});
test('rejects mismatched revision, run attempt and untrusted artifact digest',()=>{
  for(const override of [{headSha:'c'.repeat(40)},{runAttempt:2},{digest:'invalid'},{expired:true}]){
    assert.equal(assessAppWorkflowCoverage(app,observation,{jobs:[job],artifacts:[{...artifact,...override}]}).verified,false);
  }
});
test('repository mismatch cannot be bypassed by valid jobs',()=>{
  assert.equal(assessAppWorkflowCoverage({...app,repository:'dtfgenetics/Tools'},observation,{jobs:[job],artifacts:[artifact]}).verified,false);
});
