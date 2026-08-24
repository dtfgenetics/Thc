import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT=process.cwd();
const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_GENETICS_EVIDENCE_V6||'').toLowerCase()==='true';
const validateOnly=process.argv.includes('--validate-only');
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-genetics-evidence-v6';

const specs=[
  {file:'site/wordpress/education/genetics-breeding-v6.json',id:'genetics-breeding-v6',topicId:'genetics-breeding',slug:'genetics-breeding',route:'/learn/genetics-breeding/',accent:'#715a91',hero:'Genetics & Breeding, taught as inheritance plus evidence.'},
  {file:'site/wordpress/education/evidence-measurement-v6.json',id:'evidence-measurement-v6',topicId:'evidence-measurement',slug:'research-methods',route:'/learn/research-methods/',accent:'#3c6d7b',hero:'Evidence & Measurement, taught as a reproducible system.'}
];
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const count=(text,needle)=>String(text).split(needle).length-1;
const fail=message=>{throw new Error(message)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function load(spec){const curriculum=JSON.parse(await readFile(join(ROOT,spec.file),'utf8'));return {spec,curriculum};}
const loaded=await Promise.all(specs.map(load));
function validateOne(spec,curriculum){
  if(curriculum?.schemaVersion!==1||curriculum?.id!==spec.id) fail(`${spec.id}: invalid schema/id.`);
  if(curriculum.topicId!==spec.topicId||curriculum.slug!==spec.slug||curriculum.route!==spec.route) fail(`${spec.id}: topic/route ownership mismatch.`);
  if(!curriculum.learningOutcome||curriculum.learningOutcome.length<120||!curriculum.evidenceBoundary||curriculum.evidenceBoundary.length<100) fail(`${spec.id}: metadata too thin.`);
  if(!Array.isArray(curriculum.sourceRefs)||curriculum.sourceRefs.length<4) fail(`${spec.id}: expected at least four evidence sources.`);
  const sourceIds=new Set(curriculum.sourceRefs.map(source=>source.id));
  if(sourceIds.size!==curriculum.sourceRefs.length) fail(`${spec.id}: duplicate source IDs.`);
  for(const source of curriculum.sourceRefs) if(!source.id||!source.type||!source.citation||!source.supports) fail(`${spec.id}: incomplete source ${source.id||'unknown'}.`);
  if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) fail(`${spec.id}: expected exactly eight chapters.`);
  const chapterIds=new Set();let lessons=0;
  for(const chapter of curriculum.chapters){
    if(!chapter.id||chapterIds.has(chapter.id)) fail(`${spec.id}: missing/duplicate chapter ${chapter.id||'unknown'}.`);
    chapterIds.add(chapter.id);
    if(!chapter.title||!chapter.objective||!Array.isArray(chapter.lessons)||chapter.lessons.length!==4) fail(`${spec.id}/${chapter.id}: expected four complete lessons.`);
    if(!Array.isArray(chapter.knowledgeChecks)||chapter.knowledgeChecks.length<4) fail(`${spec.id}/${chapter.id}: knowledge checks incomplete.`);
    if(!Array.isArray(chapter.sourceIds)||!chapter.sourceIds.length) fail(`${spec.id}/${chapter.id}: source mapping missing.`);
    for(const sourceId of chapter.sourceIds) if(!sourceIds.has(sourceId)) fail(`${spec.id}/${chapter.id}: unknown source ${sourceId}.`);
    for(const lesson of chapter.lessons){
      lessons+=1;
      if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!Array.isArray(lesson.concepts)||lesson.concepts.length<3) fail(`${spec.id}/${chapter.id}: incomplete lesson.`);
      if(lesson.summary.length<70||lesson.cultivation.length<55||lesson.observe.length<40) fail(`${spec.id}/${chapter.id}/${lesson.title}: lesson text too thin.`);
    }
  }
  if(lessons!==32) fail(`${spec.id}: expected 32 lessons, found ${lessons}.`);
  if(!Array.isArray(curriculum.deepRoutes)||curriculum.deepRoutes.length<4) fail(`${spec.id}: deep routes incomplete.`);
  if(!Array.isArray(curriculum.visualTargets)||curriculum.visualTargets.length<10) fail(`${spec.id}: visual target map incomplete.`);
  const raw=JSON.stringify(curriculum).toLowerCase();
  const forbidden=spec.topicId==='genetics-breeding'
    ? [/f5 means stable/,/guaranteed potency/,/sativa always/,/indica always/]
    : [/more decimals means more accurate/,/correlation proves causation/,/one photo proves/];
  for(const pattern of forbidden) if(pattern.test(raw)) fail(`${spec.id}: forbidden claim matched ${pattern}.`);
  return {id:spec.id,chapters:8,lessons:32,sources:curriculum.sourceRefs.length,visualTargets:curriculum.visualTargets.length};
}
const validations=loaded.map(({spec,curriculum})=>validateOne(spec,curriculum));
if(validateOnly){console.log(JSON.stringify({valid:true,subjects:validations,totals:{subjects:2,chapters:16,lessons:64,sources:validations.reduce((n,x)=>n+x.sources,0),visualTargets:20}},null,2));process.exit(0);}
if(!user||!pass) fail('WP_API_USERNAME and WP_API_PASSWORD are required for publication.');
if(!apply) fail('APPLY_GENETICS_EVIDENCE_V6=true is required for publication.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Genetics-Evidence-V6/1.0'};
async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=7;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<7){await sleep(attempt*1400);continue;}
      if(!response.ok) fail(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<7) await sleep(attempt*1400);}
  }
  throw last;
}
async function pageBySlug(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);if(!Array.isArray(rows)||rows.length!==1) fail(`${slug}: expected exactly one page, found ${Array.isArray(rows)?rows.length:'invalid response'}.`);return rows[0];}

