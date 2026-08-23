import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_PLANT_BIOLOGY_V6||'').toLowerCase()==='true';
const curriculumPath=process.env.PLANT_BIOLOGY_V6_PATH||'site/wordpress/education/plant-biology-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-plant-biology-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Plant-Biology-V6/1.0'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`plant-biology-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
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
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected exactly one WordPress page, found ${Array.isArray(rows)?rows.length:'invalid response'}.`);
  return rows[0];
}

const curriculum=JSON.parse(await readFile(curriculumPath,'utf8'));
if(curriculum?.schemaVersion!==1||curriculum?.id!=='plant-biology-v6'||curriculum?.route!=='/learn/plant-biology/') throw new Error('Plant Biology V6 curriculum identity is invalid.');
if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) throw new Error('Plant Biology V6 must contain exactly 8 chapters.');
const lessonCount=curriculum.chapters.reduce((sum,c)=>sum+(Array.isArray(c.lessons)?c.lessons.length:0),0);
if(lessonCount!==30) throw new Error(`Plant Biology V6 must contain exactly 30 lessons; found ${lessonCount}.`);
if(!Array.isArray(curriculum.visualTargets)||curriculum.visualTargets.length<10) throw new Error('Plant Biology V6 visual target map is incomplete.');
const chapterIds=new Set();
for(const chapter of curriculum.chapters){
  if(!chapter.id||chapterIds.has(chapter.id)) throw new Error(`Duplicate or invalid chapter ID: ${chapter.id}`);
  chapterIds.add(chapter.id);
  if(!chapter.title||!chapter.objective||!Array.isArray(chapter.knowledgeChecks)||chapter.knowledgeChecks.length<3) throw new Error(`${chapter.id}: chapter teaching fields are incomplete.`);
  for(const lesson of chapter.lessons||[]){
    if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!Array.isArray(lesson.concepts)||lesson.concepts.length<3) throw new Error(`${chapter.id}: incomplete lesson ${lesson.title||'(untitled)'}.`);
  }
}

const allEncyclopediaIds=[...new Set(curriculum.chapters.flatMap(c=>c.encyclopediaIds||[]))];
const encyclopediaLocal=new Map();
for(let number=1;number<=20;number+=1){
  const id=`THC-ENC-${String(number).padStart(3,'0')}`;
  const path=`content/encyclopedia/volume-01/lessons/thc-enc-${String(number).padStart(3,'0')}.json`;
  try{const item=JSON.parse(await readFile(path,'utf8'));encyclopediaLocal.set(id,item);}catch{}
}
for(const id of allEncyclopediaIds) if(!encyclopediaLocal.has(id)) throw new Error(`Missing controlled encyclopedia source ${id}.`);

