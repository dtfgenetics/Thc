import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_LIGHTING_VISUALS_V6||'').toLowerCase()==='true';
const mapPath=process.env.LIGHTING_VISUAL_MAP||'site/wordpress/education/lighting-v6-visual-map.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-lighting-visuals-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Lighting-Visuals-V6/1.0'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`lighting-visuals-${stamp}`);
await mkdir(backupDir,{recursive:true});

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
if(map?.schemaVersion!==1||map?.curriculumId!=='lighting-v6') throw new Error('Invalid Lighting V6 visual map.');
const entries=Object.entries(map.chapters||{});
if(entries.length!==8) throw new Error(`Expected 8 Lighting chapter visual groups, found ${entries.length}.`);
const assets=entries.flatMap(([chapter,items])=>(items||[]).map(item=>({chapter,...item})));
if(assets.length!==12) throw new Error(`Expected 12 mapped canonical Lighting visuals, found ${assets.length}.`);
for(const asset of assets){
  if(!asset.file||/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(asset.file)) throw new Error(`Unsafe Lighting visual mapping: ${asset.file}`);
  await access(`site/wordpress/assets/infographics/${asset.file}`);
}
if(!Array.isArray(map.gaps)||map.gaps.length!==5||map.gaps.some(g=>g.status!=='needed')) throw new Error('Expected exactly five explicitly unresolved Lighting visual gaps.');

const media=[];
for(let page=1;page<=5;page+=1){
  let rows=[];
  try{rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);}catch(error){if(/rest_post_invalid_page_number|400/.test(error.message)) break;throw error;}
  if(!Array.isArray(rows)||rows.length===0) break;
  media.push(...rows);
  if(rows.length<100) break;
}
const norm=v=>String(v||'').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'');
const mediaIndex=new Map();
for(const item of media){
  const source=String(item?.source_url||'');let base='';try{base=decodeURIComponent(new URL(source).pathname.split('/').pop()||'');}catch{}
  for(const key of [base,item?.slug,item?.title?.raw]) if(key) mediaIndex.set(norm(key),item);
}
const rawBase='https://raw.githubusercontent.com/dtfgenetics/Thc/main/site/wordpress/assets/infographics/';
const resolved=assets.map(asset=>{
  const wp=mediaIndex.get(norm(asset.file));
  return {...asset,src:wp?.source_url||`${rawBase}${encodeURIComponent(asset.file).replaceAll('%2F','/')}`,source:wp?'wordpress':'github-canonical',mediaId:wp?.id||null};
});

const titleByChapter={
  'photon-language-bands':'Photon Language & Measurement Bands',
  'fixture-output-delivery':'Fixture Output → Canopy Delivery',
  'ppfd-mapping-uniformity':'PPFD Mapping & Uniformity',
  'dli-photoperiod-timing':'DLI, Photoperiod & Timing',
  'spectrum-source-signaling':'Spectrum, Sources & Signaling',
  'photosynthetic-response-canopy-use':'Photosynthetic Response & Canopy Use',
  'high-light-stress-acclimation':'High-Light Stress & Acclimation',
  'verification-records-change-control':'Verification, Records & Change Control'
};

