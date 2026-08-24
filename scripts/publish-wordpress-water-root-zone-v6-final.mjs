import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_WATER_ROOT_ZONE_V6||'').toLowerCase()==='true';
const curriculumPath=process.env.WATER_ROOT_ZONE_V6_PATH||'site/wordpress/education/water-root-zone-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-water-root-zone-v6-final';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`water-root-zone-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Water-Root-Zone-V6/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
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
if(curriculum?.schemaVersion!==1||curriculum?.id!=='water-root-zone-v6') throw new Error('Invalid Water & Root Zone V6 curriculum.');
if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) throw new Error('Expected exactly 8 Water & Root Zone chapters.');
const lessonCount=curriculum.chapters.reduce((n,c)=>n+(c.lessons||[]).length,0);
if(lessonCount!==32) throw new Error(`Expected 32 Water & Root Zone lessons, found ${lessonCount}.`);
const chapterIds=curriculum.chapters.map(c=>c.id);
if(new Set(chapterIds).size!==8) throw new Error('Water & Root Zone chapter IDs are not unique.');
for(const chapter of curriculum.chapters){
  if(!chapter.title||!chapter.objective||!Array.isArray(chapter.encyclopediaIds)||!(chapter.knowledgeChecks||[]).length) throw new Error(`${chapter.id}: incomplete chapter.`);
  if((chapter.lessons||[]).length!==4) throw new Error(`${chapter.id}: expected exactly 4 focused lessons.`);
  for(const lesson of chapter.lessons) if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!(lesson.concepts||[]).length) throw new Error(`${chapter.id}: incomplete lesson.`);
}

function referencePath(id){
  const n=Number(String(id).slice(-3));
  if(n>=41&&n<=60) return `content/encyclopedia/volume-03/lessons/thc-enc-${String(n).padStart(3,'0')}.json`;
  if(n>=81&&n<=100) return `content/encyclopedia/volume-05/lessons/thc-enc-${String(n).padStart(3,'0')}.json`;
  if(n>=121&&n<=140) return `content/encyclopedia/volume-07/lessons/thc-enc-${String(n).padStart(3,'0')}.json`;
  throw new Error(`Water & Root Zone V6 reference outside controlled roots/water/root-zone chemistry boundaries: ${id}`);
}
const referenceIds=[...new Set(curriculum.chapters.flatMap(c=>c.encyclopediaIds||[]))];
const referenceTitles=new Map();
for(const id of referenceIds){
  const item=JSON.parse(await readFile(referencePath(id),'utf8'));
  if(item.id!==id||!item.title||!item.objective) throw new Error(`${id}: incomplete controlled encyclopedia source.`);
  referenceTitles.set(id,item.title);
}

const publicRefs=new Set();
for(const id of referenceIds){
  try{
    const rows=await request(`/wp-json/wp/v2/pages?slug=${id.toLowerCase()}&context=edit&per_page=5`);
    if(Array.isArray(rows)&&rows.some(x=>x.status==='publish')) publicRefs.add(id);
  }catch{}
}
const refCard=id=>`<a class="wr6-ref" href="${publicRefs.has(id)?`/learn/encyclopedia/${id.toLowerCase()}/`:'/learn/encyclopedia/'}"><span>${esc(id)}</span><strong>${esc(referenceTitles.get(id)||id)}</strong></a>`;
const lessonHtml=(lesson,i)=>`<details class="wr6-lesson"><summary><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="wr6-body"><p>${esc(lesson.summary)}</p><div class="wr6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="wr6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
const chapterHtml=chapter=>`<section class="wr6-chapter" id="wr6-${esc(chapter.id)}" data-wr6-chapter="${esc(chapter.id)}"><div class="wr6-chapter-head"><div><p class="wr6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#wr6-top">Back to chapters ↑</a></div><div class="wr6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="wr6-bottom"><article><p class="wr6-kicker">Knowledge check</p><h4>Explain these before moving on</h4><ol>${chapter.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></article><article><p class="wr6-kicker">Controlled deep reference</p><h4>Related reviewed root-zone lessons</h4><div class="wr6-refs">${chapter.encyclopediaIds.map(refCard).join('')}</div></article></div></section>`;

