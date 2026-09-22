import fs from 'node:fs';

const site=(process.env.SITE||'https://dtfseeds.com').replace(/\/$/,'');
const base=`${site}/games/phenoquest/`;
const revisionText=fs.readFileSync('site/public-route-patch/games/phenoquest/source-revision.txt','utf8');
const expectedRevision=revisionText.match(/^commit=([0-9a-f]{40})$/m)?.[1];
if(!expectedRevision) throw new Error('Pinned PhenoQuest revision is missing.');

async function get(path,label){
  const response=await fetch(new URL(path,base),{
    redirect:'follow',
    cache:'no-store',
    signal:AbortSignal.timeout(15000),
    headers:{
      'user-agent':'DTFSeeds-PhenoQuest-live-verifier/1.0',
      'cache-control':'no-cache, no-store, max-age=0',
      pragma:'no-cache'
    }
  });
  if(!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return {text:await response.text(),type:response.headers.get('content-type')||'',url:response.url};
}

const [page,metaResult,sourceResult,style,experienceCss,experienceJs,gameJs,lineageJs,starterData]=await Promise.all([
  get('./','PhenoQuest route'),
  get('./build-meta.json','PhenoQuest build metadata'),
  get('./source-revision.txt','PhenoQuest source revision'),
  get('./style.css','PhenoQuest core styles'),
  get('./experience-v2.css','PhenoQuest experience styles'),
  get('./experience-v2.js','PhenoQuest experience runtime'),
  get('./game.js','PhenoQuest game runtime'),
  get('./lineage-runtime.js','PhenoQuest lineage runtime'),
  get('./_runtime/data/phenos/mvp_units.json','PhenoQuest starter data')
]);

if(!/text\/html/i.test(page.type)) throw new Error('PhenoQuest route did not return HTML.');
for(const marker of ['The Living Seed Vault','first-session-guide','journey-nav','./game.js','./lineage-runtime.js','./experience-v2.js']){
  if(!page.text.includes(marker)) throw new Error(`PhenoQuest HTML missing marker: ${marker}`);
}

const meta=JSON.parse(metaResult.text);
if(meta.project!=='PhenoQuest: The Living Seed Vault') throw new Error('Unexpected PhenoQuest project marker.');
if(meta.route!=='/games/phenoquest/') throw new Error('PhenoQuest route metadata drifted.');
if(meta.runtime!=='static-es-modules') throw new Error('PhenoQuest runtime metadata drifted.');
if(meta.selfContained!==true) throw new Error('PhenoQuest build must remain self-contained.');
for(const entry of ['game.js','lineage-runtime.js','experience-v2.js']){
  if(!meta.browserEntries?.includes(entry)) throw new Error(`PhenoQuest build metadata missing ${entry}`);
}

const compactStyle=style.text.replace(/\s+/g,'');
for(const marker of ['min-width:0','min-height:44px','overscroll-behavior-inline:contain','@media(max-width:390px)']){
  if(!compactStyle.includes(marker)) throw new Error(`PhenoQuest core CSS missing marker: ${marker}`);
}
const compactExperience=experienceCss.text.replace(/\s+/g,'');
if(!compactExperience.includes('top:calc(var(--dtf-global-header-height,74px)+8px)')) throw new Error('PhenoQuest journey nav no longer clears the site header.');
if(!compactExperience.includes('.journey-navbutton{flex:0 0 auto;min-height:44px') &&
   !compactExperience.includes('.journey-navbutton{flex:0 0 auto;min-height:44px')) {
  // Keep this check broad enough for minifier spacing while still requiring the touch target.
  if(!compactExperience.includes('min-height:44px')) throw new Error('PhenoQuest journey navigation lost its 44px touch target.');
}
if(!experienceJs.text.includes('prefers-reduced-motion: reduce') || !experienceJs.text.includes("reducedMotion ? 'auto' : 'smooth'")){
  throw new Error('PhenoQuest experience runtime lost reduced-motion handling.');
}

for(const [label,source] of [['game.js',gameJs.text],['lineage-runtime.js',lineageJs.text]]){
  if(source.includes('../../../src/') || source.includes('../../../data/')) throw new Error(`${label} leaked repository-relative imports.`);
  if(!source.includes('./_runtime/src/')) throw new Error(`${label} is not wired to route-local source runtime.`);
  if(!source.includes('./_runtime/data/')) throw new Error(`${label} is not wired to route-local data.`);
}
for(const marker of ['pairing_rules_mvp.json','result_units_mvp.json','restoration_goals_mvp.json','lineage-restoration.js','lineage-restoration-ui.js']){
  if(!lineageJs.text.includes(marker)) throw new Error(`PhenoQuest lineage runtime missing marker: ${marker}`);
}

const starters=JSON.parse(starterData.text);
const ids=new Set(starters.map((unit)=>unit.id));
for(const id of ['mango_puff','kush_cub','frostling']){
  if(!ids.has(id)) throw new Error(`PhenoQuest starter data missing ${id}`);
}

if(!sourceResult.text.includes(`commit=${expectedRevision}`)) throw new Error(`Live PhenoQuest source revision does not match ${expectedRevision}`);
if(!sourceResult.text.includes('repository=dtfgenetics/Catching-phenos')) throw new Error('Live PhenoQuest source repository marker missing.');

console.log(`PhenoQuest live verification passed at ${base} (pinned ${expectedRevision}).`);
