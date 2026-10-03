#!/usr/bin/env node
import fs from 'node:fs';

const overlay=JSON.parse(fs.readFileSync('site/deployment/dtf420-static-overlay.json','utf8'));
const generic=fs.readFileSync('scripts/publish-wordpress-learning-center-pages.mjs','utf8');
const expansion=fs.readFileSync('scripts/publish-wordpress-learning-center-expansion-v1.mjs','utf8');
const errors=[];

const rootWriterContracts = [
  {
    path: 'scripts/update-wordpress-learn-learning-center.mjs',
    forbidden: ["method: 'POST'", 'method:"POST"', 'DTF-LEARNING-CENTER-START'],
    label: 'Learning Centers root guard'
  },
  {
    path: 'scripts/rebuild-wordpress-learn-visual-v4.mjs',
    forbidden: ["method: 'POST'", 'method:"POST"', 'APPLY_LEARN_V4'],
    label: 'retired standalone Learn V4 guard'
  },
  {
    path: 'scripts/publish-wordpress-learn-task-nav-v5.mjs',
    forbidden: ["method: 'POST'", 'method:"POST"', 'APPLY_LEARN_TASK_NAV_V5'],
    label: 'retired Task Nav V5 guard'
  },
  {
    path: 'scripts/ensure-learn-infographic-entry.mjs',
    forbidden: ["method: 'POST'", 'method:"POST"', 'dtf-learn-infographic-entry:start'],
    label: 'retired Learn infographic injector guard'
  }
];
for (const contract of rootWriterContracts) {
  const source=fs.readFileSync(contract.path,'utf8');
  for (const token of contract.forbidden) {
    if (source.includes(token)) errors.push(`${contract.label} regained forbidden Learn-root writer token: ${token}`);
  }
}

const workflowContracts = [
  ['.github/workflows/deploy-thc-learning-centers.yml','APPLY_LEARNING_CENTER_ROOT'],
  ['.github/workflows/wordpress-learn-visual-v4-production.yml','APPLY_LEARN_V4'],
  ['.github/workflows/wordpress-learn-task-nav-v5.yml','APPLY_LEARN_TASK_NAV_V5']
];
for (const [workflow,token] of workflowContracts) {
  const source=fs.readFileSync(workflow,'utf8');
  if(source.includes(token)) errors.push(`${workflow} regained forbidden standalone Learn-root apply token: ${token}`);
}

const slugs=(source)=>[...source.matchAll(/\{\s*slug:\s*'([^']+)'/g)].map(m=>m[1]);
const genericSlugs=new Set(slugs(generic));
const expansionSlugs=new Set(slugs(expansion));
const overlayLearn=new Set((overlay.routePrefixes||[])
  .filter(x=>x.startsWith('learn/'))
  .map(x=>x.slice('learn/'.length)));

for(const slug of genericSlugs){
  if(overlayLearn.has(slug)) errors.push(`duplicate public writer: /learn/${slug}/ is in generic WordPress publisher and Dtf420 overlay`);
}
for(const slug of expansionSlugs){
  if(!overlayLearn.has(slug)) errors.push(`expansion backing route /learn/${slug}/ is missing from its declared Dtf420 public overlay owner`);
}
if(overlayLearn.has('search')) errors.push('/learn/search/ must remain WordPress-owned and outside Dtf420 overlay');
if(!genericSlugs.has('search')) errors.push('/learn/search/ must remain in generic WordPress learning publisher');
if(!genericSlugs.has('encyclopedia')) errors.push('/learn/encyclopedia/ must remain in generic WordPress learning publisher');

const academy=(overlay.legacyCompatibilityRoutes||[]).find(x=>x.prefix==='learn/academy');
if(!academy) errors.push('/learn/academy/ must remain explicitly classified as legacy compatibility while staged');
if(genericSlugs.has('academy')) errors.push('generic WordPress learning publisher must not recreate legacy /learn/academy/');

if(errors.length){
  console.error(`Learning route writer boundary validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Learning route writer boundaries valid: ${genericSlugs.size} WordPress-owned full pages, ${expansionSlugs.size} overlay-backed expansion records, ${overlayLearn.size} Dtf420 learn prefixes; no duplicate public writers.`);
