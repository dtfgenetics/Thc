import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_ENVIRONMENT_VPD_V6||'').toLowerCase()==='true';
const curriculumPath=process.env.ENVIRONMENT_VPD_V6_PATH||'site/wordpress/education/environment-vpd-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-environment-vpd-v6-final';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`environment-vpd-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Environment-VPD-V6-Final/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1600);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<8) await sleep(attempt*1600);}
  }
  throw last;
}

async function pageBySlug(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected exactly one page, found ${Array.isArray(rows)?rows.length:'invalid response'}.`);
  return rows[0];
}

const curriculum=JSON.parse(await readFile(curriculumPath,'utf8'));
if(curriculum?.schemaVersion!==1||curriculum?.id!=='environment-vpd-v6') throw new Error('Invalid Environment & VPD V6 curriculum.');
if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) throw new Error('Expected exactly 8 Environment & VPD chapters.');
const lessonCount=curriculum.chapters.reduce((n,c)=>n+(c.lessons||[]).length,0);
if(lessonCount!==32) throw new Error(`Expected 32 Environment & VPD lessons, found ${lessonCount}.`);
const chapterIds=curriculum.chapters.map(c=>c.id);
if(new Set(chapterIds).size!==8) throw new Error('Environment & VPD chapter IDs are not unique.');
for(const chapter of curriculum.chapters){
  if(!chapter.title||!chapter.objective||!(chapter.lessons||[]).length||!(chapter.knowledgeChecks||[]).length) throw new Error(`${chapter.id}: incomplete chapter.`);
  if(chapter.lessons.length!==4) throw new Error(`${chapter.id}: expected exactly 4 focused lessons.`);
  for(const lesson of chapter.lessons) if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!(lesson.concepts||[]).length) throw new Error(`${chapter.id}: incomplete lesson.`);
}

const referenceIds=[...new Set(curriculum.chapters.flatMap(c=>c.encyclopediaIds||[]))];
const referenceTitles=new Map();
for(let n=81;n<=100;n+=1){
  const id=`THC-ENC-${String(n).padStart(3,'0')}`;
  try{
    const item=JSON.parse(await readFile(`content/encyclopedia/volume-05/lessons/thc-enc-${String(n).padStart(3,'0')}.json`,'utf8'));
    if(item.id!==id||!item.title||!item.objective) throw new Error(`${id}: incomplete Volume 5 source.`);
    referenceTitles.set(id,item.title);
  }catch(error){throw new Error(`Environment Volume 5 source unavailable for ${id}: ${error.message}`);}
}
for(const id of referenceIds){
  const n=Number(id.slice(-3));
  if(n<81||n>100||!referenceTitles.has(id)) throw new Error(`Environment V6 may only link controlled Volume 5 IDs 081-100. Invalid: ${id}`);
}

const publicRefs=new Set();
for(const id of referenceIds){
  try{
    const rows=await request(`/wp-json/wp/v2/pages?slug=${id.toLowerCase()}&context=edit&per_page=5`);
    if(Array.isArray(rows)&&rows.some(x=>x.status==='publish')) publicRefs.add(id);
  }catch{}
}

const refCard=id=>`<a class="ev6-ref" href="${publicRefs.has(id)?`/learn/encyclopedia/${id.toLowerCase()}/`:'/learn/encyclopedia/'}"><span>${esc(id)}</span><strong>${esc(referenceTitles.get(id)||id)}</strong></a>`;
const lessonHtml=(lesson,i)=>`<details class="ev6-lesson"><summary><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="ev6-body"><p>${esc(lesson.summary)}</p><div class="ev6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="ev6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
const chapterHtml=chapter=>`<section class="ev6-chapter" id="ev6-${esc(chapter.id)}" data-ev6-chapter="${esc(chapter.id)}"><div class="ev6-chapter-head"><div><p class="ev6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#ev6-top">Back to chapters ↑</a></div><div class="ev6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="ev6-bottom"><article><p class="ev6-kicker">Knowledge check</p><h4>Explain these before moving on</h4><ol>${chapter.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></article><article><p class="ev6-kicker">Controlled deep reference</p><h4>Related reviewed environmental lessons</h4><div class="ev6-refs">${(chapter.encyclopediaIds||[]).map(refCard).join('')}</div></article></div></section>`;

