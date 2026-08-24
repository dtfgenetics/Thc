import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_NUTRITION_MEDIA_V6||'').toLowerCase()==='true';
const curriculumPath=process.env.NUTRITION_MEDIA_V6_PATH||'site/wordpress/education/nutrition-media-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-nutrition-media-v6-final';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`nutrition-media-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Nutrition-Media-V6/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1600);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<8) await sleep(attempt*1600);}
  }
  throw last;
}
async function pageBySlug(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected exactly one page, found ${Array.isArray(rows)?rows.length:'invalid response'}.`);return rows[0];}

const curriculum=JSON.parse(await readFile(curriculumPath,'utf8'));
if(curriculum?.schemaVersion!==1||curriculum?.id!=='nutrition-media-v6') throw new Error('Invalid Nutrition & Media V6 curriculum.');
if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) throw new Error('Expected exactly 8 Nutrition & Media chapters.');
const lessonCount=curriculum.chapters.reduce((n,c)=>n+(c.lessons||[]).length,0);
if(lessonCount!==32) throw new Error(`Expected 32 Nutrition & Media lessons, found ${lessonCount}.`);
const chapterIds=curriculum.chapters.map(c=>c.id);
if(new Set(chapterIds).size!==8) throw new Error('Nutrition & Media chapter IDs are not unique.');
for(const chapter of curriculum.chapters){if(!chapter.title||!chapter.objective||!Array.isArray(chapter.encyclopediaIds)||!(chapter.knowledgeChecks||[]).length||(chapter.lessons||[]).length!==4) throw new Error(`${chapter.id}: incomplete chapter.`);for(const lesson of chapter.lessons) if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!(lesson.concepts||[]).length) throw new Error(`${chapter.id}: incomplete lesson.`);}

function referencePath(id){
  const n=Number(String(id).slice(-3));
  if(n>=46&&n<=60) return `content/encyclopedia/volume-03/lessons/thc-enc-${String(n).padStart(3,'0')}.json`;
  if(n>=121&&n<=140) return `content/encyclopedia/volume-07/lessons/thc-enc-${String(n).padStart(3,'0')}.json`;
  throw new Error(`Nutrition & Media V6 reference outside controlled media/nutrition boundaries: ${id}`);
}
const referenceIds=[...new Set(curriculum.chapters.flatMap(c=>c.encyclopediaIds||[]))];
const referenceTitles=new Map();
for(const id of referenceIds){const item=JSON.parse(await readFile(referencePath(id),'utf8'));if(item.id!==id||!item.title||!item.objective) throw new Error(`${id}: incomplete controlled source.`);referenceTitles.set(id,item.title);}
const publicRefs=new Set();
for(const id of referenceIds){try{const rows=await request(`/wp-json/wp/v2/pages?slug=${id.toLowerCase()}&context=edit&per_page=5`);if(Array.isArray(rows)&&rows.some(x=>x.status==='publish')) publicRefs.add(id);}catch{}}
const refCard=id=>`<a class="nm6-ref" href="${publicRefs.has(id)?`/learn/encyclopedia/${id.toLowerCase()}/`:'/learn/encyclopedia/'}"><span>${esc(id)}</span><strong>${esc(referenceTitles.get(id)||id)}</strong></a>`;
const lessonHtml=(lesson,i)=>`<details class="nm6-lesson"><summary><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="nm6-body"><p>${esc(lesson.summary)}</p><div class="nm6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="nm6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
const chapterHtml=chapter=>`<section class="nm6-chapter" id="nm6-${esc(chapter.id)}" data-nm6-chapter="${esc(chapter.id)}"><div class="nm6-chapter-head"><div><p class="nm6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#nm6-top">Back to chapters ↑</a></div><div class="nm6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="nm6-bottom"><article><p class="nm6-kicker">Knowledge check</p><h4>Explain these before moving on</h4><ol>${chapter.knowledgeChecks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></article><article><p class="nm6-kicker">Controlled deep reference</p><h4>Related reviewed nutrition and media lessons</h4><div class="nm6-refs">${chapter.encyclopediaIds.map(refCard).join('')}</div></article></div></section>`;