function atlas(){
  const groups=entries.map(([chapter])=>{
    const items=resolved.filter(x=>x.chapter===chapter);
    const empty=items.length===0?'<div class="li6v-empty"><strong>No exact approved visual yet.</strong><p>This chapter remains text-supported until its dedicated diagram below is produced and reviewed.</p></div>':'';
    return `<section class="li6v-group" id="li6v-${esc(chapter)}" data-li6v-group="${esc(chapter)}"><div class="li6v-head"><p class="li6v-kicker">Chapter visual references</p><h3>${esc(titleByChapter[chapter]||chapter)}</h3><p>Only visuals that directly support the measurement, plant-physiology or timing concept are shown here.</p></div>${empty}<div class="li6v-grid">${items.map(item=>`<figure class="li6v-card" data-li6v-source="${item.source}"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt)}"></a><figcaption><strong>${esc(item.title)}</strong><span>${item.source==='wordpress'?'WordPress media · canonical asset':'Canonical asset fallback'}</span></figcaption></figure>`).join('')}</div></section>`;
  }).join('');
  const gaps=map.gaps.map(g=>`<article class="li6v-gap"><span>Visual production gap</span><strong>${esc(g.title)}</strong><p>${esc(g.neededVisual)}</p></article>`).join('');
  return `<!-- dtf-lighting-visuals-v6:start --><style id="dtf-lighting-visuals-v6-style">
.li6v{--ink:#143027;--muted:#53675f;--line:#d7e2dc;--gold:#887432;background:#eef3ef;color:var(--ink);padding:68px 0 76px}.li6v *{box-sizing:border-box}.li6v-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.li6v-kicker{margin:0 0 7px;color:var(--gold);font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.li6v-intro{display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:24px}.li6v-intro>div{max-width:760px}.li6v h2{margin:0;font-size:clamp(2.2rem,4vw,3.7rem);line-height:.98;letter-spacing:-.04em}.li6v h3{margin:0;font-size:clamp(1.55rem,3vw,2.35rem);letter-spacing:-.025em}.li6v p{color:var(--muted);line-height:1.65}.li6v-summary{padding:14px 17px;border-radius:14px;background:#fff;border:1px solid var(--line);font-weight:850}.li6v-group{padding:30px 0;border-top:1px solid #d4dfd8}.li6v-head{max-width:820px;margin-bottom:15px}.li6v-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.li6v-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,48,35,.05)}.li6v-card a{display:block;background:#e7eee9;aspect-ratio:4/3;overflow:hidden}.li6v-card img{width:100%;height:100%;object-fit:contain;display:block}.li6v-card figcaption{padding:13px 14px}.li6v-card strong{display:block;line-height:1.3}.li6v-card span{display:block;margin-top:5px;color:#718079;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.li6v-empty{max-width:650px;padding:15px;border-radius:13px;background:#fff9ed;border:1px solid #e7d6ae;margin-bottom:14px}.li6v-empty p{margin:4px 0 0;font-size:.92rem}.li6v-gaps{margin-top:34px;padding:22px;border-radius:19px;background:#fff9ed;border:1px solid #e7d6ae}.li6v-gap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.li6v-gap{padding:14px;border-radius:13px;background:#fff;border:1px solid #eadfc7}.li6v-gap span{display:block;color:#887432;font-size:.65rem;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.li6v-gap strong{display:block;margin:5px 0}.li6v-gap p{margin:0;font-size:.91rem}@media(max-width:860px){.li6v-intro{align-items:flex-start;flex-direction:column}.li6v-grid,.li6v-gap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.li6v{padding:50px 0 58px}.li6v-wrap{width:min(100% - 26px,1180px)}.li6v-grid,.li6v-gap-grid{grid-template-columns:1fr}}
</style><section class="li6v" data-dtf-lighting-visuals-v6="true"><div class="li6v-wrap"><div class="li6v-intro"><div><p class="li6v-kicker">Lighting visual atlas</p><h2>See the biology and measurement behind the number.</h2><p>The 32-lesson Lighting curriculum is paired with approved plant-physiology and timing visuals already in the publication library. Chapters without an exact measurement diagram remain visibly open rather than being filled with a misleading near-match.</p></div><div class="li6v-summary">12 verified visuals · 8 chapter groups</div></div>${groups}<section class="li6v-gaps"><p class="li6v-kicker">Still needs dedicated visual production</p><h3>Five Lighting diagrams remain intentionally open.</h3><p>The verified private DLI/PPFD poster is tracked here until its exact binary can be source-migrated safely. The other gaps need purpose-built reviewed graphics rather than generic lighting artwork.</p><div class="li6v-gap-grid">${gaps}</div></section></div></section><!-- dtf-lighting-visuals-v6:end -->`;
}

const page=await pageBySlug('lighting');
const before=rendered(page.content);
if(!before.includes('data-dtf-lighting-v6="true"')) throw new Error('Lighting V6 curriculum is not live; refusing to publish visual atlas onto an older page.');
if(!before.includes('data-dtf-topic="lighting"')||!before.includes('data-dtf-learning-v4="topic-lighting"')) throw new Error('Lighting V3/V4 owner markers are missing.');
const clean=before.replace(/<!-- dtf-lighting-visuals-v6:start -->[\s\S]*?<!-- dtf-lighting-visuals-v6:end -->/g,'').trim();
const next=`${clean}\n${atlas()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('lighting')).content);
  if(!edit.includes('data-dtf-lighting-visuals-v6="true"')) throw new Error('Edit-context Lighting visual atlas marker missing.');
  if((edit.match(/class="li6v-card"/g)||[]).length!==12) throw new Error('Edit-context Lighting visual count is not 12.');
  if((edit.match(/data-li6v-group=/g)||[]).length!==8) throw new Error('Edit-context Lighting visual chapter count is not 8.');
  if((edit.match(/class="li6v-gap"/g)||[]).length!==5) throw new Error('Edit-context Lighting visual gap count is not 5.');
  const atlasHtml=edit.match(/<!-- dtf-lighting-visuals-v6:start -->[\s\S]*?<!-- dtf-lighting-visuals-v6:end -->/)?.[0]||'';
  if(/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(atlasHtml)) throw new Error('Unsafe visual label found in published Lighting atlas.');
  if(/DLI_PPFD_Light_Education_Infographic\.png/i.test(atlasHtml)) throw new Error('Private-source DLI/PPFD poster must not appear until exact binary migration succeeds.');

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}/learn/lighting/?dtf_li6v=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Lighting-Visuals-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
      visitor=await response.text();
      if(response.ok&&visitor.includes('data-dtf-lighting-visuals-v6="true"')){ok=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor Lighting visual atlas marker missing.');
  if((visitor.match(/class="li6v-card"/g)||[]).length!==12) throw new Error('Visitor Lighting visual count is not 12.');
  if((visitor.match(/data-li6v-group=/g)||[]).length!==8) throw new Error('Visitor Lighting visual chapter count is not 8.');
  if((visitor.match(/class="li6v-gap"/g)||[]).length!==5) throw new Error('Visitor Lighting visual gap count is not 5.');
  if(!visitor.includes('data-dtf-lighting-v6="true"')||!visitor.includes('data-dtf-topic="lighting"')||!visitor.includes('data-dtf-learning-v4="topic-lighting"')) throw new Error('Visitor page lost Lighting curriculum or owner markers.');

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,visuals:12,groups:8,wordpressMedia:resolved.filter(x=>x.source==='wordpress').length,canonicalFallbacks:resolved.filter(x=>x.source!=='wordpress').length,unresolvedGaps:map.gaps.map(g=>g.id),visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){
    try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.txt'),`Rolled back after failure: ${error.message}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback.txt'),`ROLLBACK FAILED after ${error.message}: ${rollbackError.message}\n`);}
  }
  throw error;
}