function block(pageId){return `<!-- dtf-environment-vpd-v6:start --><style id="dtf-environment-vpd-v6-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}
.ev6{--deep:#071b16;--forest:#103b2e;--green:#1f704f;--gold:#d5b96b;--cream:#f7f4ea;--paper:#fffdf8;--ink:#143027;--muted:#52665e;--line:#d7e2dc;background:var(--cream);color:var(--ink);padding:70px 0 78px}.ev6 *{box-sizing:border-box}.ev6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.ev6-kicker{margin:0 0 8px;color:#78672f;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.ev6-intro{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:start}.ev6 h2{margin:0;font-size:clamp(2.35rem,5vw,4.6rem);line-height:.96;letter-spacing:-.05em}.ev6 h3{margin:0;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1;letter-spacing:-.035em}.ev6 h4{margin:0 0 8px}.ev6 p{color:var(--muted);line-height:1.68}.ev6-lede{font-size:1.08rem}.ev6-stats{padding:24px;border-radius:23px;background:linear-gradient(145deg,var(--deep),var(--forest));color:#fff;border:1px solid #285445}.ev6-stats strong{display:block;color:var(--gold);font-size:2.35rem;line-height:1}.ev6-stats p{color:#d0ded8;margin:7px 0 16px}.ev6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 55px}.ev6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.ev6-nav span{display:block;color:#78672f;font-size:.67rem;margin-bottom:3px}.ev6-chapter{padding:42px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.ev6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.ev6-chapter-head>div{max-width:820px}.ev6-chapter-head>a{white-space:nowrap;color:var(--green)!important;font-weight:900;text-decoration:none!important}.ev6-lessons{display:grid;gap:10px}.ev6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.ev6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.ev6-lesson summary::-webkit-details-marker{display:none}.ev6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-weight:950;font-size:1.3rem}.ev6-lesson[open] summary:after{content:'–'}.ev6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e7f0eb;color:#3b6754;font-size:.7rem;font-weight:950}.ev6-body{padding:0 19px 19px 64px}.ev6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.ev6-concepts span{padding:5px 8px;border-radius:999px;background:#edf3ef;border:1px solid #d8e3dc;color:#416053;font-size:.71rem;font-weight:850}.ev6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ev6-two article,.ev6-bottom>article{padding:15px;border-radius:14px;background:#f1f5f2;border:1px solid #dbe5df}.ev6-two article:last-child{background:#fff9ef;border-color:#e8dcc4}.ev6-two p{margin:0;font-size:.94rem}.ev6-bottom{display:grid;grid-template-columns:.82fr 1.18fr;gap:14px;margin-top:15px}.ev6-bottom ol{margin:10px 0 0;padding-left:1.2rem}.ev6-bottom li{margin:7px 0;color:#42594f;line-height:1.5}.ev6-refs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.ev6-ref{display:block;padding:10px 11px;border-radius:11px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important}.ev6-ref span{display:block;color:#78672f;font-size:.64rem;font-weight:950}.ev6-ref strong{display:block;margin-top:3px;font-size:.87rem;line-height:1.25}.ev6-deep{margin-top:40px;padding:26px;border-radius:22px;background:linear-gradient(145deg,#0c2c21,#123d2d);color:#fff}.ev6-deep p{color:#c9d8d1}.ev6-routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.ev6-routes a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.ev6-visuals{margin-top:18px;padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}.ev6-visuals ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:11px 0 0;padding:0;list-style:none}.ev6-visuals li{padding:10px;border-radius:11px;background:#f1f5f2;color:#43594f;line-height:1.4}
@media(max-width:920px){.ev6-intro,.ev6-bottom{grid-template-columns:1fr}.ev6-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.ev6-routes,.ev6-visuals ul{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.ev6{padding:52px 0 60px}.ev6-wrap{width:min(100% - 26px,1180px)}.ev6-nav,.ev6-two,.ev6-refs,.ev6-routes,.ev6-visuals ul{grid-template-columns:1fr}.ev6-chapter-head{align-items:flex-start;flex-direction:column}.ev6-body{padding:0 15px 17px}.ev6-lesson summary{padding:15px}}
</style><section class="ev6" data-dtf-environment-vpd-v6="true" id="ev6-top"><div class="ev6-wrap"><div class="ev6-intro"><div><p class="ev6-kicker">Teaching Healthy Cultivation · Measurement-first environmental science</p><h2>Environment & VPD, built around what the leaf actually experiences.</h2><p class="ev6-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="ev6-stats"><strong>8</strong><p>connected chapters</p><strong>32</strong><p>focused lessons</p><strong>${publicRefs.size}</strong><p>controlled environmental encyclopedia pages linked directly</p></aside></div><nav class="ev6-nav" aria-label="Environment and VPD chapters">${curriculum.chapters.map(c=>`<a href="#ev6-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<section class="ev6-deep"><p class="ev6-kicker">Continue deeper</p><h3>Connect climate measurements to plant biology, light, roots and records.</h3><p>This curriculum intentionally avoids presenting one cannabis temperature-RH-VPD chart as settled science. Use measured tissue conditions, root-zone supply, facility capability, stage, genotype and repeated crop response to qualify control envelopes.</p><div class="ev6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section><section class="ev6-visuals"><p class="ev6-kicker">Visual study map</p><h3>Core diagrams this section should teach with.</h3><ul>${curriculum.visualTargets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div></section><!-- dtf-environment-vpd-v6:end -->`;}

const page=await pageBySlug('environment-vpd');
const before=rendered(page.content);
if(!before.includes('data-dtf-topic="environment-vpd"')) throw new Error('Environment & VPD is not the expected V3 subject owner.');
if(!before.includes('data-dtf-learning-v4="topic-environment-vpd"')) throw new Error('Environment & VPD is missing its V4 guided-learning layer.');
const clean=before.replace(/<!-- dtf-environment-vpd-v6:start -->[\s\S]*?<!-- dtf-environment-vpd-v6:end -->/g,'').trim();
const next=`${clean}\n${block(page.id)}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('environment-vpd')).content);
  if(!edit.includes('data-dtf-environment-vpd-v6="true"')) throw new Error('Edit-context Environment & VPD V6 marker missing.');
  if((edit.match(/data-ev6-chapter=/g)||[]).length!==8) throw new Error('Edit-context chapter count is not 8.');
  if((edit.match(/class="ev6-lesson"/g)||[]).length!==32) throw new Error('Edit-context lesson count is not 32.');
  for(const id of chapterIds) if(!edit.includes(`data-ev6-chapter="${id}"`)) throw new Error(`Edit-context chapter ID missing: ${id}`);

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}/learn/environment-vpd/?dtf_ev6_final=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Environment-VPD-V6-Final-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
      visitor=await response.text();
      if(response.ok&&visitor.includes('data-dtf-environment-vpd-v6="true"')){ok=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor Environment & VPD V6 marker missing.');
  if((visitor.match(/data-ev6-chapter=/g)||[]).length!==8) throw new Error('Visitor chapter count is not 8.');
  if((visitor.match(/class="ev6-lesson"/g)||[]).length!==32) throw new Error('Visitor lesson count is not 32.');
  for(const id of chapterIds) if(!visitor.includes(`data-ev6-chapter="${id}"`)) throw new Error(`Visitor chapter ID missing: ${id}`);
  if(!visitor.includes('data-dtf-topic="environment-vpd"')||!visitor.includes('data-dtf-learning-v4="topic-environment-vpd"')) throw new Error('Visitor page lost V3 or V4 owner markers.');

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/environment-vpd/',chapters:8,lessons:32,visualTargets:curriculum.visualTargets.length,controlledReferenceIds:referenceIds.length,publishedReferencePages:publicRefs.size,visitorVerified:true,backupDir};
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  await writeFile(join(backupDir,'error.txt'),`${error?.stack||error}\n`);
  if(wrote){
    try{
      await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});
      await writeFile(join(backupDir,'rollback.txt'),'Rollback restored the prior Environment & VPD page content.\n');
    }catch(rollbackError){await writeFile(join(backupDir,'rollback-error.txt'),`${rollbackError?.stack||rollbackError}\n`);}
  }
  throw error;
}