const publishedEncyclopedia=new Set();
for(const id of allEncyclopediaIds){
  const slug=id.toLowerCase();
  try{
    const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=5`);
    if(Array.isArray(rows)&&rows.some(row=>row.status==='publish')) publishedEncyclopedia.add(id);
  }catch{}
}

function referenceCard(id){
  const item=encyclopediaLocal.get(id)||{};
  const title=item.title||id;
  if(publishedEncyclopedia.has(id)) return `<a class="pb6-ref" href="/learn/encyclopedia/${esc(id.toLowerCase())}/"><span>${esc(id)}</span><strong>${esc(title)}</strong></a>`;
  return `<a class="pb6-ref" href="/learn/encyclopedia/"><span>${esc(id)}</span><strong>${esc(title)}</strong></a>`;
}

function chapterNav(chapter){return `<a href="#pb6-${esc(chapter.id)}"><span>${String(chapter.number).padStart(2,'0')}</span>${esc(chapter.title)}</a>`;}
function lessonHtml(lesson,index){
  return `<details class="pb6-lesson"><summary><span>${String(index+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="pb6-lesson-body"><p>${esc(lesson.summary)}</p><div class="pb6-concepts">${lesson.concepts.map(c=>`<span>${esc(c)}</span>`).join('')}</div><div class="pb6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Observe before concluding</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
}
function chapterHtml(chapter){
  return `<section class="pb6-chapter" id="pb6-${esc(chapter.id)}"><div class="pb6-chapter-head"><div><p class="pb6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#pb6-top">Back to chapters ↑</a></div><div class="pb6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="pb6-bottom-grid"><article class="pb6-check"><p class="pb6-kicker">Knowledge check</p><h4>Can you explain these without guessing?</h4><ol>${chapter.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></article><article class="pb6-deep"><p class="pb6-kicker">Controlled deep reference</p><h4>Related encyclopedia lessons</h4><div class="pb6-ref-grid">${(chapter.encyclopediaIds||[]).map(referenceCard).join('')}</div></article></div></section>`;
}

function buildBlock(pageId){
  return `<!-- dtf-plant-biology-v6:start --><style id="dtf-plant-biology-v6-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}
.pb6{--deep:#081b11;--forest:#103821;--green:#1f7242;--gold:#d6b85f;--cream:#f7f4ea;--paper:#fffdf8;--ink:#14301f;--muted:#52665a;--line:#d7e2d9;background:var(--cream);color:var(--ink);padding:70px 0 78px}.pb6 *{box-sizing:border-box}.pb6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.pb6-intro{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(290px,.95fr);gap:28px;align-items:start;margin-bottom:30px}.pb6-kicker{margin:0 0 8px;color:#7b682f;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.pb6 h2{margin:0;font-size:clamp(2.35rem,5vw,4.6rem);line-height:.96;letter-spacing:-.05em}.pb6 h3{margin:0;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1;letter-spacing:-.035em}.pb6 h4{margin:0 0 8px;font-size:1.08rem}.pb6 p{color:var(--muted);line-height:1.68}.pb6-lede{font-size:1.08rem;max-width:760px}.pb6-statbox{padding:24px;border-radius:23px;background:linear-gradient(145deg,var(--deep),var(--forest));color:#fff;border:1px solid #28513a}.pb6-statbox strong{display:block;font-size:2.45rem;line-height:1;color:var(--gold)}.pb6-statbox p{color:#d1dfd5;margin:7px 0 17px}.pb6-chapter-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:24px 0 58px}.pb6-chapter-nav a{display:flex;gap:9px;align-items:center;padding:13px 14px;border-radius:15px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.pb6-chapter-nav span{color:#7e6a30;font-size:.72rem}.pb6-chapter{padding:42px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.pb6-chapter-head{display:flex;justify-content:space-between;gap:28px;align-items:end;margin-bottom:20px}.pb6-chapter-head>div{max-width:810px}.pb6-chapter-head>div>p:last-child{margin-bottom:0}.pb6-chapter-head>a{white-space:nowrap;color:var(--green)!important;font-weight:900;text-decoration:none!important}.pb6-lessons{display:grid;gap:10px}.pb6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.pb6-lesson summary{display:flex;gap:12px;align-items:center;cursor:pointer;padding:17px 19px;font-size:1.03rem;list-style:none}.pb6-lesson summary::-webkit-details-marker{display:none}.pb6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-size:1.35rem;font-weight:900}.pb6-lesson[open] summary:after{content:'–'}.pb6-lesson summary span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e9f0e8;color:#386948;font-size:.72rem;font-weight:950}.pb6-lesson-body{padding:0 19px 20px 65px}.pb6-lesson-body>p{margin-top:0}.pb6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:13px 0 16px}.pb6-concepts span{padding:5px 8px;border-radius:999px;background:#edf3ec;border:1px solid #d8e3d9;color:#41604c;font-size:.72rem;font-weight:850}.pb6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pb6-two article{padding:15px;border-radius:14px;background:#f1f5ef;border:1px solid #dbe5dc}.pb6-two article:last-child{background:#fff9ef;border-color:#e8dcc4}.pb6-two p{margin:0;font-size:.94rem}.pb6-bottom-grid{display:grid;grid-template-columns:.82fr 1.18fr;gap:14px;margin-top:16px}.pb6-check,.pb6-deep{padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}.pb6-check ol{margin:12px 0 0;padding-left:1.25rem}.pb6-check li{margin:8px 0;color:#42594a;line-height:1.5}.pb6-ref-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.pb6-ref{display:block;padding:11px 12px;border-radius:12px;background:#f1f5ef;border:1px solid #dbe5dc;text-decoration:none!important;color:var(--ink)!important}.pb6-ref span{display:block;color:#7c692f;font-size:.65rem;font-weight:950;letter-spacing:.07em}.pb6-ref strong{display:block;margin-top:3px;font-size:.88rem;line-height:1.3}.pb6-deep-routes{margin-top:42px;padding:26px;border-radius:23px;background:linear-gradient(145deg,#0d2c1b,#123b24);color:#fff}.pb6-deep-routes h3{font-size:clamp(1.7rem,3vw,2.7rem)}.pb6-deep-routes p{color:#c9d8ce}.pb6-route-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:16px}.pb6-route-grid a{display:block;padding:12px 13px;border-radius:13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.pb6-visual-map{margin-top:18px;padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}.pb6-visual-map ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 0;padding:0;list-style:none}.pb6-visual-map li{padding:10px 12px;border-radius:12px;background:#f1f5ef;color:#43594b;line-height:1.4}.pb6-visual-map li:before{content:'•';color:var(--green);font-weight:950;margin-right:7px}
@media(max-width:920px){.pb6-intro,.pb6-bottom-grid{grid-template-columns:1fr}.pb6-chapter-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.pb6-route-grid,.pb6-visual-map ul{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.pb6{padding:52px 0 60px}.pb6-wrap{width:min(100% - 26px,1180px)}.pb6-chapter-nav,.pb6-route-grid,.pb6-visual-map ul,.pb6-two,.pb6-ref-grid{grid-template-columns:1fr}.pb6-chapter-head{align-items:flex-start;flex-direction:column}.pb6-lesson-body{padding:0 15px 17px}.pb6-lesson summary{padding:15px}.pb6-lesson summary span{flex:0 0 auto}}
</style><section class="pb6" data-dtf-plant-biology-v6="true" id="pb6-top"><div class="pb6-wrap"><div class="pb6-intro"><div><p class="pb6-kicker">Teaching Healthy Cultivation · Complete foundation</p><h2>Plant Biology, built as a real curriculum.</h2><p class="pb6-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="pb6-statbox"><strong>8</strong><p>connected chapters</p><strong>30</strong><p>focused lessons</p><strong>${publishedEncyclopedia.size}</strong><p>linked controlled encyclopedia pages currently public</p></aside></div><nav class="pb6-chapter-nav" aria-label="Plant Biology chapters">${curriculum.chapters.map(chapterNav).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<div class="pb6-deep-routes"><p class="pb6-kicker">Continue deeper</p><h3>Use the overview, curriculum and encyclopedia together.</h3><p>The subject page explains the system. These routes carry individual mechanisms into deeper reference material, visuals and diagnostic application.</p><div class="pb6-route-grid">${curriculum.deepRoutes.map(item=>`<a href="${esc(item.href)}">${esc(item.label)} →</a>`).join('')}</div></div><div class="pb6-visual-map"><p class="pb6-kicker">Visual study map</p><h3>Core diagrams this section should teach with.</h3><ul>${curriculum.visualTargets.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div></div></section><!-- dtf-plant-biology-v6:end -->`;
}

const marker=/<!-- dtf-plant-biology-v6:start -->[\s\S]*?<!-- dtf-plant-biology-v6:end -->/g;
const page=await pageBySlug('plant-biology');
const before=rendered(page.content);
if(!before.includes('data-dtf-topic="plant-biology"')) throw new Error('Current Plant Biology page is not the expected V3 topic owner.');
if(!before.includes('data-dtf-learning-v4="topic-plant-biology"')) throw new Error('Current Plant Biology page is missing the guided V4 teaching layer.');
const clean=before.replace(marker,'').trim();
const next=`${clean}\n${buildBlock(page.id)}`;
await writeFile(join(backupDir,'plant-biology-before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'plant-biology-v6-content.html'),next);

let wrote=false;
try{
  if(apply){
    await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
    wrote=true;
  }
  const edited=await pageBySlug('plant-biology');
  const editedContent=rendered(edited.content);
  if(!editedContent.includes('data-dtf-plant-biology-v6="true"')) throw new Error('WordPress edit-context verification did not find Plant Biology V6.');
  if((editedContent.match(/class="pb6-chapter"/g)||[]).length!==8) throw new Error('Edit-context chapter count is not 8.');
  if((editedContent.match(/class="pb6-lesson"/g)||[]).length!==30) throw new Error('Edit-context lesson count is not 30.');

  let visitor='';let visitorOk=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}/learn/plant-biology/?dtf_pb6=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Plant-Biology-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
      visitor=await response.text();
      if(response.ok&&visitor.includes('data-dtf-plant-biology-v6="true"')&&visitor.includes('data-dtf-topic="plant-biology"')){visitorOk=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'plant-biology-visitor.html'),visitor);
  if(!visitorOk) throw new Error('Visitor route did not expose the Plant Biology V6 marker and V3 owner.');
  if((visitor.match(/class="pb6-chapter"/g)||[]).length!==8) throw new Error('Visitor chapter count is not 8.');
  if((visitor.match(/class="pb6-lesson"/g)||[]).length!==30) throw new Error('Visitor lesson count is not 30.');
  for(const required of ['Plant Identity & Whole-Plant Morphology','Cells, Tissues & Meristems','Roots','Stems & Vascular Transport','Leaves, Stomata & Gas Exchange','Photosynthesis, Respiration & Water Relations','Hormones, Tropisms & Stress Responses','Flowers, Reproduction, Trichomes & Senescence']) if(!visitor.includes(required)) throw new Error(`Visitor route is missing chapter: ${required}`);

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:curriculum.route,chapters:8,lessons:30,visualTargets:curriculum.visualTargets.length,controlledEncyclopediaSources:allEncyclopediaIds.length,publishedEncyclopediaLinks:publishedEncyclopedia.size,visitorVerified:true,backupDir};
  await writeFile(join(backupDir,'plant-biology-v6-report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupRoot,'plant-biology-v6-report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){
    try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:true,reason:error.message},null,2)}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:false,reason:error.message,rollbackError:rollbackError.message},null,2)}\n`);}
  }
  throw error;
}
