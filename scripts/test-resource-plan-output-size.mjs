import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const temp = mkdtempSync(join(tmpdir(),'dtf-resource-plan-size-'));
try {
  const git = join(temp,'git');
  writeFileSync(git, `#!${process.execPath}\nprocess.stdout.write(['global.css',...Array.from({length:6000},(_,i)=>'apps/fixture/src/deep/checkpoint-history/generated-file-'+i+'.mjs')].join('\\n'));\n`);
  chmodSync(git,0o755);
  const resource = {route:'/games/fixture/',artifactRoot:'games/fixture',productionTarget:'route:/games/fixture/',exactPaths:[],sourcePrefixes:['apps/fixture/'],publicSuiteOwnership:'resource',publisher:{workflow:'fixture.yml',orchestration:'gateway-managed'}};
  const config = join(temp,'config.json'), output = join(temp,'outputs.txt');
  writeFileSync(config,JSON.stringify({schemaVersion:1,globalBuildPaths:['global.css'],resources:{fixture:resource}}));
  const stdout = execFileSync(process.execPath,['scripts/plan-dtfseeds-resource-release.mjs',`--config=${config}`,'--base=fixture-base','--head=fixture-head','--gateway-managed-only=true'],{
    encoding:'utf8',maxBuffer:5*1024*1024,env:{...process.env,PATH:temp+delimiter+process.env.PATH,GITHUB_OUTPUT:output}
  });
  const detailed = JSON.parse(stdout);
  assert.equal(detailed.resources[0].changedFiles.length,6001,'full inventory must remain available');
  const line = readFileSync(output,'utf8').split('\n').find(x=>x.startsWith('plan='));
  const transport = line.slice(5), plan = JSON.parse(transport);
  assert.ok(Buffer.byteLength(transport)<16*1024,'transport must stay below per-variable OS limits');
  assert.equal(plan.resources[0].changedFileCount,6001);
  assert.equal(plan.resources[0].publisherWorkflow,'fixture.yml');
  assert.equal(plan.deploy,true);
  assert.deepEqual(plan.matrix,detailed.matrix);
  const child = spawnSync(process.execPath,['-e','JSON.parse(process.env.RESOURCE_PLAN)'],{env:{...process.env,RESOURCE_PLAN:transport}});
  assert.ifError(child.error);
  assert.equal(child.status,0);
  if (process.platform==='linux') {
    const original = spawnSync(process.execPath,['-e','0'],{env:{...process.env,RESOURCE_PLAN:JSON.stringify(detailed)}});
    assert.equal(original.error?.code,'E2BIG','negative control must reproduce the original Linux failure');
  }
  console.log('Resource plan transport: 6,001-file checkpoint diff preserved in evidence; bounded job output starts successfully.');
} finally {
  rmSync(temp,{recursive:true,force:true});
}