function block(pageId){return `<!-- dtf-nutrition-media-v6:start --><style id="dtf-nutrition-media-v6-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}.nm6{--deep:#102115;--forest:#244529;--green:#4f7c45;--gold:#d7bb6e;--cream:#f7f4e9;--paper:#fffdf7;--ink:#233727;--muted:#5c6b5d;--line:#dce3d8;background:linear-gradient(180deg,#f7f4e9,#eef3e9);color:var(--ink);padding:70px 0 78px}.nm6 *{box-sizing:border-box}.nm6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.nm6-kicker{margin:0 0 8px;color:#806d32;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.nm6-intro{display:grid;grid-template-columns:1.08fr .92fr;gap:28px}.nm6 h2{margin:0;font-size:clamp(2.35rem,5vw,4.6rem);line-height:.96;letter-spacing:-.05em}.nm6 h3{margin:0;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1;letter-spacing:-.035em}.nm6 h4{margin:0 0 8px}.nm6 p{color:var(--muted);line-height:1.68}.nm6-lede{font-size:1.08rem}.nm6-stats{padding:24px;border-radius:23px;background:linear-gradient(145deg,var(--deep),var(--forest));color:#fff}.nm6-stats strong{display:block;color:var(--gold);font-size:2.35rem;line-height:1}.nm6-stats p{color:#d5ded2;margin:7px 0 16px}.nm6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 55px}.nm6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.nm6-nav span{display:block;color:#806d32;font-size:.67rem;margin-bottom:3px}.nm6-chapter{padding:42px 0;border-top:1px solid var(--line)}.nm6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.nm6-chapter-head>div{max-width:820px}.nm6-chapter-head>a{white-space:nowrap;color:var(--green)!important;font-weight:900;text-decoration:none!important}.nm6-lessons{display:grid;gap:10px}.nm6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.nm6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.nm6-lesson summary::-webkit-details-marker{display:none}.nm6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-weight:950;font-size:1.3rem}.nm6-lesson[open] summary:after{content:'–'}.nm6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e9efe3;color:#526c48;font-size:.7rem;font-weight:950}.nm6-body{padding:0 19px 19px 64px}.nm6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.nm6-concepts span{padding:5px 8px;border-radius:999px;background:#eef3e9;border:1px solid #dbe4d5;color:#4b6148;font-size:.71rem;font-weight:850}.nm6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.nm6-two article,.nm6-bottom>article{padding:15px;border-radius:14px;background:#f3f6ef;border:1px solid #dfe6db}.nm6-two article:last-child{background:#fff9ed;border-color:#e7dbc2}.nm6-two p{margin:0;font-size:.94rem}.nm6-bottom{display:grid;grid-template-columns:.82fr 1.18fr;gap:14px;margin-top:15px}.nm6-bottom li{margin:7px 0;color:#485a49;line-height:1.5}.nm6-refs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.nm6-ref{display:block;padding:10px;border-radius:11px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important}.nm6-ref span{display:block;color:#806d32;font-size:.64rem;font-weight:950}.nm6-ref strong{display:block;margin-top:3px;font-size:.87rem}.nm6-deep{margin-top:40px;padding:26px;border-radius:22px;background:linear-gradient(145deg,#142c18,#29482a);color:#fff}.nm6-deep p{color:#d1ddd0}.nm6-routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.nm6-routes a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.nm6-visuals{margin-top:18px;padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}.nm6-visuals ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0;list-style:none}.nm6-visuals li{padding:10px;border-radius:11px;background:#f3f6ef;color:#485a49}
@media(max-width:920px){.nm6-intro,.nm6-bottom{grid-template-columns:1fr}.nm6-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.nm6-routes,.nm6-visuals ul{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.nm6{padding:52px 0 60px}.nm6-wrap{width:min(100% - 26px,1180px)}.nm6-nav,.nm6-two,.nm6-refs,.nm6-routes,.nm6-visuals ul{grid-template-columns:1fr}.nm6-chapter-head{align-items:flex-start;flex-direction:column}.nm6-body{padding:0 15px 17px}}
</style><section class="nm6" data-dtf-nutrition-media-v6="true" id="nm6-top"><div class="nm6-wrap"><div class="nm6-intro"><div><p class="nm6-kicker">Teaching Healthy Cultivation · Nutrition as a measured system</p><h2>Nutrition & Media, beyond bottle recipes.</h2><p class="nm6-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="nm6-stats"><strong>8</strong><p>connected chapters</p><strong>32</strong><p>focused lessons</p><strong>${publicRefs.size}</strong><p>controlled media and nutrition encyclopedia pages linked directly</p></aside></div><nav class="nm6-nav">${curriculum.chapters.map(c=>`<a href="#nm6-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(chapterHtml).join('')}<section class="nm6-deep"><p class="nm6-kicker">Continue deeper</p><h3>Connect nutrient chemistry to water, roots, environment and diagnosis.</h3><p>This curriculum intentionally does not publish one universal feed chart, N-P-K ratio, Cal-Mag dose, pH decimal or EC target. Media, water chemistry, stage, genotype, root condition, environment, sampling method and total elemental delivery all change interpretation.</p><div class="nm6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section><section class="nm6-visuals"><p class="nm6-kicker">Visual study map</p><h3>Core diagrams this section should teach with.</h3><ul>${curriculum.visualTargets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div></section><!-- dtf-nutrition-media-v6:end -->`;}

const page=await pageBySlug('nutrition-media');
const before=rendered(page.content);
if(!before.includes('data-dtf-topic="nutrition-media"')) throw new Error('Nutrition & Media is not the expected V3 subject owner.');
if(!before.includes('data-dtf-learning-v4="topic-nutrition-media"')) throw new Error('Nutrition & Media is missing its V4 guided-learning layer.');
const clean=before.replace(/<!-- dtf-nutrition-media-v6:start -->[\s\S]*?<!-- dtf-nutrition-media-v6:end -->/g,'').trim();
const next=`${clean}\n${block(page.id)}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);await writeFile(join(backupDir,'next.html'),next);let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('nutrition-media')).content);
  if(!edit.includes('data-dtf-nutrition-media-v6="true"')||(edit.match(/data-nm6-chapter=/g)||[]).length!==8||(edit.match(/class="nm6-lesson"/g)||[]).length!==32) throw new Error('Nutrition & Media edit-context count/marker verification failed.');
  for(const id of chapterIds) if(!edit.includes(`data-nm6-chapter="${id}"`)) throw new Error(`Edit-context chapter missing: ${id}`);
  let visitor='';let ok=false;for(let attempt=1;attempt<=8;attempt+=1){try{const r=await fetch(`${site}/learn/nutrition-media/?dtf_nm6=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Nutrition-Media-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});visitor=await r.text();if(r.ok&&visitor.includes('data-dtf-nutrition-media-v6="true"')){ok=true;break;}}catch{}await sleep(attempt*1800);}await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok||(visitor.match(/data-nm6-chapter=/g)||[]).length!==8||(visitor.match(/class="nm6-lesson"/g)||[]).length!==32) throw new Error('Nutrition & Media visitor count/marker verification failed.');
  if(!visitor.includes('data-dtf-topic="nutrition-media"')||!visitor.includes('data-dtf-learning-v4="topic-nutrition-media"')) throw new Error('Visitor page lost V3/V4 Nutrition owner markers.');
  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/nutrition-media/',chapters:8,lessons:32,visualTargets:curriculum.visualTargets.length,controlledReferenceIds:referenceIds.length,publishedReferencePages:publicRefs.size,visitorVerified:true,backupDir};await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
}catch(error){await writeFile(join(backupDir,'error.txt'),`${error.stack||error.message}\n`);if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:page.status||'publish'})});await writeFile(join(backupDir,'rollback.txt'),'Prior Nutrition & Media page restored.\n');}catch(rollbackError){await writeFile(join(backupDir,'rollback-error.txt'),`${rollbackError.stack||rollbackError.message}\n`);}}throw error;}
