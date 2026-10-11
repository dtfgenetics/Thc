import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('./validate-lighthouse-regressions.mjs',import.meta.url));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dtf-lighthouse-regression-'));
const reports=path.join(temp,'reports');
fs.mkdirSync(reports);
const baseline=path.join(temp,'baseline.json');
const output=path.join(temp,'output.json');
fs.writeFileSync(baseline,JSON.stringify({
  source:{kind:'test'},
  policy:{absoluteFloors:{performance:0.5,accessibility:0.5,'best-practices':0.5,seo:0.5},maxRegression:{}},
  routes:{'/':{performance:0.9,accessibility:0.9,'best-practices':0.9,seo:0.9}}
}));
const env={...process.env,WEB_QA_BASELINE_FILE:baseline,WEB_QA_LIGHTHOUSE_DIR:reports,WEB_QA_REGRESSION_REPORT:output,WEB_QA_REGRESSION_ENFORCE:'1',WEB_QA_REQUIRE_BASELINE_COVERAGE:'1'};
function run(categoryScores){
  fs.writeFileSync(path.join(reports,'home.report.json'),JSON.stringify({finalUrl:'https://dtfseeds.com/',categories:Object.fromEntries(Object.entries(categoryScores).map(([key,score])=>[key,{score}]))}));
  const result=spawnSync(process.execPath,[script],{env,encoding:'utf8'});
  const report=JSON.parse(fs.readFileSync(output,'utf8'));
  return {result,report};
}
try {
  let check=run({performance:0.9,accessibility:0.9,'best-practices':0.9,seo:0.9});
  assert.equal(check.result.status,0,'valid scores must pass');
  for(const invalid of [undefined,null,'0.9',-0.1,1.1]){
    const scores={performance:0.9,accessibility:0.9,'best-practices':0.9,seo:0.9};
    scores.accessibility=invalid;
    check=run(scores);
    assert.equal(check.result.status,1,'invalid Lighthouse category must fail enforced audit');
    assert(check.report.findings.some(f=>f.category==='accessibility'&&f.type==='invalid-score'));
  }
  fs.rmSync(path.join(reports,'home.report.json'));
  const missing=spawnSync(process.execPath,[script],{env,encoding:'utf8'});
  assert.equal(missing.status,1,'missing baseline route must fail when coverage required');
  assert(JSON.parse(fs.readFileSync(output,'utf8')).findings.some(f=>f.type==='missing-route-measurement'));
  console.log('Lighthouse regression validity tests passed');
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
