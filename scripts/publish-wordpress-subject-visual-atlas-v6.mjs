import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_SUBJECT_VISUAL_ATLAS_V6||'').toLowerCase()==='true';
const mapPath=process.env.SUBJECT_VISUAL_MAP||'';
const curriculumPath=process.env.SUBJECT_CURRICULUM_PATH||'';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-subject-visual-atlas-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
if(!mapPath||!curriculumPath) throw new Error('SUBJECT_VISUAL_MAP and SUBJECT_CURRICULUM_PATH are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Subject-Visual-Atlas-V6/1.0'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const slugify=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const norm=v=>String(v||'').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'');
const rxEsc=v=>String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1500);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<8) await sleep(attempt*1500);}
  }
  throw last;
}
async function pageBySlug(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected one page, found ${Array.isArray(rows)?rows.length:'invalid'}.`);
  return rows[0];
}

const map=JSON.parse(await readFile(mapPath,'utf8'));
const curriculum=JSON.parse(await readFile(curriculumPath,'utf8'));
if(map?.schemaVersion!==1||curriculum?.schemaVersion!==1) throw new Error('Expected schemaVersion 1 for map and curriculum.');
if(map.curriculumId!==curriculum.id) throw new Error(`Visual map owner ${map.curriculumId} does not match curriculum ${curriculum.id}.`);
if(!/^\/learn\/[a-z0-9-]+\/$/.test(map.route||'')) throw new Error(`Unsafe or unexpected subject route: ${map.route}`);
if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) throw new Error('Expected exactly 8 curriculum chapters.');
const groups=Object.entries(map.chapters||{});
if(groups.length!==8) throw new Error(`Expected 8 visual groups, found ${groups.length}.`);
const curriculumIds=curriculum.chapters.map(c=>c.id);
const mapIds=groups.map(([id])=>id);
if(JSON.stringify([...curriculumIds].sort())!==JSON.stringify([...mapIds].sort())) throw new Error('Visual group IDs do not exactly match curriculum chapter IDs.');
const assets=groups.flatMap(([chapter,items])=>(items||[]).map(item=>({chapter,...item})));
if(!assets.length) throw new Error('Visual atlas must contain at least one reviewed asset.');
if(!Array.isArray(map.gaps)||map.gaps.some(g=>g.status!=='needed'||!g.id||!g.title||!g.neededVisual)) throw new Error('Every unresolved visual gap must be explicit and status=needed.');
for(const asset of assets){
  if(!asset.file||!asset.title||!asset.alt) throw new Error(`Incomplete visual mapping in ${asset.chapter}.`);
  if(!/\.(?:png|jpe?g|webp)$/i.test(asset.file)||/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(asset.file)) throw new Error(`Unsafe visual mapping: ${asset.file}`);
  await access(`site/wordpress/assets/infographics/${asset.file}`);
}

const topicId=String(curriculum.id).replace(/-v6$/,'');
const pageSlug=map.route.split('/').filter(Boolean).at(-1);
const v6Marker=`data-dtf-${curriculum.id}=\"true\"`;
const topicMarker=`data-dtf-topic=\"${topicId}\"`;
const v4Marker=`data-dtf-learning-v4=\"topic-${topicId}\"`;
const markerName=`dtf-subject-visuals-v6:${curriculum.id}`;
const startMarker=`<!-- ${markerName}:start -->`;
const endMarker=`<!-- ${markerName}:end -->`;
const dataAttr=`data-dtf-subject-visuals-v6=\"${curriculum.id}\"`;
const prefix=`sv6v-${slugify(topicId)}`;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`${slugify(topicId)}-${stamp}`);
await mkdir(backupDir,{recursive:true});

