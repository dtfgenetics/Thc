import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_LIGHTING_V6||'').toLowerCase()==='true';
const curriculumPath=process.env.LIGHTING_V6_PATH||'site/wordpress/education/lighting-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-lighting-v6-final';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`lighting-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Lighting-V6-Final/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
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
async function publicHtml(path){
  let last='';
  for(let attempt=1;attempt<=8;attempt+=1){
    const joiner=path.includes('?')?'&':'?';
    const response=await fetch(`${site}${path}${joiner}dtf_li6=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(45000),headers:{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Lighting-V6-Visitor/1.0'}});
    last=await response.text();
    if(response.ok&&last.includes('data-dtf-lighting-v6="true"')) return last;
    await sleep(attempt*2200);
  }
  return last;
}

const curriculum=JSON.parse(await readFile(curriculumPath,'utf8'));
if(curriculum?.schemaVersion!==1||curriculum?.id!=='lighting-v6') throw new Error('Invalid Lighting V6 curriculum.');
if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) throw new Error('Expected exactly 8 Lighting chapters.');
const lessonCount=curriculum.chapters.reduce((n,c)=>n+(c.lessons||[]).length,0);
if(lessonCount!==32) throw new Error(`Expected 32 Lighting lessons, found ${lessonCount}.`);
const chapterIds=curriculum.chapters.map(c=>c.id);
if(new Set(chapterIds).size!==8) throw new Error('Lighting chapter IDs are not unique.');
for(const chapter of curriculum.chapters){
  if(!chapter.title||!chapter.objective||chapter.lessons?.length!==4||!(chapter.knowledgeChecks||[]).length) throw new Error(`${chapter.id}: incomplete chapter.`);
  for(const lesson of chapter.lessons) if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!(lesson.concepts||[]).length) throw new Error(`${chapter.id}: incomplete lesson.`);
}
const referenceIds=[...new Set(curriculum.chapters.flatMap(c=>c.encyclopediaIds||[]))];
const referenceTitles=new Map();
for(let n=101;n<=120;n+=1){
  const id=`THC-ENC-${String(n).padStart(3,'0')}`;
  try{
    const item=JSON.parse(await readFile(`content/encyclopedia/volume-06/lessons/thc-enc-${String(n).padStart(3,'0')}.json`,'utf8'));
    if(item.id!==id||!item.title||!item.objective) throw new Error(`${id}: incomplete Volume 6 source.`);
    referenceTitles.set(id,item.title);
  }catch(error){throw new Error(`Lighting Volume 6 source unavailable for ${id}: ${error.message}`);}
}
for(const id of referenceIds){
  const n=Number(id.slice(-3));
  if(n<101||n>120||!referenceTitles.has(id)) throw new Error(`Lighting V6 may only link controlled Volume 6 IDs 101-120. Invalid: ${id}`);
}
const publicRefs=new Set();
for(const id of referenceIds){
  try{
    const rows=await request(`/wp-json/wp/v2/pages?slug=${id.toLowerCase()}&context=edit&per_page=5`);
    if(Array.isArray(rows)&&rows.some(x=>x.status==='publish')) publicRefs.add(id);
  }catch{}
}

const refCard=id=>`<a class="li6-ref" href="${publicRefs.has(id)?`/learn/encyclopedia/${id.toLowerCase()}/`:'/learn/encyclopedia/'}"><span>${esc(id)}</span><strong>${esc(referenceTitles.get(id)||id)}</strong></a>`;
const lessonHtml=(lesson,i)=>`<details class="li6-lesson"><summary><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="li6-body"><p>${esc(lesson.summary)}</p><div class="li6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="li6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
const chapterHtml=chapter=>`<section class="li6-chapter" id="li6-${esc(chapter.id)}" data-li6-chapter="${esc(chapter.id)}"><div class="li6-chapter-head"><div><p class="li6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#li6-top">Back to chapters ↑</a></div><div class="li6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="li6-bottom"><article><p class="li6-kicker">Knowledge check</p><h4>Explain these before moving on</h4><ol>${chapter.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></article><article><p class="li6-kicker">Controlled deep reference</p><h4>Related reviewed lighting lessons</h4><div class="li6-refs">${(chapter.encyclopediaIds||[]).map(refCard).join('')}</div></article></div></section>`;

