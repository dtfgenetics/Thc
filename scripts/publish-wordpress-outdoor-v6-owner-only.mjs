import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_OUTDOOR_V6_OWNER||'').toLowerCase()==='true';
const curriculumPath=process.env.OUTDOOR_V6_PATH||'site/wordpress/education/outdoor-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-outdoor-v6-owner-only';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`outdoor-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Outdoor-V6-Owner-Only/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1500);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<8) await sleep(attempt*1500);}
  }
  throw last;
}
async function pageBySlug(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected exactly one page, found ${Array.isArray(rows)?rows.length:'invalid'}.`);return rows[0];}

const curriculum=JSON.parse(await readFile(curriculumPath,'utf8'));
if(curriculum?.schemaVersion!==1||curriculum?.id!=='outdoor-v6'||curriculum?.route!=='/learn/outdoor/') throw new Error('Invalid Outdoor V6 curriculum.');
if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) throw new Error('Expected exactly eight Outdoor V6 chapters.');
const lessons=curriculum.chapters.reduce((n,c)=>n+(c.lessons||[]).length,0);
if(lessons!==32||curriculum.chapters.some(c=>(c.lessons||[]).length!==4)) throw new Error(`Expected 32 Outdoor lessons, found ${lessons}.`);
const ids=curriculum.chapters.map(c=>c.id);
if(new Set(ids).size!==8) throw new Error('Outdoor chapter IDs must be unique.');
for(const c of curriculum.chapters){if(!c.title||!c.objective||!(c.knowledgeChecks||[]).length) throw new Error(`${c.id}: incomplete chapter.`);for(const l of c.lessons) if(!l.title||!l.summary||!l.cultivation||!l.observe||!(l.concepts||[]).length) throw new Error(`${c.id}: incomplete lesson.`);}