const media=[];
for(let page=1;page<=20;page+=1){
  let rows=[];
  try{rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);}catch(error){if(/rest_post_invalid_page_number|400/.test(error.message)) break;throw error;}
  if(!Array.isArray(rows)||rows.length===0) break;
  media.push(...rows);
  if(rows.length<100) break;
}
const mediaIndex=new Map();
for(const item of media){
  const source=String(item?.source_url||'');let base='';try{base=decodeURIComponent(new URL(source).pathname.split('/').pop()||'');}catch{}
  for(const key of [base,item?.slug,item?.title?.raw]) if(key&&!mediaIndex.has(norm(key))) mediaIndex.set(norm(key),item);
}
const rawBase='https://raw.githubusercontent.com/dtfgenetics/Thc/main/site/wordpress/assets/infographics/';
const resolved=assets.map(asset=>{const wp=mediaIndex.get(norm(asset.file));return {...asset,src:wp?.source_url||`${rawBase}${encodeURIComponent(asset.file).replaceAll('%2F','/')}`,source:wp?'wordpress':'github-canonical',mediaId:wp?.id||null};});
const chapterTitle=new Map(curriculum.chapters.map(c=>[c.id,c.title]));

function atlasHtml(){
  const chapterGroups=groups.map(([chapter])=>{
    const items=resolved.filter(x=>x.chapter===chapter);
    return `<section class="sv6v-group" id="${prefix}-${esc(chapter)}" data-sv6v-group="${esc(chapter)}"><div class="sv6v-head"><p class="sv6v-kicker">Chapter visual references</p><h3>${esc(chapterTitle.get(chapter)||chapter)}</h3><p>Only reviewed visuals that directly support this chapter are shown here.</p></div><div class="sv6v-grid">${items.map(item=>`<figure class="sv6v-card" data-sv6v-source="${item.source}"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt)}"></a><figcaption><strong>${esc(item.title)}</strong><span>${item.source==='wordpress'?'WordPress media · canonical asset':'Canonical asset fallback'}</span></figcaption></figure>`).join('')}</div></section>`;
  }).join('');
  const gaps=map.gaps.map(g=>`<article class="sv6v-gap"><span>Visual production gap</span><strong>${esc(g.title)}</strong><p>${esc(g.neededVisual)}</p></article>`).join('');
  return `${startMarker}<style id="${prefix}-style">
.sv6v{--ink:#14342b;--muted:#53675f;--line:#d5e0da;--gold:#887432;background:#edf3ef;color:var(--ink);padding:68px 0 76px}.sv6v *{box-sizing:border-box}.sv6v-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.sv6v-kicker{margin:0 0 7px;color:var(--gold);font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.sv6v-intro{display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:24px}.sv6v-intro>div{max-width:780px}.sv6v h2{margin:0;font-size:clamp(2.2rem,4vw,3.8rem);line-height:.98;letter-spacing:-.04em}.sv6v h3{margin:0;font-size:clamp(1.55rem,3vw,2.35rem);letter-spacing:-.025em}.sv6v p{color:var(--muted);line-height:1.65}.sv6v-summary{padding:14px 17px;border-radius:14px;background:#fff;border:1px solid var(--line);font-weight:850}.sv6v-group{padding:30px 0;border-top:1px solid #cfddd6}.sv6v-head{max-width:820px;margin-bottom:15px}.sv6v-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.sv6v-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,48,35,.05)}.sv6v-card a{display:block;background:#e5ede9;aspect-ratio:4/3;overflow:hidden}.sv6v-card img{width:100%;height:100%;object-fit:contain;display:block}.sv6v-card figcaption{padding:13px 14px}.sv6v-card strong{display:block;line-height:1.3}.sv6v-card span{display:block;margin-top:5px;color:#718079;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.sv6v-gaps{margin-top:34px;padding:22px;border-radius:19px;background:#fff9ed;border:1px solid #e7d6ae}.sv6v-gap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.sv6v-gap{padding:14px;border-radius:13px;background:#fff;border:1px solid #eadfc7}.sv6v-gap span{display:block;color:#887432;font-size:.65rem;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.sv6v-gap strong{display:block;margin:5px 0}.sv6v-gap p{margin:0;font-size:.91rem}@media(max-width:860px){.sv6v-intro{align-items:flex-start;flex-direction:column}.sv6v-grid,.sv6v-gap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.sv6v{padding:50px 0 58px}.sv6v-wrap{width:min(100% - 26px,1180px)}.sv6v-grid,.sv6v-gap-grid{grid-template-columns:1fr}}
</style><section class="sv6v" data-dtf-subject-visuals-v6="${esc(curriculum.id)}"><div class="sv6v-wrap"><div class="sv6v-intro"><div><p class="sv6v-kicker">${esc(curriculum.title)} visual atlas</p><h2>Use diagrams to understand the system—not to replace measurement.</h2><p>The curriculum is paired only with reviewed visuals already in the publication library. Missing mechanisms remain explicit production targets instead of being filled with loosely related cannabis imagery.</p></div><div class="sv6v-summary">${resolved.length} verified visuals · 8 chapter groups</div></div>${chapterGroups}<section class="sv6v-gaps"><p class="sv6v-kicker">Still needs dedicated visual production</p><h3>${map.gaps.length} diagrams remain intentionally open.</h3><p>These topics require purpose-built, reviewed graphics. Near-match artwork will not be substituted.</p><div class="sv6v-gap-grid">${gaps}</div></section></div></section>${endMarker}`;
}

