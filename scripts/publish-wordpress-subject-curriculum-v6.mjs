import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_SUBJECT_CURRICULUM_V6||'').toLowerCase()==='true';
const curriculumPath=process.env.SUBJECT_CURRICULUM_PATH||'';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-subject-curriculum-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
if(!curriculumPath) throw new Error('SUBJECT_CURRICULUM_PATH is required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rxEsc=v=>String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const curriculum=JSON.parse(await readFile(curriculumPath,'utf8'));
if(curriculum?.schemaVersion!==1||!/^[a-z0-9-]+-v6$/.test(curriculum?.id||'')) throw new Error('Invalid V6 curriculum identity.');
if(!/^\/learn\/[a-z0-9-]+\/$/.test(curriculum.route||'')) throw new Error('Curriculum requires a canonical /learn/.../ route.');
if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) throw new Error('Expected exactly 8 curriculum chapters.');
const lessons=curriculum.chapters.flatMap(c=>c.lessons||[]);
if(lessons.length!==32||curriculum.chapters.some(c=>(c.lessons||[]).length!==4)) throw new Error(`Expected 8 x 4 = 32 lessons, found ${lessons.length}.`);
if(new Set(curriculum.chapters.map(c=>c.id)).size!==8) throw new Error('Chapter IDs must be unique.');
for(const chapter of curriculum.chapters){
  if(!chapter.id||!chapter.title||!chapter.objective||!(chapter.encyclopediaIds||[]).length||!(chapter.knowledgeChecks||[]).length) throw new Error(`${chapter.id||'unknown'}: incomplete chapter.`);
  for(const lesson of chapter.lessons) if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!(lesson.concepts||[]).length) throw new Error(`${chapter.id}: incomplete lesson.`);
}
if(!Array.isArray(curriculum.deepRoutes)||!Array.isArray(curriculum.visualTargets)||!curriculum.visualTargets.length) throw new Error('Curriculum requires deepRoutes and visualTargets.');

const topicId=curriculum.id.replace(/-v6$/,'');
const pageSlug=curriculum.route.split('/').filter(Boolean).at(-1);
const v3Marker=`data-dtf-topic=\"${topicId}\"`;
const v4Marker=`data-dtf-learning-v4=\"topic-${topicId}\"`;
const v6Marker=`data-dtf-${curriculum.id}=\"true\"`;
const markerName=`dtf-subject-curriculum-v6:${curriculum.id}`;
const startMarker=`<!-- ${markerName}:start -->`;
const endMarker=`<!-- ${markerName}:end -->`;
const prefix=`cv6-${topicId}`;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`${topicId}-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Subject-Curriculum-V6/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1600);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<8) await sleep(attempt*1600);}
  }
  throw last;
}
async function pageBySlug(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected exactly one page, found ${Array.isArray(rows)?rows.length:'invalid'}.`);return rows[0];}

const refIds=[...new Set(curriculum.chapters.flatMap(c=>c.encyclopediaIds||[]))];
const refTitles=new Map();
for(const id of refIds){
  if(!/^THC-ENC-\d{3}$/.test(id)) throw new Error(`Invalid encyclopedia ID: ${id}`);
  const n=Number(id.slice(-3));
  const volume=Math.floor((n-1)/20)+1;
  const path=`content/encyclopedia/volume-${String(volume).padStart(2,'0')}/lessons/thc-enc-${String(n).padStart(3,'0')}.json`;
  await access(path);
  const item=JSON.parse(await readFile(path,'utf8'));
  if(item.id!==id||!item.title||!item.objective) throw new Error(`${id}: incomplete source-controlled encyclopedia lesson.`);
  refTitles.set(id,item.title);
}
const publicRefs=new Set();
for(const id of refIds){try{const rows=await request(`/wp-json/wp/v2/pages?slug=${id.toLowerCase()}&context=edit&per_page=5`);if(Array.isArray(rows)&&rows.some(x=>x.status==='publish')) publicRefs.add(id);}catch{}}
const refCard=id=>`<a class="cv6-ref" href="${publicRefs.has(id)?`/learn/encyclopedia/${id.toLowerCase()}/`:'/learn/encyclopedia/'}"><span>${esc(id)}</span><strong>${esc(refTitles.get(id)||id)}</strong></a>`;
const lessonHtml=(lesson,i)=>`<details class="cv6-lesson"><summary><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="cv6-body"><p>${esc(lesson.summary)}</p><div class="cv6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="cv6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
const chapterHtml=chapter=>`<section class="cv6-chapter" id="${prefix}-${esc(chapter.id)}" data-cv6-chapter="${esc(chapter.id)}"><div class="cv6-chapter-head"><div><p class="cv6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#${prefix}-top">Back to chapters ↑</a></div><div class="cv6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="cv6-bottom"><article><p class="cv6-kicker">Knowledge check</p><h4>Explain these before moving on</h4><ol>${chapter.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></article><article><p class="cv6-kicker">Controlled deep reference</p><h4>Related reviewed encyclopedia lessons</h4><div class="cv6-refs">${chapter.encyclopediaIds.map(refCard).join('')}</div></article></div></section>`;