function block(pageId){return `<!-- dtf-lighting-v6:start --><style id="dtf-lighting-v6-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}.li6{--deep:#071812;--green:#175c40;--lime:#91bd5a;--gold:#d6b866;--cream:#f8f5ea;--paper:#fffef9;--ink:#173027;--muted:#53675e;--line:#d8e2dc;background:var(--cream);color:var(--ink);padding:70px 0 78px}.li6 *{box-sizing:border-box}.li6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.li6-kicker{margin:0 0 8px;color:#76652d;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.li6-intro{display:grid;grid-template-columns:1.12fr .88fr;gap:28px;align-items:start}.li6 h2{margin:0;font-size:clamp(2.35rem,5vw,4.7rem);line-height:.96;letter-spacing:-.05em}.li6 h3{margin:0;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1;letter-spacing:-.035em}.li6 h4{margin:0 0 8px}.li6 p{color:var(--muted);line-height:1.68}.li6-lede{font-size:1.08rem}.li6-stats{padding:24px;border-radius:23px;background:linear-gradient(145deg,#071812,#133b2b);color:#fff;border:1px solid #2b5444}.li6-stats strong{display:block;color:var(--gold);font-size:2.35rem;line-height:1}.li6-stats p{color:#d1dfd8;margin:7px 0 16px}.li6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 55px}.li6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.li6-nav span{display:block;color:#76652d;font-size:.67rem;margin-bottom:3px}.li6-chapter{padding:42px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.li6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.li6-chapter-head>div{max-width:820px}.li6-chapter-head>a{white-space:nowrap;color:var(--green)!important;font-weight:900;text-decoration:none!important}.li6-lessons{display:grid;gap:10px}.li6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.li6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.li6-lesson summary::-webkit-details-marker{display:none}.li6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-weight:950;font-size:1.3rem}.li6-lesson[open] summary:after{content:'–'}.li6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#eaf1e9;color:#40664f;font-size:.7rem;font-weight:950}.li6-body{padding:0 19px 19px 64px}.li6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.li6-concepts span{padding:5px 8px;border-radius:999px;background:#edf3ef;border:1px solid #d8e3dc;color:#416053;font-size:.71rem;font-weight:850}.li6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.li6-two article,.li6-bottom>article{padding:15px;border-radius:14px;background:#f1f5f2;border:1px solid #dbe5df}.li6-two article:last-child{background:#fff9ed;border-color:#eadcc1}.li6-two p{margin:0;font-size:.94rem}.li6-bottom{display:grid;grid-template-columns:.82fr 1.18fr;gap:14px;margin-top:15px}.li6-bottom ol{margin:10px 0 0;padding-left:1.2rem}.li6-bottom li{margin:7px 0;color:#42594f;line-height:1.5}.li6-refs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.li6-ref{display:block;padding:10px 11px;border-radius:11px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important}.li6-ref span{display:block;color:#76652d;font-size:.64rem;font-weight:950}.li6-ref strong{display:block;margin-top:3px;font-size:.87rem;line-height:1.25}.li6-deep{margin-top:40px;padding:26px;border-radius:22px;background:linear-gradient(145deg,#091e17,#153d2d);color:#fff}.li6-deep p{color:#cbd9d2}.li6-routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.li6-routes a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.li6-visuals{margin-top:18px;padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}.li6-visuals ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:11px 0 0;padding:0;list-style:none}.li6-visuals li{padding:10px;border-radius:11px;background:#f1f5f2;color:#43594f;line-height:1.4}
@media(max-width:920px){.li6-intro,.li6-bottom{grid-template-columns:1fr}.li6-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.li6-routes,.li6-visuals ul{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.li6{padding:52px 0 60px}.li6-wrap{width:min(100% - 26px,1180px)}.li6-nav,.li6-two,.li6-refs,.li6-routes,.li6-visuals ul{grid-template-columns:1fr}.li6-chapter-head{align-items:flex-start;flex-direction:column}.li6-body{padding:0 15px 17px}.li6-lesson summary{padding:15px}}
</style><section class="li6" data-dtf-lighting-v6="true" id="li6-top"><div class="li6-wrap"><div class="li6-intro"><div><p class="li6-kicker">Teaching Healthy Cultivation · Measurement-first plant lighting</p><h2>Lighting, measured from photons to canopy response.</h2><p class="li6-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="li6-stats"><strong>8</strong><p>connected chapters</p><strong>32</strong><p>focused lessons</p><strong>${publicRefs.size}</strong><p>controlled Lighting encyclopedia pages linked directly</p></aside></div><nav class="li6-nav" aria-label="Lighting chapters">${curriculum.chapters.map(c=>`<a href="#li6-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<section class="li6-deep"><p class="li6-kicker">Continue deeper</p><h3>Connect photon delivery to plant physiology, climate and records.</h3><p>This curriculum intentionally does not publish one universal cannabis PPFD, DLI, spectrum, or fixture-height recipe. Working envelopes must remain qualified by genotype, stage, canopy, photoperiod, atmosphere, root-zone support, energy constraints and repeated crop response.</p><div class="li6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section><section class="li6-visuals"><p class="li6-kicker">Visual study map</p><h3>Core diagrams this section should teach with.</h3><ul>${curriculum.visualTargets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div></section><!-- dtf-lighting-v6:end -->`;}

const page=await pageBySlug('lighting');
const before=rendered(page.content);
if(!before.includes('data-dtf-topic="lighting"')) throw new Error('Lighting is not the expected V3 subject owner.');
if(!before.includes('data-dtf-learning-v4="topic-lighting"')) throw new Error('Lighting is missing its V4 guided-learning layer.');
const clean=before.replace(/<!-- dtf-lighting-v6:start -->[\s\S]*?<!-- dtf-lighting-v6:end -->/g,'').trim();
const next=`${clean}\n${block(page.id)}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
if(!apply){
  const report={generatedAt:new Date().toISOString(),apply:false,pageId:page.id,route:'/learn/lighting/',chapters:8,lessons:32,visualTargets:curriculum.visualTargets.length,controlledReferenceIds:referenceIds.length,publishedReferencePages:publicRefs.size,visitorVerified:false,backupDir};
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));process.exit(0);
}

