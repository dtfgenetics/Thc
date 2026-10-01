#!/usr/bin/env node
import fs from 'node:fs';

const raw=String(process.argv[2]||'').trim().toLowerCase();
if(!raw){
  console.error('Usage: node scripts/project-session-plan.mjs <project-id-or-alias>');
  process.exit(2);
}
const execution=JSON.parse(fs.readFileSync('data/project-execution-registry.json','utf8'));
const projects=JSON.parse(fs.readFileSync('data/project-registry.json','utf8'));
const direct=(execution.projects||[]).find(p=>p.id===raw||(p.aliases||[]).includes(raw));
if(direct){
  console.log(JSON.stringify({
    ok:true,
    project:direct.id,
    canonicalRepo:direct.canonicalRepo,
    branchPattern:'work/'+direct.id+'/<task>/<session-id>',
    sourcePaths:direct.sourcePaths,
    validationCommand:direct.validationCommand,
    focusedValidationCommand:direct.focusedValidationCommand||null,
    buildCommand:direct.buildCommand||null,
    integration:direct.integration,
    notes:direct.notes
  },null,2));
  process.exit(0);
}
const registered=(projects.projects||[]).find(p=>String(p.id||'').toLowerCase()===raw);
if(registered){
  console.log(JSON.stringify({
    ok:true,
    project:registered.id,
    canonicalRepo:registered.repo,
    branchPattern:'work/'+registered.id+'/<task>/<session-id>',
    sourceOfTruth:registered.source_of_truth_doc||null,
    status:registered.status,
    repoRole:registered.repo_role,
    validationCommand:registered.repo==='dtfgenetics/Thc'?'npm run project:check && npm run games:preflight':'Use the canonical repository CI/tests before integration.',
    integration:{repo:'dtfgenetics/Thc',mode:registered.repo==='dtfgenetics/Thc'?'canonical-or-monorepo-release':'registered-external-project-handoff'},
    notes:'Resolved through data/project-registry.json. Do not change repository ownership without updating the canonical registries.'
  },null,2));
  process.exit(0);
}
console.error('Unknown project: '+raw);
console.error('Use an id/alias from data/project-execution-registry.json or data/project-registry.json.');
process.exit(1);