function block(pageId){return `${startMarker}<style id="${prefix}-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}.cv6{--deep:#102115;--forest:#244529;--green:#4f7c45;--gold:#d7bb6e;--cream:#f7f4e9;--paper:#fffdf7;--ink:#233727;--muted:#5c6b5d;--line:#dce3d8;background:linear-gradient(180deg,#f7f4e9,#eef3e9);color:var(--ink);padding:70px 0 78px}.cv6 *{box-sizing:border-box}.cv6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.cv6-kicker{margin:0 0 8px;color:#806d32;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cv6-intro{display:grid;grid-template-columns:1.08fr .92fr;gap:28px}.cv6 h2{margin:0;font-size:clamp(2.35rem,5vw,4.6rem);line-height:.96;letter-spacing:-.05em}.cv6 h3{margin:0;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1;letter-spacing:-.035em}.cv6 h4{margin:0 0 8px}.cv6 p{color:var(--muted);line-height:1.68}.cv6-lede{font-size:1.08rem}.cv6-stats{padding:24px;border-radius:23px;background:linear-gradient(145deg,var(--deep),var(--forest));color:#fff}.cv6-stats strong{display:block;color:var(--gold);font-size:2.35rem;line-height:1}.cv6-stats p{color:#d5ded2;margin:7px 0 16px}.cv6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 55px}.cv6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.cv6-nav span{display:block;color:#806d32;font-size:.67rem;margin-bottom:3px}.cv6-chapter{padding:42px 0;border-top:1px solid var(--line)}.cv6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.cv6-chapter-head>div{max-width:820px}.cv6-chapter-head>a{white-space:nowrap;color:var(--green)!important;font-weight:900;text-decoration:none!important}.cv6-lessons{display:grid;gap:10px}.cv6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.cv6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.cv6-lesson summary::-webkit-details-marker{display:none}.cv6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-weight:950;font-size:1.3rem}.cv6-lesson[open] summary:after{content:'–'}.cv6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e9efe3;color:#526c48;font-size:.7rem;font-weight:950}.cv6-body{padding:0 19px 19px 64px}.cv6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.cv6-concepts span{padding:5px 8px;border-radius:999px;background:#eef3e9;border:1px solid #dbe4d5;color:#4b6148;font-size:.71rem;font-weight:850}.cv6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cv6-two article,.cv6-bottom>article{padding:15px;border-radius:14px;background:#f3f6ef;border:1px solid #dfe6db}.cv6-two article:last-child{background:#fff9ed;border-color:#e7dbc2}.cv6-two p{margin:0;font-size:.94rem}.cv6-bottom{display:grid;grid-template-columns:.82fr 1.18fr;gap:14px;margin-top:15px}.cv6-bottom li{margin:7px 0;color:#485a49;line-height:1.5}.cv6-refs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cv6-ref{display:block;padding:10px;border-radius:11px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important}.cv6-ref span{display:block;color:#806d32;font-size:.64rem;font-weight:950}.cv6-ref strong{display:block;margin-top:3px;font-size:.87rem}.cv6-deep{margin-top:40px;padding:26px;border-radius:22px;background:linear-gradient(145deg,#142c18,#29482a);color:#fff}.cv6-deep p{color:#d1ddd0}.cv6-routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.cv6-routes a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.cv6-visuals{margin-top:18px;padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}.cv6-visuals ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0;list-style:none}.cv6-visuals li{padding:10px;border-radius:11px;background:#f3f6ef;color:#485a49}@media(max-width:920px){.cv6-intro,.cv6-bottom{grid-template-columns:1fr}.cv6-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.cv6-routes,.cv6-visuals ul{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.cv6{padding:52px 0 60px}.cv6-wrap{width:min(100% - 26px,1180px)}.cv6-nav,.cv6-two,.cv6-refs,.cv6-routes,.cv6-visuals ul{grid-template-columns:1fr}.cv6-chapter-head{align-items:flex-start;flex-direction:column}.cv6-body{padding:0 15px 17px}}
</style><section class="cv6" data-dtf-${esc(curriculum.id)}="true" data-dtf-subject-curriculum-v6="${esc(curriculum.id)}" id="${prefix}-top"><div class="cv6-wrap"><div class="cv6-intro"><div><p class="cv6-kicker">Teaching Healthy Cultivation · Complete subject curriculum</p><h2>${esc(curriculum.title)}</h2><p class="cv6-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="cv6-stats"><strong>8</strong><p>connected chapters</p><strong>32</strong><p>focused lessons</p><strong>${publicRefs.size}</strong><p>controlled encyclopedia pages linked directly</p></aside></div><nav class="cv6-nav">${curriculum.chapters.map(c=>`<a href="#${prefix}-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<section class="cv6-deep"><p class="cv6-kicker">Continue deeper</p><h3>Connect this subject to the rest of the plant system.</h3><p>${esc(curriculum.evidenceNote||'Use measured context, controlled comparisons and repeatable records. Technique names and target numbers do not replace plant, environment and root-zone evidence.')}</p><div class="cv6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section><section class="cv6-visuals"><p class="cv6-kicker">Visual study map</p><h3>Core diagrams this section should teach with.</h3><ul>${curriculum.visualTargets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div></section>${endMarker}`;}

const page=await pageBySlug(pageSlug);
const before=rendered(page.content);
if(!before.includes(v3Marker)) throw new Error(`${curriculum.title} is not the expected V3 topic owner.`);
if(!before.includes(v4Marker)) throw new Error(`${curriculum.title} is missing its V4 guided-learning layer.`);
const clean=before.replace(new RegExp(`${rxEsc(startMarker)}[\\s\\S]*?${rxEsc(endMarker)}`,'g'),'').trim();
const next=`${clean}\n${block(page.id)}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug(pageSlug)).content);
  if(!edit.includes(v6Marker)) throw new Error('Edit-context V6 marker missing.');
  if((edit.match(/data-cv6-chapter=/g)||[]).length!==8) throw new Error('Edit-context chapter count is not 8.');
  if((edit.match(/class="cv6-lesson"/g)||[]).length!==32) throw new Error('Edit-context lesson count is not 32.');
  for(const chapter of curriculum.chapters) if(!edit.includes(`data-cv6-chapter=\"${chapter.id}\"`)) throw new Error(`Edit-context chapter marker missing: ${chapter.id}`);

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{const response=await fetch(`${site}${curriculum.route}?dtf_cv6=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Subject-Curriculum-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});visitor=await response.text();if(response.ok&&visitor.includes(v6Marker)){ok=true;break;}}catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor V6 marker missing.');
  if((visitor.match(/data-cv6-chapter=/g)||[]).length!==8) throw new Error('Visitor chapter count is not 8.');
  if((visitor.match(/class="cv6-lesson"/g)||[]).length!==32) throw new Error('Visitor lesson count is not 32.');
  for(const marker of [v3Marker,v4Marker]) if(!visitor.includes(marker)) throw new Error(`Visitor page lost owner marker: ${marker}`);

  const report={generatedAt:new Date().toISOString(),apply,curriculumId:curriculum.id,title:curriculum.title,pageId:page.id,route:curriculum.route,chapters:8,lessons:32,controlledReferences:refIds.length,publishedReferencePages:publicRefs.size,visualTargets:curriculum.visualTargets.length,visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.txt'),`Restored page ${page.id} after failure: ${error.message}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback-error.txt'),`${rollbackError.message}\n`);}}
  throw error;
}
