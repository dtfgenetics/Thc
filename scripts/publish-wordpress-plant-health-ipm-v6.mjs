import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT=process.cwd();
const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_PLANT_HEALTH_IPM_V6||'').toLowerCase()==='true';
const validateOnly=process.argv.includes('--validate-only');
const curriculumPath=process.env.PLANT_HEALTH_IPM_V6_PATH||'site/wordpress/education/plant-health-ipm-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-plant-health-ipm-v6';

const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const count=(text,needle)=>String(text).split(needle).length-1;
const fail=message=>{throw new Error(message)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const curriculum=JSON.parse(await readFile(join(ROOT,curriculumPath),'utf8'));
function validate(){
  if(curriculum?.schemaVersion!==1||curriculum?.id!=='plant-health-ipm-v6') fail('Invalid Plant Health & IPM V6 schema/id.');
  if(curriculum.topicId!=='plant-health-ipm'||curriculum.slug!=='ipm'||curriculum.route!=='/learn/ipm/') fail('Plant Health & IPM V6 route ownership is incorrect.');
  if(!curriculum.learningOutcome||curriculum.learningOutcome.length<120||!curriculum.evidenceBoundary||curriculum.evidenceBoundary.length<120) fail('Plant Health & IPM V6 metadata is too thin.');
  if(!Array.isArray(curriculum.sourceRefs)||curriculum.sourceRefs.length<4) fail('Plant Health & IPM V6 requires at least four evidence references.');
  const sourceIds=new Set(curriculum.sourceRefs.map(source=>source.id));
  if(sourceIds.size!==curriculum.sourceRefs.length) fail('Duplicate Plant Health & IPM source IDs.');
  for(const source of curriculum.sourceRefs) if(!source.id||!source.type||!source.citation||!source.supports) fail(`Incomplete source ${source.id||'unknown'}.`);
  if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) fail('Expected exactly 8 Plant Health & IPM chapters.');
  const chapterIds=new Set(); let lessons=0;
  for(const chapter of curriculum.chapters){
    if(!chapter.id||chapterIds.has(chapter.id)) fail(`Missing/duplicate chapter id ${chapter.id||'unknown'}.`);
    chapterIds.add(chapter.id);
    if(!chapter.title||!chapter.objective||!Array.isArray(chapter.lessons)||chapter.lessons.length!==4) fail(`${chapter.id}: expected four complete lessons.`);
    if(!Array.isArray(chapter.knowledgeChecks)||chapter.knowledgeChecks.length<4) fail(`${chapter.id}: knowledge checks incomplete.`);
    if(!Array.isArray(chapter.sourceIds)||!chapter.sourceIds.length) fail(`${chapter.id}: source mapping missing.`);
    for(const id of chapter.sourceIds) if(!sourceIds.has(id)) fail(`${chapter.id}: unknown source ${id}.`);
    for(const lesson of chapter.lessons){
      lessons+=1;
      if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!Array.isArray(lesson.concepts)||lesson.concepts.length<3) fail(`${chapter.id}: incomplete lesson.`);
      if(lesson.summary.length<90||lesson.cultivation.length<65||lesson.observe.length<55) fail(`${chapter.id}/${lesson.title}: lesson text too thin.`);
    }
  }
  if(lessons!==32) fail(`Expected 32 Plant Health & IPM lessons, found ${lessons}.`);
  if(!Array.isArray(curriculum.deepRoutes)||curriculum.deepRoutes.length<4) fail('Plant Health & IPM deep routes incomplete.');
  if(!Array.isArray(curriculum.visualTargets)||curriculum.visualTargets.length<10) fail('Plant Health & IPM visual target map incomplete.');
  const raw=JSON.stringify(curriculum).toLowerCase();
  for(const pattern of [/guaranteed cure/,/universal pest threshold/,/spray until runoff with/,/mix .* pesticide .* bleach/]) if(pattern.test(raw)) fail(`Forbidden plant-health claim matched ${pattern}.`);
  return {valid:true,id:curriculum.id,chapters:8,lessons:32,sources:curriculum.sourceRefs.length,visualTargets:curriculum.visualTargets.length};
}
const validation=validate();
if(validateOnly){console.log(JSON.stringify(validation,null,2));process.exit(0);}
if(!user||!pass) fail('WP_API_USERNAME and WP_API_PASSWORD are required for publication.');
if(!apply) fail('APPLY_PLANT_HEALTH_IPM_V6=true is required for publication.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Plant-Health-IPM-V6/1.0'};
async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=7;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text(); let body=text; try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<7){await sleep(attempt*1400);continue;}
      if(!response.ok) fail(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<7) await sleep(attempt*1400);}
  }
  throw last;
}
async function pageBySlug(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if(!Array.isArray(rows)||rows.length!==1) fail(`${slug}: expected exactly one WordPress page, found ${Array.isArray(rows)?rows.length:'invalid response'}.`);
  return rows[0];
}