function refCard(source){return `<article class="cgv6-ref"><span>${esc(source.id)}</span><strong>${esc(source.citation)}</strong><p>${esc(source.supports)}</p>${source.pmcid?`<a href="https://pmc.ncbi.nlm.nih.gov/articles/${esc(source.pmcid)}/" target="_blank" rel="noopener noreferrer">Open reference ↗</a>`:''}</article>`;}
const lessonHtml=(lesson,i)=>`<details class="cgv6-lesson"><summary><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="cgv6-body"><p>${esc(lesson.summary)}</p><div class="cgv6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="cgv6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
const chapterHtml=chapter=>`<section class="cgv6-chapter" id="cgv6-${esc(chapter.id)}" data-cgv6-chapter="${esc(chapter.id)}"><div class="cgv6-chapter-head"><div><p class="cgv6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#cgv6-top">Back to chapters ↑</a></div><div class="cgv6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="cgv6-bottom"><article><p class="cgv6-kicker">Knowledge check</p><ol>${chapter.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></article><article><p class="cgv6-kicker">Evidence used in this chapter</p><div class="cgv6-source-pills">${chapter.sourceIds.map(id=>`<span>${esc(id)}</span>`).join('')}</div></article></div></section>`;

function block(spec,curriculum,pageId){const dataMarker=`data-dtf-${spec.topicId}-v6="true"`;return `<!-- dtf-${spec.topicId}-v6:start --><style id="dtf-${spec.topicId}-v6-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}.cgv6{--accent:${spec.accent};--deep:#101e18;--forest:#244235;--gold:#d4b765;--cream:#f7f4e9;--paper:#fffdf8;--ink:#24352e;--muted:#5d6a63;--line:#dce3dd;background:linear-gradient(180deg,#f7f4e9,#eef2ed);color:var(--ink);padding:70px 0 80px}.cgv6 *{box-sizing:border-box}.cgv6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.cgv6-kicker{margin:0 0 8px;color:#806d32;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cgv6-intro{display:grid;grid-template-columns:1.1fr .9fr;gap:28px}.cgv6 h2{margin:0;font-size:clamp(2.4rem,5vw,4.7rem);line-height:.96;letter-spacing:-.05em}.cgv6 h3{margin:0;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1;letter-spacing:-.035em}.cgv6 h4{margin:0 0 8px}.cgv6 p{color:var(--muted);line-height:1.68}.cgv6-lede{font-size:1.08rem}.cgv6-boundary{padding:24px;border-radius:23px;background:linear-gradient(145deg,var(--deep),var(--forest));color:#fff;border-top:4px solid var(--accent)}.cgv6-boundary strong{display:block;color:var(--gold)}.cgv6-boundary p{color:#d8e0db;margin:8px 0 0}.cgv6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 54px}.cgv6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.cgv6-nav span{display:block;color:#806d32;font-size:.67rem;margin-bottom:3px}.cgv6-chapter{padding:42px 0;border-top:1px solid var(--line)}.cgv6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.cgv6-chapter-head>div{max-width:820px}.cgv6-chapter-head>a{white-space:nowrap;color:var(--accent)!important;font-weight:900;text-decoration:none!important}.cgv6-lessons{display:grid;gap:10px}.cgv6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.cgv6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.cgv6-lesson summary::-webkit-details-marker{display:none}.cgv6-lesson summary:after{content:'+';margin-left:auto;color:var(--accent);font-weight:950;font-size:1.3rem}.cgv6-lesson[open] summary:after{content:'–'}.cgv6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#edf0ed;color:#56665e;font-size:.7rem;font-weight:950}.cgv6-body{padding:0 19px 19px 64px}.cgv6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.cgv6-concepts span,.cgv6-source-pills span{padding:5px 8px;border-radius:999px;background:#edf2ee;border:1px solid #dbe3dd;color:#4f6057;font-size:.71rem;font-weight:850}.cgv6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cgv6-two article,.cgv6-bottom>article{padding:15px;border-radius:14px;background:#f2f5f2;border:1px solid #dfe5e0}.cgv6-two article:last-child{background:#fff9ed;border-color:#e7dbc2}.cgv6-two p{margin:0;font-size:.94rem}.cgv6-bottom{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-top:15px}.cgv6-bottom li{margin:7px 0;color:#48584f;line-height:1.5}.cgv6-source-pills{display:flex;gap:7px;flex-wrap:wrap}.cgv6-next{margin-top:38px;padding:26px;border-radius:22px;background:linear-gradient(145deg,#14291f,#294438);color:#fff}.cgv6-next p{color:#d1ddd5}.cgv6-routes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.cgv6-routes a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.cgv6-visuals,.cgv6-refs{margin-top:18px;padding:22px;border-radius:18px;background:#fff;border:1px solid var(--line)}.cgv6-visuals ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:0;list-style:none}.cgv6-visuals li{padding:10px;border-radius:11px;background:#f3f5f2;color:#48584f}.cgv6-ref-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cgv6-ref{padding:14px;border-radius:14px;background:#f5f7f4;border:1px solid var(--line)}.cgv6-ref>span{color:#806d32;font-size:.68rem;font-weight:950}.cgv6-ref strong{display:block;margin:5px 0}.cgv6-ref p{font-size:.9rem;margin:0 0 8px}.cgv6-ref a{color:var(--accent)!important;font-weight:900;text-decoration:none!important}
@media(max-width:920px){.cgv6-intro,.cgv6-bottom{grid-template-columns:1fr}.cgv6-nav,.cgv6-routes{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.cgv6{padding:52px 0 60px}.cgv6-wrap{width:min(100% - 26px,1180px)}.cgv6-nav,.cgv6-two,.cgv6-routes,.cgv6-visuals ul,.cgv6-ref-grid{grid-template-columns:1fr}.cgv6-chapter-head{align-items:flex-start;flex-direction:column}.cgv6-body{padding:0 15px 17px}}
</style><section class="cgv6" ${dataMarker} id="cgv6-top"><div class="cgv6-wrap"><div class="cgv6-intro"><div><p class="cgv6-kicker">Teaching Healthy Cultivation · V6 evidence curriculum</p><h2>${esc(spec.hero)}</h2><p class="cgv6-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="cgv6-boundary"><strong>Evidence boundary</strong><p>${esc(curriculum.evidenceBoundary)}</p></aside></div><nav class="cgv6-nav">${curriculum.chapters.map(c=>`<a href="#cgv6-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<section class="cgv6-next"><p class="cgv6-kicker">Continue deeper</p><h3>Connect this subject to the rest of the learning system.</h3><div class="cgv6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section><section class="cgv6-visuals"><p class="cgv6-kicker">Visual study map</p><h3>High-value diagrams still to produce under the artwork QA gate.</h3><ul>${curriculum.visualTargets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="cgv6-refs"><p class="cgv6-kicker">Evidence references</p><h3>Core source set supporting this V6 curriculum.</h3><div class="cgv6-ref-grid">${curriculum.sourceRefs.map(refCard).join('')}</div></section></div></section><!-- dtf-${spec.topicId}-v6:end -->`;}

function stripOwnBlock(spec,html){const start=`<!-- dtf-${spec.topicId}-v6:start -->`;const end=`<!-- dtf-${spec.topicId}-v6:end -->`;const a=html.indexOf(start);if(a<0) return html.trim();const b=html.indexOf(end,a);if(b<0) fail(`${spec.id}: start marker exists without end marker.`);return `${html.slice(0,a)}${html.slice(b+end.length)}`.trim();}
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`genetics-evidence-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});
const plans=[];
for(const entry of loaded){
  const {spec,curriculum}=entry;
  const page=await pageBySlug(spec.slug);
  const before=rendered(page.content);
  const ownerMarker=`data-dtf-topic="${spec.topicId}"`;
  const guideMarker=`data-dtf-learning-v4="topic-${spec.topicId}"`;
  if(!before.includes(ownerMarker)) fail(`${spec.id}: page is not the expected V3 subject owner (${ownerMarker} missing).`);
  if(!before.includes(guideMarker)) fail(`${spec.id}: page is missing V4 guided-learning ownership (${guideMarker} missing).`);
  const clean=stripOwnBlock(spec,before);
  const next=`${clean}\n${block(spec,curriculum,page.id)}`.trim();
  const dataMarker=`data-dtf-${spec.topicId}-v6="true"`;
  if(count(next,dataMarker)!==1) fail(`${spec.id}: expected exactly one V6 marker in planned content.`);
  if(count(next,'data-cgv6-chapter=')!==8) fail(`${spec.id}: planned content does not contain exactly eight chapter markers.`);
  if(count(next,'class="cgv6-lesson"')!==32) fail(`${spec.id}: planned content does not contain exactly 32 lesson blocks.`);
  await writeFile(join(backupDir,`${spec.slug}-page.json`),JSON.stringify(page,null,2));
  await writeFile(join(backupDir,`${spec.slug}-before.html`),before);
  await writeFile(join(backupDir,`${spec.slug}-planned.html`),next);
  plans.push({spec,curriculum,page,before,next,ownerMarker,guideMarker,dataMarker});
}
const updated=[];
try{
  for(const plan of plans){
    if(plan.before!==plan.next){await request(`/wp-json/wp/v2/pages/${plan.page.id}`,{method:'POST',body:JSON.stringify({content:plan.next,status:'publish'})});updated.push(plan);}
  }
  for(const plan of plans){
    const check=await pageBySlug(plan.spec.slug);const html=rendered(check.content);
    if(!html.includes(plan.ownerMarker)||!html.includes(plan.guideMarker)||!html.includes(plan.dataMarker)) fail(`${plan.spec.id}: post-write ownership verification failed.`);
    if(count(html,'data-cgv6-chapter=')!==8||count(html,'class="cgv6-lesson"')!==32) fail(`${plan.spec.id}: post-write chapter/lesson count verification failed.`);
  }
}catch(error){
  for(const plan of [...updated].reverse()){
    try{await request(`/wp-json/wp/v2/pages/${plan.page.id}`,{method:'POST',body:JSON.stringify({content:plan.before,status:plan.page.status||'publish'})});}
    catch(rollbackError){console.error(`ROLLBACK ERROR ${plan.spec.id}: ${rollbackError.message}`);}
  }
  throw error;
}
const report={ok:true,subjects:plans.map(plan=>({id:plan.spec.id,route:plan.spec.route,pageId:plan.page.id,changed:plan.before!==plan.next,chapters:8,lessons:32,sources:plan.curriculum.sourceRefs.length,visualTargets:plan.curriculum.visualTargets.length})),totals:{subjects:2,chapters:16,lessons:64,sources:plans.reduce((n,p)=>n+p.curriculum.sourceRefs.length,0),visualTargets:20},backupDir};
await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
