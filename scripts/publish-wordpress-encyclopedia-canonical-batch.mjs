import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { effectiveLessonAssessment, buildLessonAnswerRationalesV1 } from './lib/encyclopedia-assessment-v2.mjs';
import { learnerFacingWorkedExampleFor } from './lib/encyclopedia-worked-examples.mjs';
import { encyclopediaStructuredDataHtml } from './lib/encyclopedia-structured-data.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME;
const pass=process.env.WP_API_PASSWORD;
const input=process.env.ENCYCLOPEDIA_BATCH_FILE||'site/wordpress/education/encyclopedia/volume01-batch02.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-encyclopedia-production';
if(!user||!pass) throw new Error('Missing WordPress API credentials.');
const auth=Buffer.from(`${user}:${pass}`).toString('base64');
const batch=JSON.parse(await readFile(input,'utf8'));
const registryState=loadEncyclopediaRegistry(process.cwd());
const registryById=new Map(registryState.entries.map(entry=>[entry.id,entry]));
const registryTitleById=new Map(registryState.entries.map(entry=>[entry.id,String(entry.title||entry.displayTitle||entry.id)]));
let publicationCeiling=420;
try{
  const currentBatch=JSON.parse(await readFile('site/wordpress/education/encyclopedia/current-production-batch.json','utf8'));
  const publishedNumbers=(currentBatch.lessonFiles||[])
    .map(file=>Number(String(file).match(/thc-enc-(\d{3,})\.json$/i)?.[1]||0))
    .filter(Number.isFinite);
  publicationCeiling=Math.max(420,...publishedNumbers);
}catch{
  // Keep the protected core ceiling if the current production pointer is unavailable.
}
if(!Array.isArray(batch.lessonFiles)||!batch.lessonFiles.length) throw new Error('Batch has no lessonFiles.');
if(batch.publicationAuthorized===false||batch.status==='blocked_external_review'){
  throw new Error(`Batch ${batch.batch||input} is review-only and not authorized for publication.`);
}

const malformedPublicCopy=/\b(?:Open|ppen) sourc(?:\b|ee\b)|\bsourcee\b|\babstracte\b/i;
const genericMisconceptionPlaceholder=/see the (controlled )?lesson evidence and context/i;
const textValue=value=>typeof value==='string'?value:(value&&typeof value==='object'?JSON.stringify(value):'');
function assertPublicationCopyClean(lesson){
  const badSource=(Array.isArray(lesson.sourceNotes)?lesson.sourceNotes:[]).find(note=>malformedPublicCopy.test(textValue(note)));
  if(badSource) throw new Error(`${lesson.id} contains malformed public source copy and cannot be published: ${textValue(badSource).slice(0,120)}`);
  const badMisconception=(Array.isArray(lesson.misconceptions)?lesson.misconceptions:[]).find(row=>genericMisconceptionPlaceholder.test(textValue(row)));
  if(badMisconception) throw new Error(`${lesson.id} contains placeholder misconception copy and cannot be published.`);
}

const ownerOverrideIds=new Set(Array.isArray(batch.ownerOverrideLessonIds)?batch.ownerOverrideLessonIds:[]);
if(ownerOverrideIds.size && batch.ownerPublicationOverride!==true) throw new Error('Owner override lesson IDs require ownerPublicationOverride=true.');

const lessons=[];
for(const file of batch.lessonFiles){
  const lesson=JSON.parse(await readFile(file,'utf8'));
  if(!/^THC-ENC-\d{3,}$/.test(lesson.id)) throw new Error(`Invalid lesson ID in ${file}`);
  if(!lesson.title||!lesson.objective||!Array.isArray(lesson.coreScience)||lesson.coreScience.length<2) throw new Error(`Incomplete canonical lesson ${lesson.id}`);
  const ownerOverride=ownerOverrideIds.has(lesson.id);
  if(ownerOverride){
    if(!String(lesson.reviewControl?.releaseTimeReview||'').startsWith('completed_')) throw new Error(`${lesson.id}: owner publication override requires completed releaseTimeReview`);
    if(lesson.reviewControl?.independentApproval===true) throw new Error(`${lesson.id}: owner publication override cannot stand in for independent approval`);
    if(lesson.reviewControl?.safetyHold===true||lesson.safetyHold===true) throw new Error(`${lesson.id}: explicit safety hold cannot be overridden`);
  }
  if(lesson.reviewControl?.publicationAuthorized===false && !ownerOverride){
    throw new Error(`${lesson.id} is blocked from publication by reviewControl.publicationAuthorized=false`);
  }
  assertPublicationCopyClean(lesson);
  lessons.push({...lesson,_sourceFile:file});
}