function block(pageId){return `<!-- dtf-water-root-zone-v6:start --><style id="dtf-water-root-zone-v6-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}
.wr6{--deep:#081b16;--forest:#12382e;--green:#27755c;--aqua:#5c9c8b;--gold:#d4b96e;--cream:#f7f4ea;--paper:#fffdf8;--ink:#16342c;--muted:#52675f;--line:#d7e2dc;background:linear-gradient(180deg,#f7f4ea,#edf3ef);color:var(--ink);padding:70px 0 78px}.wr6 *{box-sizing:border-box}.wr6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.wr6-kicker{margin:0 0 8px;color:#78672f;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.wr6-intro{display:grid;grid-template-columns:1.08fr .92fr;gap:28px;align-items:start}.wr6 h2{margin:0;font-size:clamp(2.35rem,5vw,4.6rem);line-height:.96;letter-spacing:-.05em}.wr6 h3{margin:0;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1;letter-spacing:-.035em}.wr6 h4{margin:0 0 8px}.wr6 p{color:var(--muted);line-height:1.68}.wr6-lede{font-size:1.08rem}.wr6-stats{padding:24px;border-radius:23px;background:radial-gradient(circle at 90% 10%,rgba(92,156,139,.28),transparent 34%),linear-gradient(145deg,var(--deep),var(--forest));color:#fff;border:1px solid #285448}.wr6-stats strong{display:block;color:var(--gold);font-size:2.35rem;line-height:1}.wr6-stats p{color:#d0ded8;margin:7px 0 16px}.wr6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 55px}.wr6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.wr6-nav span{display:block;color:#78672f;font-size:.67rem;margin-bottom:3px}.wr6-chapter{padding:42px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.wr6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.wr6-chapter-head>div{max-width:820px}.wr6-chapter-head>a{white-space:nowrap;color:var(--green)!important;font-weight:900;text-decoration:none!important}.wr6-lessons{display:grid;gap:10px}.wr6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.wr6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.wr6-lesson summary::-webkit-details-marker{display:none}.wr6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-weight:950;font-size:1.3rem}.wr6-lesson[open] summary:after{content:'–'}.wr6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e4efeb;color:#3b6759;font-size:.7rem;font-weight:950}.wr6-body{padding:0 19px 19px 64px}.wr6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.wr6-concepts span{padding:5px 8px;border-radius:999px;background:#edf3ef;border:1px solid #d8e3dc;color:#416057;font-size:.71rem;font-weight:850}.wr6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.wr6-two article,.wr6-bottom>article{padding:15px;border-radius:14px;background:#f1f5f2;border:1px solid #dbe5df}.wr6-two article:last-child{background:#f0f7f5;border-color:#cfe1db}.wr6-two p{margin:0;font-size:.94rem}.wr6-bottom{display:grid;grid-template-columns:.82fr 1.18fr;gap:14px;margin-top:15px}.wr6-bottom ol{margin:10px 0 0;padding-left:1.2rem}.wr6-bottom li{margin:7px 0;color:#42594f;line-height:1.5}.wr6-refs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.wr6-ref{display:block;padding:10px 11px;border-radius:11px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important}.wr6-ref span{display:block;color:#78672f;font-size:.64rem;font-weight:950}.wr6-ref strong{display:block;margin-top:3px;font-size:.87rem;line-height:1.25}.wr6-deep{margin-top:40px;padding:26px;border-radius:22px;background:linear-gradient(145deg,#0b2b22,#164235);color:#fff}.wr6-deep p{color:#c9d8d1}.wr6-routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.wr6-routes a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.wr6-visuals{margin-top:18px;padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}.wr6-visuals ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:11px 0 0;padding:0;list-style:none}.wr6-visuals li{padding:10px;border-radius:11px;background:#f1f5f2;color:#43594f;line-height:1.4}
@media(max-width:920px){.wr6-intro,.wr6-bottom{grid-template-columns:1fr}.wr6-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.wr6-routes{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.wr6{padding:52px 0 60px}.wr6-wrap{width:min(100% - 26px,1180px)}.wr6-nav,.wr6-two,.wr6-refs,.wr6-routes,.wr6-visuals ul{grid-template-columns:1fr}.wr6-chapter-head{align-items:flex-start;flex-direction:column}.wr6-body{padding:0 15px 17px}.wr6-lesson summary{padding:15px}}
</style><section class="wr6" data-dtf-water-root-zone-v6="true" id="wr6-top"><div class="wr6-wrap"><div class="wr6-intro"><div><p class="wr6-kicker">Teaching Healthy Cultivation · Root-zone measurement system</p><h2>Water & Root Zone, measured as one connected system.</h2><p class="wr6-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="wr6-stats"><strong>8</strong><p>connected chapters</p><strong>32</strong><p>focused lessons</p><strong>${publicRefs.size}</strong><p>controlled root, water and chemistry encyclopedia pages linked directly</p></aside></div><nav class="wr6-nav" aria-label="Water and Root Zone chapters">${curriculum.chapters.map(c=>`<a href="#wr6-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<section class="wr6-deep"><p class="wr6-kicker">Continue deeper</p><h3>Connect the root zone to climate, light, nutrition and records.</h3><p>This curriculum intentionally does not present one universal runoff percentage, dryback target, irrigation frequency, pH decimal or EC recipe. Media, container, water source, measurement method, stage, genotype, root condition and atmospheric demand all change interpretation.</p><div class="wr6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section><section class="wr6-visuals"><p class="wr6-kicker">Visual study map</p><h3>Core diagrams this section should teach with.</h3><ul>${curriculum.visualTargets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div></section><!-- dtf-water-root-zone-v6:end -->`;}

const page=await pageBySlug('water-root-zone');
const before=rendered(page.content);
if(!before.includes('data-dtf-topic="water-root-zone"')) throw new Error('Water & Root Zone is not the expected V3 subject owner.');
if(!before.includes('data-dtf-learning-v4="topic-water-root-zone"')) throw new Error('Water & Root Zone is missing its V4 guided-learning layer.');
const clean=before.replace(/<!-- dtf-water-root-zone-v6:start -->[\s\S]*?<!-- dtf-water-root-zone-v6:end -->/g,'').trim();
const next=`${clean}\n${block(page.id)}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('water-root-zone')).content);
  if(!edit.includes('data-dtf-water-root-zone-v6="true"')) throw new Error('Edit-context Water & Root Zone V6 marker missing.');
  if((edit.match(/data-wr6-chapter=/g)||[]).length!==8) throw new Error('Edit-context chapter count is not 8.');
  if((edit.match(/class="wr6-lesson"/g)||[]).length!==32) throw new Error('Edit-context lesson count is not 32.');
  for(const id of chapterIds) if(!edit.includes(`data-wr6-chapter="${id}"`)) throw new Error(`Edit-context chapter ID missing: ${id}`);
  if(!edit.includes('data-dtf-topic="water-root-zone"')||!edit.includes('data-dtf-learning-v4="topic-water-root-zone"')) throw new Error('Edit-context page lost V3 or V4 owner markers.');

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}/learn/water-root-zone/?dtf_wr6=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Water-Root-Zone-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
      visitor=await response.text();if(response.ok&&visitor.includes('data-dtf-water-root-zone-v6="true"')){ok=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor Water & Root Zone V6 marker missing.');
  if((visitor.match(/data-wr6-chapter=/g)||[]).length!==8) throw new Error('Visitor chapter count is not 8.');
  if((visitor.match(/class="wr6-lesson"/g)||[]).length!==32) throw new Error('Visitor lesson count is not 32.');
  for(const id of chapterIds) if(!visitor.includes(`data-wr6-chapter="${id}"`)) throw new Error(`Visitor chapter ID missing: ${id}`);
  if(!visitor.includes('data-dtf-topic="water-root-zone"')||!visitor.includes('data-dtf-learning-v4="topic-water-root-zone"')) throw new Error('Visitor page lost V3 or V4 owner markers.');

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/water-root-zone/',chapters:8,lessons:32,visualTargets:curriculum.visualTargets.length,controlledReferenceIds:referenceIds.length,publishedReferencePages:publicRefs.size,visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  await writeFile(join(backupDir,'error.txt'),`${error.stack||error.message}\n`);
  if(wrote){
    try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:page.status||'publish'})});await writeFile(join(backupDir,'rollback.txt'),'Prior Water & Root Zone page restored.\n');}
    catch(rollbackError){await writeFile(join(backupDir,'rollback-error.txt'),`${rollbackError.stack||rollbackError.message}\n`);}
  }
  throw error;
}