const lessonHtml=(lesson,i)=>`<details class="hov6-lesson"><summary><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="hov6-body"><p>${esc(lesson.summary)}</p><div class="hov6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="hov6-two"><article><h4>Why this matters outdoors</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
const chapterHtml=c=>`<section class="hov6-chapter" id="hov6-${esc(c.id)}" data-hov6-chapter="${esc(c.id)}"><div class="hov6-chapter-head"><div><p class="hov6-kicker">Chapter ${String(c.number).padStart(2,'0')}</p><h3>${esc(c.title)}</h3><p>${esc(c.objective)}</p></div><a href="#hov6-top">Back to chapters ↑</a></div><div class="hov6-lessons">${c.lessons.map(lessonHtml).join('')}</div><div class="hov6-check"><p class="hov6-kicker">Knowledge check</p><h4>Explain these before moving on</h4><ol>${c.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></div></section>`;
function block(pageId){return `<!-- dtf-outdoor-v6:start --><style id="dtf-outdoor-v6-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}.hov6{--deep:#10271a;--green:#315f3d;--gold:#d5b96b;--cream:#f7f4ea;--paper:#fffdf8;--ink:#173020;--muted:#58685d;--line:#d8e1d7;background:var(--cream);color:var(--ink);padding:70px 0 80px}.hov6 *{box-sizing:border-box}.hov6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.hov6-kicker{margin:0 0 8px;color:#78672f;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.hov6-intro{display:grid;grid-template-columns:1.15fr .85fr;gap:28px}.hov6 h2{margin:0;font-size:clamp(2.35rem,5vw,4.7rem);line-height:.96;letter-spacing:-.05em}.hov6 h3{margin:0;font-size:clamp(1.85rem,3.5vw,3rem);line-height:1;letter-spacing:-.035em}.hov6 h4{margin:0 0 8px}.hov6 p{color:var(--muted);line-height:1.68}.hov6-lede{font-size:1.08rem}.hov6-stats{padding:24px;border-radius:23px;background:linear-gradient(145deg,var(--deep),var(--green));color:#fff}.hov6-stats strong{display:block;color:var(--gold);font-size:2.3rem}.hov6-stats p{color:#d7e0d9;margin:4px 0 15px}.hov6-boundary{margin-top:16px;padding:14px;border-left:4px solid #52733f;background:#fff9ef;border-radius:10px}.hov6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 54px}.hov6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850}.hov6-nav span{display:block;color:#78672f;font-size:.67rem}.hov6-chapter{padding:42px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.hov6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.hov6-chapter-head>div{max-width:820px}.hov6-chapter-head>a{color:var(--green)!important;font-weight:900;text-decoration:none!important;white-space:nowrap}.hov6-lessons{display:grid;gap:10px}.hov6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.hov6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.hov6-lesson summary::-webkit-details-marker{display:none}.hov6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-weight:950}.hov6-lesson[open] summary:after{content:'–'}.hov6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e7eee6;color:#42614a;font-size:.7rem;font-weight:950}.hov6-body{padding:0 19px 19px 64px}.hov6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.hov6-concepts span{padding:5px 8px;border-radius:999px;background:#edf3eb;border:1px solid #d9e3d8;font-size:.71rem;font-weight:850}.hov6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.hov6-two article,.hov6-check{padding:15px;border-radius:14px;background:#f1f5ef;border:1px solid #dbe4d9}.hov6-two article:last-child{background:#fff9ef;border-color:#e8dcc4}.hov6-two p{margin:0;font-size:.94rem}.hov6-check{margin-top:14px}.hov6-check ol{margin:10px 0 0;padding-left:1.2rem}.hov6-check li{margin:7px 0;color:#455a49;line-height:1.5}.hov6-deep{margin-top:38px;padding:25px;border-radius:20px;background:#10271a;color:#fff}.hov6-deep p{color:#d4ddd6}.hov6-routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.hov6-routes a{padding:11px;border-radius:11px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}
@media(max-width:900px){.hov6-intro{grid-template-columns:1fr}.hov6-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.hov6-routes{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.hov6{padding:52px 0 60px}.hov6-wrap{width:min(100% - 26px,1180px)}.hov6-nav,.hov6-two,.hov6-routes{grid-template-columns:1fr}.hov6-chapter-head{align-items:flex-start;flex-direction:column}.hov6-body{padding:0 15px 17px}}
</style><section class="hov6" data-dtf-outdoor-v6="true" id="hov6-top"><div class="hov6-wrap"><div class="hov6-intro"><div><p class="hov6-kicker">Teaching Healthy Cultivation · Site-aware outdoor plant science</p><h2>Outdoor cultivation, built around weather, roots, risk and records.</h2><p class="hov6-lede">${esc(curriculum.learningOutcome)}</p><div class="hov6-boundary"><strong>Evidence boundary</strong><p>${esc(curriculum.evidenceBoundary)}</p></div></div><aside class="hov6-stats"><strong>8</strong><p>connected chapters</p><strong>32</strong><p>focused lessons</p><strong>${curriculum.sourceRefs.length}</strong><p>controlled evidence references</p></aside></div><nav class="hov6-nav" aria-label="Outdoor V6 chapters">${curriculum.chapters.map(c=>`<a href="#hov6-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<section class="hov6-deep"><p class="hov6-kicker">Continue deeper</p><h3>Connect outdoor observations to the rest of the plant-science system.</h3><p>Outdoor management changes with site, genotype, stage, weather and season. Use local measurements and repeated crop records to qualify every recommendation.</p><div class="hov6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section></div></section><!-- dtf-outdoor-v6:end -->`;}

const page=await pageBySlug('outdoor');
const before=rendered(page.content);
const owner='data-dtf-topic="outdoor-cultivation"';
const guide='data-dtf-learning-v4="topic-outdoor-cultivation"';
if(!before.includes(owner)) throw new Error(`Outdoor page is not the expected canonical V3 owner (${owner} missing).`);
if(!before.includes(guide)) throw new Error(`Outdoor page is missing its canonical V4 guided-learning owner (${guide} missing).`);
const clean=before.replace(/<!-- dtf-outdoor-v6:start -->[\s\S]*?<!-- dtf-outdoor-v6:end -->/g,'').trim();
const next=`${clean}\n${block(page.id)}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('outdoor')).content);
  if(!edit.includes(owner)||!edit.includes(guide)||!edit.includes('data-dtf-outdoor-v6="true"')) throw new Error('Edit-context Outdoor ownership verification failed.');
  if((edit.match(/data-hov6-chapter=/g)||[]).length!==8||(edit.match(/class="hov6-lesson"/g)||[]).length!==32) throw new Error('Edit-context Outdoor chapter/lesson count failed.');
  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{const response=await fetch(`${site}/learn/outdoor/?dtf_outdoor_owner=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Outdoor-V6-Owner-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});visitor=await response.text();if(response.ok&&visitor.includes('data-dtf-outdoor-v6="true"')){ok=true;break;}}catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok||!visitor.includes(owner)||!visitor.includes(guide)) throw new Error('Visitor Outdoor V6 ownership verification failed.');
  if((visitor.match(/data-hov6-chapter=/g)||[]).length!==8||(visitor.match(/class="hov6-lesson"/g)||[]).length!==32) throw new Error('Visitor Outdoor chapter/lesson count failed.');
  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/outdoor/',chapters:8,lessons:32,sources:curriculum.sourceRefs.length,visualTargets:curriculum.visualTargets.length,visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:page.status||'publish'})});await writeFile(join(backupDir,'rollback.txt'),`Restored prior Outdoor page after failure: ${error.message}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback-failed.txt'),`${rollbackError.stack||rollbackError}\n`);}}
  throw error;
}