const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fingerprintOf=a=>createHash('sha256').update(JSON.stringify({id:a.id,title:a.title,objective:a.objective,terms:a.terms,coreScience:a.coreScience,cultivationRelevance:a.cultivationRelevance,measureAndRecord:a.measureAndRecord,misconceptions:a.misconceptions,evidenceLimits:a.evidenceLimits,crossLinks:a.crossLinks,sourceNotes:a.sourceNotes,assessment:effectiveLessonAssessment(a).prompts})).digest('hex').slice(0,24);
const stableSlug=id=>id.toLowerCase();
const list=a=>`<ul class="thc-list">${(Array.isArray(a)?a:[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const glossaryHref=term=>'/learn/glossary/?term='+encodeURIComponent(String(term||'').trim());
const terms=a=>`<dl class="thc-terms">${(a||[]).map(x=>{const term=String(x?.term||x||'').trim();const definition=String(x?.definition||'').trim();return `<div><dt><a href="${esc(glossaryHref(term))}">${esc(term)}</a></dt><dd>${esc(definition)}</dd></div>`}).join('')}</dl>`;
const sourceNotesHtml=a=>{
  const notes=sourceNotes(a);
  if(!notes.length) return '<p class="thc-empty-state">No public source notes are attached to this release.</p>';
  return '<ol class="thc-sources">'+notes.map(note=>{
    const raw=String(note||'');
    const escaped=esc(raw);
    const linked=escaped.replace(/(https:\/\/[^\s<]+)/g,url=>`<a href="${url.replace(/[),.;]+$/,'')}" rel="noopener noreferrer">${url.replace(/[),.;]+$/,'')}</a>`);
    return '<li>'+linked+'</li>';
  }).join('')+'</ol>';
};
const relatedIds=a=>{
  const raw=Array.isArray(a?.crossLinks)?a.crossLinks.join(' '):String(a?.crossLinks||'');
  const out=[];
  const seen=new Set();
  for(const m of raw.matchAll(/THC-ENC-(\d{3,})/g)){
    const id='THC-ENC-'+m[1];
    if(id===a.id||seen.has(id)||!registryById.has(id)) continue;
    seen.add(id);out.push(id);
  }
  return out.slice(0,8);
};
const relatedLessonsHtml=a=>{
  const ids=relatedIds(a);
  if(!ids.length) return '<p class="thc-empty-state">No directly mapped related lessons are available for this entry yet.</p>';
  return '<div class="thc-related-grid">'+ids.map(id=>`<a class="thc-related-card" href="/learn/encyclopedia/${id.toLowerCase()}/"><span>${esc(id)}</span><strong>${esc(registryTitleById.get(id)||id)}</strong></a>`).join('')+'</div>';
};
const reviewNoticeHtml=a=>{
  const independent=a?.reviewControl?.independentApproval===true;
  if(independent) return '<div class="thc-review-note"><strong>Evidence status:</strong> independently reviewed for this release.</div>';
  return '<div class="thc-review-note" role="note"><strong>Evidence status:</strong> publication authorized, with independent specialist review still recorded separately. Treat ranges and causal claims as context-dependent unless the cited evidence establishes otherwise.</div>';
};
const downloadsHtml=a=>{
  const approved=(Array.isArray(a?.downloads)?a.downloads:[]).filter(x=>x&&x.status==='approved'&&x.publicRoute);
  if(!approved.length) return '<section class="thc-downloads"><h2 id="downloads">Downloads</h2><p class="thc-empty-state">No lesson-specific download is approved for this release. Use browser print/save-to-PDF when you need an offline reading copy.</p></section>';
  return '<section class="thc-downloads"><h2 id="downloads">Downloads</h2><div class="thc-tools">'+approved.map(x=>`<a href="${esc(x.publicRoute)}" download>${esc(x.title||x.resourceId||'Download')}<span>↓</span></a>`).join('')+'</div></section>';
};
const records=a=>`<div class="thc-records">${(a||[]).map((x,i)=>{if(x&&typeof x==='object')return `<article><h3>${esc(x.field||`Record ${i+1}`)}</h3><p>${esc(x.requirement||x.description||'')}</p></article>`;return `<article><h3>Record ${i+1}</h3><p>${esc(x)}</p></article>`}).join('')}</div>`;
const misconceptionPairs=a=>(a||[]).map(x=>{if(x&&typeof x==='object'){return [String(x.claim||x.misconception||'').trim(),String(x.correction||x.explanation||'').trim()]};const s=String(x);const i=s.indexOf(':');return i>0?[s.slice(0,i).trim(),s.slice(i+1).trim()]:[s.trim(),''];}).filter(([claim])=>claim);
const paired=a=>`<div class="thc-paired">${a.map(([claim,correction])=>`<article><strong>Misconception:</strong> ${esc(claim)}${correction?`<br><strong>Correction:</strong> ${esc(correction)}`:''}</article>`).join('')}</div>`;
const evidence=a=>Array.isArray(a)?a:[a].filter(Boolean);
const sourceNotes=a=>Array.isArray(a)?a:[];
const practicalResources=a=>(Array.isArray(a?.practicalResources)?a.practicalResources:[]).filter(x=>x&&x.status==='approved'&&x.publicRoute);
const practicalResourcesHtml=a=>{const rows=practicalResources(a);return rows.length?`<section class="thc-practical"><h2>Practical resources</h2><div class="thc-tools">${rows.map(x=>`<a href="${esc(x.publicRoute)}">${esc(x.title||x.resourceId)}<span>→</span></a>`).join('')}</div></section>`:''};
const assessment=a=>effectiveLessonAssessment(a);
const answerRationales=a=>buildLessonAnswerRationalesV1(a);
const rationaleHtml=a=>{
  const pack=answerRationales(a);
  return `<div class="thc-rationales">${pack.rationales.map((r,i)=>`<details class="thc-rationale"><summary><strong>Answer rationale ${i+1}:</strong> ${esc(r.title)}</summary><div class="thc-rationale-body">${list(r.points)}</div></details>`).join('')}</div>`;
};
const workedExample=a=>learnerFacingWorkedExampleFor(a.id);
const workedExampleHtml=a=>{
  const ex=workedExample(a);
  if(!ex) return '';
  return `<details class="thc-example"><summary><strong>Worked example:</strong> ${esc(ex.title)}</summary><div class="thc-example-body"><p><strong>Scenario:</strong> ${esc(ex.scenario)}</p><h3>Reasoning path</h3>${list(ex.reasoningPath||[])}<h3>Evidence to collect</h3>${list(ex.evidenceToCollect||[])}<h3>Common weak answers</h3>${list(ex.weakAnswerPatterns||[])}<p><strong>Verification:</strong> ${esc(ex.verification)}</p><p><strong>Applicability boundary:</strong> ${esc(ex.boundary)}</p></div></details>`;
};

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const requestAttempts=Math.max(1,Number(process.env.WP_API_RETRY_ATTEMPTS||6));
const writeDelayMs=Math.max(0,Number(process.env.WP_WRITE_DELAY_MS||600));
const retryableStatus=status=>status===403||status===408||status===425||status===429||status>=500;
const canRetryRequest=(endpoint,method)=>method==='GET'||(method==='POST'&&/^\/(?:pages|media)\/\d+(?:\?|$)/.test(endpoint));
const retryDelayMs=(attempt,retryAfter)=>{
  const retryAfterSeconds=Number(retryAfter||0);
  if(Number.isFinite(retryAfterSeconds)&&retryAfterSeconds>0) return Math.min(60000,retryAfterSeconds*1000);
  return Math.min(30000,1500*(2**(attempt-1)));
};
async function request(endpoint,{method='GET',body}={}){
  const url=`${site}/wp-json/wp/v2${endpoint}`;
  const maxAttempts=canRetryRequest(endpoint,method)?requestAttempts:1;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    let res;
    try{
      res=await fetch(url,{method,headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60_000)});
    }catch(error){
      if(attempt===maxAttempts) throw new Error(`${method} ${endpoint} network failure after ${attempt} attempt(s): ${error?.message||error}`);
      const delay=retryDelayMs(attempt);
      console.warn(`${method} ${endpoint} network failure on attempt ${attempt}/${maxAttempts}; retrying in ${delay}ms: ${error?.message||error}`);
      await sleep(delay);
      continue;
    }
    const text=await res.text(); let parsed;
    try{parsed=text?JSON.parse(text):null;}catch{parsed=text;}
    if(res.ok) return {data:parsed,headers:res.headers};
    const detail=typeof parsed==='string'?parsed.slice(0,800):JSON.stringify(parsed).slice(0,800);
    if(!retryableStatus(res.status)||attempt===maxAttempts){
      throw new Error(`${method} ${endpoint} failed ${res.status} after ${attempt} attempt(s): ${detail}`);
    }
    const delay=retryDelayMs(attempt,res.headers.get('retry-after'));
    console.warn(`${method} ${endpoint} returned retryable ${res.status} on attempt ${attempt}/${maxAttempts}; retrying in ${delay}ms`);
    await sleep(delay);
  }
  throw new Error(`${method} ${endpoint} exhausted retry loop unexpectedly`);
}
async function wp(endpoint,opts){return (await request(endpoint,opts)).data;}
async function findPage(slug,parent=null){
  const rows=await wp(`/pages?slug=${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100`);
  return rows.find(x=>parent===null||Number(x.parent)===Number(parent))||null;
}
async function allChildren(parent){
  const out=[];
  for(let page=1;;page++){
    const rows=await wp(`/pages?parent=${parent}&context=edit&status=publish&per_page=100&page=${page}&orderby=slug&order=asc`);
    out.push(...rows);
    if(rows.length<100) break;
  }
  return out;
}

const backups=[];
const lessonVisualPattern=/<!-- THC-ENC-VISUAL:THC-ENC-\d{3,} START -->[\s\S]*?<!-- THC-ENC-VISUAL:THC-ENC-\d{3,} END -->/i;
function preserveExistingLessonVisual(slug,existing,content){
  if(!/^thc-enc-\d{3,}$/.test(String(slug||''))||!existing) return content;
  const raw=String(existing.content?.raw||'');
  const match=raw.match(lessonVisualPattern);
  if(!match||String(content).includes('THC-ENC-VISUAL:')) return content;
  const anchor='<!-- THC-ENC-VISUAL-ANCHOR -->';
  const idx=String(content).indexOf(anchor);
  if(idx<0) return content;
  return String(content).slice(0,idx)+match[0]+'\n'+String(content).slice(idx);
}
async function upsertPage({slug,title,parent,content,excerpt=''}){
  const existing=await findPage(slug,parent);
  if(existing) backups.push(existing);
  content=preserveExistingLessonVisual(slug,existing,content);
  const payload={slug,title,status:'publish',parent,content,excerpt,comment_status:'closed'};

  if(existing){
    const currentContent=String(existing.content?.raw??existing.content?.rendered??'');
    const currentTitle=String(existing.title?.raw??existing.title?.rendered??'').replace(/<[^>]+>/g,'').trim();
    const currentExcerpt=String(existing.excerpt?.raw??existing.excerpt?.rendered??'').replace(/<[^>]+>/g,'').trim();
    const desiredTitle=String(title).replace(/<[^>]+>/g,'').trim();
    const desiredExcerpt=String(excerpt).replace(/<[^>]+>/g,'').trim();
    const unchanged=
      currentContent===String(content) &&
      currentTitle===desiredTitle &&
      currentExcerpt===desiredExcerpt &&
      String(existing.status||'')==='publish' &&
      Number(existing.parent||0)===Number(parent||0) &&
      String(existing.comment_status||'closed')==='closed';

    if(unchanged){
      return existing;
    }
  }

  const result=existing?await wp(`/pages/${existing.id}`,{method:'POST',body:payload}):await wp('/pages',{method:'POST',body:payload});
  if(writeDelayMs>0) await sleep(writeDelayMs);
  return result;
}

const toolLinksFor=(a)=>{
  const n=Number(a.number||String(a.id||'').match(/(\d{3,})$/)?.[1]||0);
  const part=Number(registryById.get(a.id)?.part||Math.max(1,Math.ceil(n/20)));
  const links=[];
  const add=(label,href)=>{if(!links.some(x=>x.href===href))links.push({label,href})};
  if([3,5,7].includes(part)){add('Water Quality Lab','/water-quality-lab/');add('pH reference','/ph-meter/');add('EC / TDS reference','/tds-meter/')}
  if([5,6].includes(part)){add('VPD Chart','/vpd-chart/');add('PPFD / DLI Tool','/ppfd-chart/');add('Environmental Control','/environment-control/')}
  if([3,7].includes(part)){add('Irrigation & Dryback Lab','/dryback-lab/');add('Fertigation Lab','/fertigation-lab/');add('Root-Zone Temperature','/root-zone-temperature/')}
  if([1,4,10,11,12,14,15,16,17].includes(part))add('3D Plant Atlas','/atlas/');
  if([12,13].includes(part))add('Terpene Atlas','/terpene-atlas/');
  if([14,15,16,17].includes(part)){add('THC Grow Doc','/thc-grow-doc/');add('IPM Scout','/ipm-scout/')}
  if([18].includes(part))add('Dry & Cure Lab','/dry-cure-lab/');
  if([8,20].includes(part))add('Breeding & Pedigree Builder','/breeder-pedigree/');
  if([2,9,10,11,18,19].includes(part))add('Grow Cycle Planner','/grow-planner/');
  add('GrowLens','/growlens/');
  return links.slice(0,5);
};
const toolLinksHtml=(a)=>{
  const links=toolLinksFor(a);
  return links.length?'<div class="thc-tools">'+links.map(x=>`<a href="${esc(x.href)}">${esc(x.label)}<span>→</span></a>`).join('')+'</div>':'';
};
const lessonNav=(a)=>{
  const n=Number(a.number||String(a.id||'').match(/(\d{3,})$/)?.[1]||0);
  const prev=n>1?`<a href="/learn/encyclopedia/thc-enc-${String(n-1).padStart(3,'0')}/">← Previous</a>`:'<span></span>';
  const next=n<publicationCeiling?`<a href="/learn/encyclopedia/thc-enc-${String(n+1).padStart(3,'0')}/">Next →</a>`:'<a href="/learn/encyclopedia/">Browse all topics →</a>';
  return `<nav class="thc-lesson-nav" aria-label="Encyclopedia lesson navigation">${prev}${next}</nav>`;
};
const linkedCrossRefs=(values)=>relatedLessonsHtml({id:'',crossLinks:values});

const css=`<style>
.thc-ency{--green:#133c26;--leaf:#1d6b3a;--ink:#183524;--muted:#587064;--line:#dbe8df;--soft:#f4f8f5;--gold:#d6b85f;color:var(--ink);background:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.thc-ency *{box-sizing:border-box}.thc-ency a:focus-visible,.thc-ency summary:focus-visible{outline:3px solid #8fb83f;outline-offset:3px}.thc-wrap{max-width:1180px;margin:auto;padding:0 22px}.thc-breadcrumbs{font-size:.9rem;color:#d6e5dc;margin-bottom:18px}.thc-breadcrumbs a{color:#fff;text-underline-offset:3px}.thc-hero{background:radial-gradient(circle at 86% 15%,rgba(214,184,95,.2),transparent 28%),linear-gradient(135deg,#0b2918,#194c2d);color:#fff;padding:54px 0 44px}.thc-kicker{font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#d9ef82;font-size:.78rem}.thc-hero h1{max-width:18ch;font-size:clamp(2.2rem,5vw,4.4rem);line-height:1.02;margin:.22em 0 .35em;letter-spacing:-.03em;text-wrap:balance}.thc-hero p{max-width:780px;font-size:1.08rem;line-height:1.7;color:#e0ece4}.thc-nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.thc-btn{display:inline-block;padding:11px 16px;border-radius:999px;text-decoration:none!important;font-weight:900;background:#d6ec77;color:#15351f!important}.thc-btn.alt{background:#fff;color:#1b5b33!important;border:1px solid var(--line)}.thc-content{padding:36px 0 64px}.thc-layout{display:grid;grid-template-columns:minmax(0,760px) minmax(260px,320px);gap:42px;align-items:start;justify-content:space-between}.thc-main{min-width:0;overflow-wrap:anywhere}.thc-main>p,.thc-main>.thc-list,.thc-main>.thc-sources{max-width:72ch}.thc-main h2{scroll-margin-top:24px}.thc-aside{position:sticky;top:18px;display:grid;gap:14px}.thc-panel{background:var(--soft);border:1px solid var(--line);border-radius:18px;padding:18px}.thc-panel h2,.thc-panel h3{margin:.05rem 0 .65rem}.thc-panel p{margin:.35rem 0;color:var(--muted)}.thc-badge{display:inline-flex;background:#e9f4ec;border:1px solid #c9dfcf;color:#245a35;border-radius:999px;padding:7px 11px;font-weight:850;font-size:.8rem}.thc-content h2{font-size:clamp(1.35rem,2vw,1.7rem);line-height:1.2;margin:2.2rem 0 .8rem}.thc-content p,.thc-list,.thc-sources{line-height:1.78;color:#3d5a49}.thc-list,.thc-sources{padding-left:1.35rem}.thc-sources li+li{margin-top:.8rem}.thc-sources a{overflow-wrap:anywhere}.thc-terms,.thc-records,.thc-paired,.thc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.thc-terms>div,.thc-records article,.thc-paired article,.thc-card{background:var(--soft);border:1px solid var(--line);border-radius:16px;padding:17px}.thc-terms dt,.thc-records h3{font-weight:900;margin:0 0 5px}.thc-terms dt a{color:#174f2d;text-underline-offset:3px}.thc-terms dd{margin:0;color:var(--muted);line-height:1.55}.thc-records h3{font-size:1rem}.thc-records p{margin:0}.thc-note,.thc-review-note{background:#f2f7e8;border-left:5px solid #9ab93c;padding:18px 20px;margin:22px 0;border-radius:0 14px 14px 0}.thc-review-note{background:#f8f5e8;border-color:#d6b85f;line-height:1.65}.thc-empty-state{padding:16px 18px;background:#f7f9f7;border:1px dashed #bfd0c4;border-radius:14px;color:#4d6558}.thc-toc{margin:24px 0;padding:18px;border:1px solid var(--line);border-radius:16px;background:#fbfcfb}.thc-toc strong{display:block;margin-bottom:8px}.thc-toc ol{columns:2;gap:30px;margin:0;padding-left:1.25rem}.thc-toc li{break-inside:avoid;margin:.35rem 0}.thc-toc a{color:#1b6538;font-weight:750;text-underline-offset:3px}.thc-related-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.thc-related-card{display:grid;gap:5px;padding:14px 15px;border:1px solid var(--line);border-radius:14px;background:#fff;text-decoration:none!important;color:#183524}.thc-related-card span{font-size:.78rem;font-weight:900;letter-spacing:.05em;color:#1d6b3a}.thc-related-card:hover{border-color:#8db79a;background:#f8fbf8}.thc-example{margin:24px 0;border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden}.thc-example summary{cursor:pointer;padding:16px 18px;background:var(--soft);font-weight:850}.thc-example-body{padding:18px}.thc-rationales{display:grid;gap:10px;margin:14px 0 24px}.thc-rationale{border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}.thc-rationale summary{cursor:pointer;padding:14px 16px;background:#f8faf8;font-weight:800}.thc-rationale-body{padding:4px 16px 14px}.thc-example-body h3{margin:1.1rem 0 .45rem;font-size:1.05rem}.thc-objective{font-size:1.06rem}.thc-tools{display:grid;gap:8px}.thc-tools a{display:flex;justify-content:space-between;gap:10px;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:#fff;text-decoration:none!important;font-weight:850;color:#205a35}.thc-lesson-nav{display:flex;justify-content:space-between;gap:14px;margin:34px 0 0;padding-top:22px;border-top:1px solid var(--line)}.thc-lesson-nav a{font-weight:900;color:#1b6538;text-decoration:none}.thc-footerbar{background:#0e2e1b;color:#dbe8df;padding:32px 0}.thc-footerbar a{color:#d6ec77;font-weight:900}.thc-ency table{width:100%;border-collapse:collapse;display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}.thc-ency th,.thc-ency td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}.thc-ency th{background:var(--soft)}@media(max-width:900px){.thc-layout{grid-template-columns:1fr}.thc-aside{position:static;grid-template-columns:repeat(2,minmax(0,1fr))}.thc-main>p,.thc-main>.thc-list,.thc-main>.thc-sources{max-width:none}}@media(max-width:640px){.thc-wrap{padding:0 16px}.thc-hero{padding:38px 0 30px}.thc-content{padding-top:22px}.thc-aside,.thc-related-grid{grid-template-columns:1fr}.thc-terms,.thc-records,.thc-paired{grid-template-columns:1fr}.thc-toc ol{columns:1}.thc-lesson-nav{align-items:stretch;flex-direction:column}.thc-lesson-nav a{display:block;padding:12px 0}.thc-nav .thc-btn{width:100%;text-align:center}}@media(max-width:380px){.thc-wrap{padding:0 13px}.thc-hero h1{font-size:2rem}.thc-panel,.thc-note,.thc-review-note{padding:15px}}@media print{.thc-aside,.thc-nav,.thc-footerbar,.thc-lesson-nav{display:none!important}.thc-hero{background:#fff!important;color:#000!important;padding:0 0 18px}.thc-hero p,.thc-breadcrumbs,.thc-kicker{color:#222!important}.thc-content{padding:0}.thc-wrap{max-width:none;padding:0}.thc-layout{display:block}.thc-main{font-size:11pt}}
</style>`;

function articleHtml(a){
  const checks=assessment(a);
  const toc=[
    ['core-science','Core science'],
    ['cultivation','Why this matters in cultivation'],
    ['measure','Measure and record'],
    ['misconceptions','Common misconceptions'],
    ['evidence-limits','Evidence limits'],
    ['reasoning','Check your reasoning'],
    ['related','Related lessons'],
    ['sources','Sources and evidence'],
    ['downloads','Downloads']
  ];
  const tocHtml='<nav class="thc-toc" aria-label="On this page"><strong>On this page</strong><ol>'+toc.map(([id,label])=>`<li><a href="#${id}">${label}</a></li>`).join('')+'</ol></nav>';
  return `${css}${encyclopediaStructuredDataHtml(a,{site})}<main class="thc-ency" data-thc-encyclopedia-id="${esc(a.id)}" data-thc-source-fingerprint="${fingerprintOf(a)}"><section class="thc-hero"><div class="thc-wrap"><nav class="thc-breadcrumbs" aria-label="Breadcrumb"><a href="/learn/">Learning Center</a> / <a href="/learn/encyclopedia/">Encyclopedia</a> / <span aria-current="page">${esc(a.id)}</span></nav><div class="thc-kicker">THC Plant Science Encyclopedia · ${esc(a.id)}</div><h1>${esc(a.title)}</h1><p>${esc(a.objective)}</p><div class="thc-nav"><a class="thc-btn" href="/learn/encyclopedia/">Browse Encyclopedia</a><a class="thc-btn alt" href="/learn/search/?q=${encodeURIComponent(a.title)}">Search related material</a></div></div></section><section class="thc-content"><div class="thc-wrap"><div class="thc-layout"><article class="thc-main"><div class="thc-note thc-objective"><strong>Overview</strong><p>${esc(a.objective)}</p></div>${reviewNoticeHtml(a)}${tocHtml}<!-- THC-ENC-VISUAL-ANCHOR --><h2 id="core-science">Core science</h2>${a.coreScience.map(p=>`<p>${esc(p)}</p>`).join('')}<h2 id="cultivation">Why this matters in cultivation</h2>${list(a.cultivationRelevance||[])}<h2 id="measure">Measure and record</h2>${records(a.measureAndRecord)}<h2 id="misconceptions">Common misconceptions</h2>${paired(misconceptionPairs(a.misconceptions))}<h2 id="evidence-limits">Evidence limits and uncertainty</h2>${evidence(a.evidenceLimits).map(p=>`<p>${esc(p)}</p>`).join('')}<h2 id="reasoning">Check your reasoning</h2>${list(checks.prompts)}<div class="thc-note"><strong>Try first, then compare your reasoning</strong><p>${esc(checks.scoringIntent)} Open the rationales after you have written or discussed your own answer.</p></div>${rationaleHtml(a)}${workedExampleHtml(a)}${practicalResourcesHtml(a)}<h2 id="related">Related lessons</h2>${relatedLessonsHtml(a)}<h2 id="sources">Sources and evidence</h2>${sourceNotesHtml(a.sourceNotes)}${downloadsHtml(a)}${lessonNav(a)}</article><aside class="thc-aside" aria-label="Lesson reference"><section class="thc-panel"><span class="thc-badge">Educational reference</span><h2>Key concepts · Terms to know</h2>${terms(a.terms||a.termDefinitions||a.termsToKnow||[])}<p><a href="/learn/glossary/">Open the full glossary →</a></p></section><section class="thc-panel"><h2>Related tools</h2><p>Use measurements and records from the lesson with the connected THC tools.</p>${toolLinksHtml(a)}</section><section class="thc-panel"><h2>Reading guidance</h2><p>Record method, units, plant stage, location, timing and cultivar when comparing observations or measurements. Do not treat a starting range or association as a universal optimum or diagnosis.</p></section></aside></div></div></section><section class="thc-footerbar"><div class="thc-wrap">Continue with the <a href="/learn/encyclopedia/">Encyclopedia</a>, <a href="/learn/infographics/">visual library</a>, or <a href="/learn/">THC Learning Center</a>.</div></section></main>`;
}

const now=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(backupRoot,now);await mkdir(backupDir,{recursive:true});
const learn=await findPage('learn');if(!learn) throw new Error('Canonical /learn/ WordPress page not found.');
const encyclopedia=await findPage('encyclopedia',learn.id);
if(!encyclopedia) throw new Error('Canonical /learn/encyclopedia/ page not found. The Learning Center publisher owns and must create the searchable encyclopedia root before lesson publication.');
const published=[];
const publishConcurrency=Math.max(1,Math.min(6,Number(process.env.WP_PUBLISH_CONCURRENCY||1)));
let publishCursor=0;
async function publishWorker(){
  while(true){
    const index=publishCursor++;
    if(index>=lessons.length) return;
    const lesson=lessons[index];
    const slug=stableSlug(lesson.id);
    const page=await upsertPage({slug,title:`${lesson.id} — ${lesson.title}`,parent:encyclopedia.id,content:articleHtml(lesson),excerpt:lesson.objective});
    published[index]={id:lesson.id,title:lesson.title,slug,pageId:page.id,link:page.link,sourceFile:lesson._sourceFile,sourceFingerprint:fingerprintOf(lesson)};
  }
}
await Promise.all(Array.from({length:Math.min(publishConcurrency,lessons.length)},()=>publishWorker()));
const children=await allChildren(encyclopedia.id);
await writeFile(path.join(backupDir,'pre-write-pages.json'),JSON.stringify(backups,null,2));
const report={batch:batch.batch,source:batch.source,index:{pageId:encyclopedia.id,link:encyclopedia.link,rootOwner:'learning-center-publisher',rootPreserved:true,listedLessons:children.filter(p=>/^thc-enc-\d{3,}$/.test(p.slug)).length},published,backupDir,generatedAt:new Date().toISOString()};
await writeFile(path.join(backupDir,'encyclopedia-publication-report.json'),JSON.stringify(report,null,2));
await writeFile(path.join(backupRoot,'latest-backup-path.txt'),backupDir+'\n');
console.log(JSON.stringify(report,null,2));