const page=await pageBySlug(pageSlug);
const before=rendered(page.content);
if(!before.includes(v6Marker)) throw new Error(`${curriculum.title} V6 curriculum is not live; refusing to attach atlas.`);
if(!before.includes(topicMarker)||!before.includes(v4Marker)) throw new Error(`${curriculum.title} lost V3/V4 ownership markers.`);
const blockRx=new RegExp(`${rxEsc(startMarker)}[\\s\\S]*?${rxEsc(endMarker)}`,'g');
const clean=before.replace(blockRx,'').trim();
const next=`${clean}\n${atlasHtml()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug(pageSlug)).content);
  if(!edit.includes(dataAttr)) throw new Error('Edit-context subject visual atlas marker missing.');
  if((edit.match(/class="sv6v-card"/g)||[]).length!==resolved.length) throw new Error(`Edit-context visual count is not ${resolved.length}.`);
  if((edit.match(/data-sv6v-group=/g)||[]).length!==8) throw new Error('Edit-context chapter group count is not 8.');
  if((edit.match(/class="sv6v-gap"/g)||[]).length!==map.gaps.length) throw new Error(`Edit-context gap count is not ${map.gaps.length}.`);
  const publishedBlock=edit.match(new RegExp(`${rxEsc(startMarker)}[\\s\\S]*?${rxEsc(endMarker)}`))?.[0]||'';
  if(/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(publishedBlock)) throw new Error('Unsafe asset-state label found in published atlas.');

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${map.route}?dtf_sv6v=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Subject-Visual-Atlas-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
      visitor=await response.text();
      if(response.ok&&visitor.includes(dataAttr)){ok=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor subject visual atlas marker missing.');
  if((visitor.match(/class="sv6v-card"/g)||[]).length!==resolved.length) throw new Error(`Visitor visual count is not ${resolved.length}.`);
  if((visitor.match(/data-sv6v-group=/g)||[]).length!==8) throw new Error('Visitor chapter group count is not 8.');
  if((visitor.match(/class="sv6v-gap"/g)||[]).length!==map.gaps.length) throw new Error(`Visitor gap count is not ${map.gaps.length}.`);
  for(const marker of [v6Marker,topicMarker,v4Marker]) if(!visitor.includes(marker)) throw new Error(`Visitor page lost required owner marker: ${marker}`);

  const report={generatedAt:new Date().toISOString(),apply,curriculumId:curriculum.id,title:curriculum.title,pageId:page.id,route:map.route,visuals:resolved.length,groups:8,wordpressMedia:resolved.filter(x=>x.source==='wordpress').length,canonicalFallbacks:resolved.filter(x=>x.source!=='wordpress').length,unresolvedGaps:map.gaps.map(g=>g.id),visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.txt'),`Restored page ${page.id} after failure: ${error.message}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback-error.txt'),`${rollbackError.message}\n`);}}
  throw error;
}
