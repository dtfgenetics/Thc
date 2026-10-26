#!/usr/bin/env node
// Reconcile technology candidates with the authoritative public-tool owners.
// Read-only. Outputs actionable JSON; never installs external software.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(readFileSync(resolve(root,name),'utf8'));
const candidates=read('data/technology-adoption-registry.json').candidates;
const tools=read('data/tool-execution-registry.json').tools;
const report={schema_version:1,candidate_count:candidates.length,public_tool_count:tools.length,mapped:[],unmatched:[],errors:[]};
for(const c of candidates){
  const match=tools.filter(t=>t.canonical?.repo===c.target_repo &&
    (String(c.target_area).toLowerCase().includes(String(t.id).replaceAll('-',' ')) ||
     String(c.target_area).toLowerCase().includes(String(t.name).toLowerCase()) ||
     String(t.id).split('-').some(x=>x.length>4 && String(c.target_area).toLowerCase().includes(x))));
  const item={id:c.id,target_repo:c.target_repo,target_area:c.target_area,matching_tools:match.map(t=>({id:t.id,canonical_path:t.canonical.path,route:t.route}))};
  (match.length?report.mapped:report.unmatched).push(item);
  if(c.status==='production-verified' && !c.live_verification)report.errors.push(c.id+': missing live evidence');
}
if(process.argv.includes('--strict') && report.errors.length)process.exitCode=1;
console.log(JSON.stringify(report,null,2));
