import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderProjectOsSummary} from './project-os-ci-summary.mjs';
const categories=Object.fromEntries(['source','build','responsive','content','security','production'].map(k=>[k,{pass:0,fail:0,unknown:1}]));
test('reports every category and explicitly disclaims production authorization',()=>{
 const md=renderProjectOsSummary({totalApps:1,readyApps:0,blockedApps:1,categories,blockers:[{appId:'example',missing:[{category:'build',reason:'unverified'}]}]});
 assert.match(md,/\| production \|/);
 assert.match(md,/example/);
 assert.match(md,/not\*\* production authorization/);
});
test('escapes untrusted app values to preserve markdown table shape',()=>{
 const md=renderProjectOsSummary({totalApps:1,readyApps:0,blockedApps:1,categories,blockers:[{appId:'bad|app',missing:[{category:'build',reason:'x|y'}]}]});
 assert(md.includes('bad\\|app'));
 assert(md.includes('x\\|y'));
});
test('rejects missing category results',()=>{
 assert.throws(()=>renderProjectOsSummary({totalApps:1,readyApps:0,blockedApps:0,categories:{},blockers:[]}),/Missing/);
});
