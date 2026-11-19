import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const script=path.resolve('scripts/validate-lighthouse-regressions.mjs');
const scores=Object.fromEntries(['performance','accessibility','best-practices','seo'].map(key=>[key,{score:1}]));

function evaluate(report){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thc-lh-regression-'));
  try{
    const reports=path.join(dir,'reports');
    fs.mkdirSync(reports);
    fs.writeFileSync(path.join(reports,'audit.report.json'),JSON.stringify(report));
    const baseline=path.join(dir,'baseline.json');
    fs.writeFileSync(baseline,JSON.stringify({source:'fixture',policy:{},routes:{'/':{performance:1,accessibility:1,'best-practices':1,seo:1}}}));
    const output=path.join(dir,'output.json');
    const run=spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,WEB_QA_BASE_URL:'https://dtfseeds.com',WEB_QA_BASELINE_FILE:baseline,WEB_QA_LIGHTHOUSE_DIR:reports,WEB_QA_REGRESSION_REPORT:output,WEB_QA_REGRESSION_ENFORCE:'1',WEB_QA_REQUIRE_BASELINE_COVERAGE:'1'}});
    return {run,report:JSON.parse(fs.readFileSync(output,'utf8'))};
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('accepts a valid same-origin Lighthouse document',()=>{
  const {run,report}=evaluate({finalUrl:'https://dtfseeds.com/',categories:scores});
  assert.equal(run.status,0,run.stderr);
  assert.equal(report.measuredRoutes,1);
  assert.deepEqual(report.findings,[]);
});

test('rejects off-origin Lighthouse redirect even with perfect scores',()=>{
  const {run,report}=evaluate({finalUrl:'https://other.example/',categories:scores});
  assert.equal(run.status,1);
  assert.ok(report.findings.some(x=>x.type==='invalid-document'&&x.reason==='unexpected-origin'));
});

test('rejects Lighthouse runtime errors even with perfect scores',()=>{
  const {run,report}=evaluate({finalUrl:'https://dtfseeds.com/',runtimeError:{code:'ERRORED_DOCUMENT_REQUEST'},categories:scores});
  assert.equal(run.status,1);
  assert.ok(report.findings.some(x=>x.type==='invalid-document'&&x.reason==='runtime-error'));
});

test('rejects missing document URL',()=>{
  const {run,report}=evaluate({categories:scores});
  assert.equal(run.status,1);
  assert.ok(report.findings.some(x=>x.type==='invalid-document'));
});

test('rejects navigation failure warning even with numeric scores',()=>{
  const {run,report}=evaluate({finalUrl:'https://dtfseeds.com/',runWarnings:['ERRORED_DOCUMENT_REQUEST'],categories:scores});
  assert.equal(run.status,1);
  assert.ok(report.findings.some(x=>x.type==='invalid-document'&&x.reason==='navigation-warning'));
});

test('rejects same-origin looking URL on an untrusted host',()=>{
  const {run,report}=evaluate({finalUrl:'https://dtfseeds.com.attacker.example/',categories:scores});
  assert.equal(run.status,1);
  assert.ok(report.findings.some(x=>x.type==='invalid-document'&&x.reason==='unexpected-origin'));
});

test('rejects HTTP 403 browser document even with perfect category scores',()=>{
  const {run,report}=evaluate({finalUrl:'https://dtfseeds.com/',responseCode:403,categories:scores});
  assert.equal(run.status,1);
  assert.ok(report.findings.some(x=>x.type==='invalid-document'&&x.reason==='http-error'));
});

test('rejects HTTP 500 browser document even with perfect category scores',()=>{
  const {run,report}=evaluate({finalUrl:'https://dtfseeds.com/',responseCode:500,categories:scores});
  assert.equal(run.status,1);
  assert.ok(report.findings.some(x=>x.type==='invalid-document'&&x.reason==='http-error'));
});
