#!/usr/bin/env node
import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('data/project-execution-registry.json','utf8'));
const repos=JSON.parse(fs.readFileSync('data/repository-registry.json','utf8'));
const errors=[];
const ok=(v,m)=>{if(!v)errors.push(m)};
ok(registry.schemaVersion===1,'project execution registry must use schemaVersion 1');
ok(registry.branchPolicy?.preferredPattern==='work/<project-id>/<task>/<session-id>','preferred work branch pattern must stay session-isolated');
const knownRepos=new Set((repos.repositories||[]).map(r=>r.repo));
const ids=new Set(), aliases=new Set();
for(const p of registry.projects||[]){
  ok(typeof p.id==='string'&&p.id,'every execution project needs an id');
  ok(!ids.has(p.id),'duplicate execution project id: '+p.id); ids.add(p.id);
  ok(knownRepos.has(p.canonicalRepo),'execution project '+p.id+' references unregistered repo '+p.canonicalRepo);
  ok(Array.isArray(p.sourcePaths)&&p.sourcePaths.length>0,'execution project '+p.id+' needs sourcePaths');
  ok(typeof p.validationCommand==='string'&&p.validationCommand.length>0,'execution project '+p.id+' needs validationCommand');
  ok(p.integration&&typeof p.integration.repo==='string','execution project '+p.id+' needs integration repo');
  for(const a of p.aliases||[]){
    ok(!ids.has(a)&&!aliases.has(a),'duplicate project alias: '+a);
    aliases.add(a);
  }
}
for(const required of ['platform','growlens','games','tools','plant-atlas','terpene-atlas','grow-doc','encyclopedia','academy','genetics','dtf420-migration']){
  ok(ids.has(required),'missing required execution project: '+required);
}
const forbiddenOwners=new Set(['dtfgenetics/Dtf420','dtfgenetics/dtf-thc-hub']);
for(const p of registry.projects||[]){
  if(['plant-atlas','terpene-atlas','tools','grow-doc','encyclopedia','academy'].includes(p.id)){
    ok(!forbiddenOwners.has(p.integration?.repo)||p.id==='dtf420-migration','canonical product '+p.id+' cannot integrate by treating migration repo as owner');
  }
}
if(errors.length){
  console.error('Project execution registry invalid:');
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log('Project execution registry valid: '+registry.projects.length+' major work domains have canonical repo/session/validation contracts.');