const refCard=source=>`<article class="phi6-ref"><span>${esc(source.id)}</span><strong>${esc(source.citation)}</strong><p>${esc(source.supports)}</p>${source.pmcid?`<a href="https://pmc.ncbi.nlm.nih.gov/articles/${esc(source.pmcid)}/" target="_blank" rel="noopener noreferrer">Open reference ↗</a>`:''}</article>`;
const lessonHtml=(lesson,i)=>`<details class="phi6-lesson"><summary><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="phi6-body"><p>${esc(lesson.summary)}</p><div class="phi6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="phi6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
const chapterHtml=chapter=>`<section class="phi6-chapter" id="phi6-${esc(chapter.id)}" data-phi6-chapter="${esc(chapter.id)}"><div class="phi6-chapter-head"><div><p class="phi6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#phi6-top">Back to chapters ↑</a></div><div class="phi6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="phi6-bottom"><article><p class="phi6-kicker">Knowledge check</p><h4>Explain these before moving on</h4><ol>${chapter.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></article><article><p class="phi6-kicker">Evidence used in this chapter</p><div class="phi6-source-pills">${chapter.sourceIds.map(id=>`<span>${esc(id)}</span>`).join('')}</div></article></div></section>`;

function block(pageId){return `<!-- dtf-plant-health-ipm-v6:start --><style id="dtf-plant-health-ipm-v6-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}.phi6{--deep:#102116;--forest:#234b2f;--green:#447b4f;--gold:#d4b765;--cream:#f7f4e9;--paper:#fffdf8;--ink:#213629;--muted:#5d6b60;--line:#dbe3db;background:linear-gradient(180deg,#f7f4e9,#edf3eb);color:var(--ink);padding:70px 0 80px}.phi6 *{box-sizing:border-box}.phi6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.phi6-kicker{margin:0 0 8px;color:#806d32;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.phi6-intro{display:grid;grid-template-columns:1.1fr .9fr;gap:28px}.phi6 h2{margin:0;font-size:clamp(2.4rem,5vw,4.7rem);line-height:.96;letter-spacing:-.05em}.phi6 h3{margin:0;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1;letter-spacing:-.035em}.phi6 h4{margin:0 0 8px}.phi6 p{color:var(--muted);line-height:1.68}.phi6-lede{font-size:1.08rem}.phi6-boundary{padding:24px;border-radius:23px;background:linear-gradient(145deg,var(--deep),var(--forest));color:#fff}.phi6-boundary strong{display:block;color:var(--gold);font-size:1rem}.phi6-boundary p{color:#d7e2d8;margin:8px 0 0}.phi6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 54px}.phi6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.phi6-nav span{display:block;color:#806d32;font-size:.67rem;margin-bottom:3px}.phi6-chapter{padding:42px 0;border-top:1px solid var(--line)}.phi6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.phi6-chapter-head>div{max-width:820px}.phi6-chapter-head>a{white-space:nowrap;color:var(--green)!important;font-weight:900;text-decoration:none!important}.phi6-lessons{display:grid;gap:10px}.phi6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.phi6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.phi6-lesson summary::-webkit-details-marker{display:none}.phi6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-weight:950;font-size:1.3rem}.phi6-lesson[open] summary:after{content:'–'}.phi6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e8efe7;color:#526c55;font-size:.7rem;font-weight:950}.phi6-body{padding:0 19px 19px 64px}.phi6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.phi6-concepts span,.phi6-source-pills span{padding:5px 8px;border-radius:999px;background:#edf3ec;border:1px solid #d8e4d8;color:#4b624d;font-size:.71rem;font-weight:850}.phi6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.phi6-two article,.phi6-bottom>article{padding:15px;border-radius:14px;background:#f2f6f1;border:1px solid #dfe7df}.phi6-two article:last-child{background:#fff9ed;border-color:#e7dbc2}.phi6-two p{margin:0;font-size:.94rem}.phi6-bottom{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-top:15px}.phi6-bottom li{margin:7px 0;color:#485a4d;line-height:1.5}.phi6-source-pills{display:flex;gap:7px;flex-wrap:wrap}.phi6-next{margin-top:38px;padding:26px;border-radius:22px;background:linear-gradient(145deg,#142c1a,#294d31);color:#fff}.phi6-next p{color:#d1ddd2}.phi6-routes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.phi6-routes a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.phi6-visuals,.phi6-refs{margin-top:18px;padding:22px;border-radius:18px;background:#fff;border:1px solid var(--line)}.phi6-visuals ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:0;list-style:none}.phi6-visuals li{padding:10px;border-radius:11px;background:#f3f6ef;color:#485a49}.phi6-ref-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.phi6-ref{padding:14px;border-radius:14px;background:#f5f7f2;border:1px solid var(--line)}.phi6-ref>span{color:#806d32;font-size:.68rem;font-weight:950}.phi6-ref strong{display:block;margin:5px 0}.phi6-ref p{font-size:.9rem;margin:0 0 8px}.phi6-ref a{color:var(--green)!important;font-weight:900;text-decoration:none!important}
@media(max-width:920px){.phi6-intro,.phi6-bottom{grid-template-columns:1fr}.phi6-nav,.phi6-routes{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.phi6{padding:52px 0 60px}.phi6-wrap{width:min(100% - 26px,1180px)}.phi6-nav,.phi6-two,.phi6-routes,.phi6-visuals ul,.phi6-ref-grid{grid-template-columns:1fr}.phi6-chapter-head{align-items:flex-start;flex-direction:column}.phi6-body{padding:0 15px 17px}}
</style><section class="phi6" data-dtf-plant-health-ipm-v6="true" id="phi6-top"><div class="phi6-wrap"><div class="phi6-intro"><div><p class="phi6-kicker">Teaching Healthy Cultivation · Evidence-first plant health</p><h2>Plant Health & IPM, built around proof instead of symptom guessing.</h2><p class="phi6-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="phi6-boundary"><strong>Evidence boundary</strong><p>${esc(curriculum.evidenceBoundary)}</p></aside></div><nav class="phi6-nav">${curriculum.chapters.map(c=>`<a href="#phi6-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<section class="phi6-next"><p class="phi6-kicker">Continue deeper</p><h3>Connect plant health to environment, roots, measurement and diagnostic records.</h3><div class="phi6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section><section class="phi6-visuals"><p class="phi6-kicker">Visual study map</p><h3>High-value diagrams still to produce under the artwork QA gate.</h3><ul>${curriculum.visualTargets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="phi6-refs"><p class="phi6-kicker">Evidence references</p><h3>Core source set supporting this V6 curriculum.</h3><div class="phi6-ref-grid">${curriculum.sourceRefs.map(refCard).join('')}</div></section></div></section><!-- dtf-plant-health-ipm-v6:end -->`;}

const page=await pageBySlug('ipm');
const before=rendered(page.content);
const ownerMarker='data-dtf-topic="plant-health-ipm"';
const guideMarker='data-dtf-learning-v4="topic-plant-health-ipm"';
if(!before.includes(ownerMarker)) fail(`Plant Health & IPM is not the expected V3 subject owner (${ownerMarker} missing).`);
if(!before.includes(guideMarker)) fail(`Plant Health & IPM is missing V4 guided-learning ownership (${guideMarker} missing).`);
const clean=before.replace(/<!-- dtf-plant-health-ipm-v6:start -->[\s\S]*?<!-- dtf-plant-health-ipm-v6:end -->/g,'').trim();
const next=`${clean}\n${block(page.id)}`.trim();
if(count(next,'data-dtf-plant-health-ipm-v6="true"')!==1) fail('Planned Plant Health & IPM content must contain exactly one V6 marker.');
if(count(next,'data-phi6-chapter=')!==8) fail('Planned Plant Health & IPM content must contain exactly eight chapter markers.');
if(count(next,'class="phi6-lesson"')!==32) fail('Planned Plant Health & IPM content must contain exactly 32 lesson blocks.');

const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`plant-health-ipm-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});
await writeFile(join(backupDir,'page-before.json'),JSON.stringify(page,null,2));
await writeFile(join(backupDir,'before.html'),before);
await writeFile(join(backupDir,'planned.html'),next);

let changed=false;
try{
  if(before!==next){
    await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
    changed=true;
  }
  const check=await pageBySlug('ipm');
  const html=rendered(check.content);
  if(!html.includes(ownerMarker)||!html.includes(guideMarker)||!html.includes('data-dtf-plant-health-ipm-v6="true"')) fail('Post-write Plant Health & IPM ownership verification failed.');
  if(count(html,'data-phi6-chapter=')!==8||count(html,'class="phi6-lesson"')!==32) fail('Post-write Plant Health & IPM chapter/lesson count verification failed.');
  const report={ok:true,changed,pageId:page.id,route:curriculum.route,chapters:8,lessons:32,sources:curriculum.sourceRefs.length,visualTargets:curriculum.visualTargets.length,backupDir};
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(changed){
    try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:page.status||'publish'})});}
    catch(rollbackError){console.error(`ROLLBACK ERROR: ${rollbackError.message}`);}
  }
  throw error;
}