let wrote=false;
try{
  await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next})});
  wrote=true;
  const edit=await pageBySlug('lighting');
  const editContent=rendered(edit.content);
  if(!editContent.includes('data-dtf-lighting-v6="true"')) throw new Error('Edit-context Lighting V6 marker missing.');
  if((editContent.match(/data-li6-chapter=/g)||[]).length!==8) throw new Error('Edit-context chapter count is not 8.');
  if((editContent.match(/class="li6-lesson"/g)||[]).length!==32) throw new Error('Edit-context lesson count is not 32.');
  for(const id of chapterIds) if(!editContent.includes(`data-li6-chapter="${id}"`)) throw new Error(`Edit-context chapter ID missing: ${id}`);
  if(!editContent.includes('data-dtf-topic="lighting"')||!editContent.includes('data-dtf-learning-v4="topic-lighting"')) throw new Error('Lighting page lost V3 or V4 owner markers.');

  const visitor=await publicHtml('/learn/lighting/');
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!visitor.includes('data-dtf-lighting-v6="true"')) throw new Error('Visitor Lighting V6 marker missing.');
  if((visitor.match(/data-li6-chapter=/g)||[]).length!==8) throw new Error('Visitor chapter count is not 8.');
  if((visitor.match(/class="li6-lesson"/g)||[]).length!==32) throw new Error('Visitor lesson count is not 32.');
  for(const id of chapterIds) if(!visitor.includes(`data-li6-chapter="${id}"`)) throw new Error(`Visitor chapter ID missing: ${id}`);
  if(!visitor.includes('data-dtf-topic="lighting"')||!visitor.includes('data-dtf-learning-v4="topic-lighting"')) throw new Error('Visitor page lost V3 or V4 owner markers.');

  const report={generatedAt:new Date().toISOString(),apply:true,pageId:page.id,route:'/learn/lighting/',chapters:8,lessons:32,visualTargets:curriculum.visualTargets.length,controlledReferenceIds:referenceIds.length,publishedReferencePages:publicRefs.size,visitorVerified:true,backupDir};
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){
    try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before})});await writeFile(join(backupDir,'rollback.txt'),`Rolled back after failure: ${error.message}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback.txt'),`ROLLBACK FAILED after ${error.message}: ${rollbackError.message}\n`);}
  }
  throw error;
}
