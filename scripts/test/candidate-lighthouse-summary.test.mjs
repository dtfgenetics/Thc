import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readReports, summarizeReports} from '../summarize-candidate-lighthouse.mjs';

const report = () => ({lighthouseVersion:'12', categories:Object.fromEntries(['performance','accessibility','best-practices','seo'].map(key => [key,{score:key === 'performance' ? .93 : 1}])), audits:{'largest-contentful-paint':{score:.7,title:'Largest paint',displayValue:'2.8 s'}}});
test('reports each measured run and the failing performance metric', () => {
  const text = summarizeReports([report(), report()]);
  assert.equal(text.match(/performance \| 93/g).length, 2);
  assert.match(text, /largest-contentful-paint \| 2.8 s/);
  assert.match(text, /Largest paint/);
});
test('rejects empty measurements, runtime failures and missing scores', () => {
  assert.throws(() => summarizeReports([]), /No candidate/);
  assert.throws(() => summarizeReports([{...report(),runtimeError:{code:'NO_FCP'}}]), /NO_FCP/);
  assert.throws(() => summarizeReports([{categories:{}}]), /missing category/);
});
test('ignores manifest JSON and discovers nested reports', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'candidate-lh-'));
  try {
    fs.mkdirSync(path.join(dir,'lighthouse'));
    fs.writeFileSync(path.join(dir,'lighthouse','report.json'), JSON.stringify(report()));
    fs.writeFileSync(path.join(dir,'lighthouse','manifest.json'), '[]');
    assert.equal(readReports(dir).length, 1);
    fs.writeFileSync(path.join(dir,'broken.json'), '{');
    assert.throws(() => readReports(dir), SyntaxError);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('strips markup and never emits report URLs or resource details', () => {
  const data = report();
  data.finalUrl = 'https://example.org/?secret=private';
  data.audits['largest-contentful-paint'].title = '<script>\n|`title';
  data.audits['largest-contentful-paint'].details = {url:data.finalUrl};
  const text = summarizeReports([data]);
  assert.ok(!text.includes('<script>') && !text.includes('private'));
});
