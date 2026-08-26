import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_OUTDOOR_VISUALS_V6||'').toLowerCase()==='true';
const mapPath=process.env.OUTDOOR_VISUAL_MAP||'site/wordpress/education/outdoor-v6-visual-map.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-outdoor-visuals-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Outdoor-Visuals-V6/1.0'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`outdoor-visuals-${stamp}`);
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
async function pageBySlug(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected one page, found ${Array.isArray(rows)?rows.length:'invalid'}.`);return rows[0];}

const map=JSON.parse(await readFile(mapPath,'utf8'));
if(map?.schemaVersion!==1||map?.curriculumId!=='outdoor-v6'||map?.route!=='/learn/outdoor/') throw new Error('Invalid Outdoor V6 visual map.');
const expectedIds=['site-sun','hardening-transplant','water-rootzone','wind-support','rain-flower-risk','pests-wildlife','pollen-sex','season-microclimate'];
const entries=Object.entries(map.chapters||{});
if(entries.length!==8||expectedIds.some(id=>!Object.hasOwn(map.chapters,id))) throw new Error('Outdoor visual map must contain the eight stable V6 chapter groups.');
const assets=entries.flatMap(([chapter,items])=>(items||[]).map(item=>({chapter,...item})));
if(assets.length!==12) throw new Error(`Expected 12 mapped approved supporting visuals, found ${assets.length}.`);
for(const asset of assets){
  if(!asset.file||/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(asset.file)) throw new Error(`Unsafe visual mapping: ${asset.file}`);
  await access(`site/wordpress/assets/infographics/${asset.file}`);
}
if(!Array.isArray(map.gaps)||map.gaps.length!==11) throw new Error('Expected exactly eleven Outdoor production gaps.');
for(const gap of map.gaps){if(!/^THC-OUT-\d{2}$/.test(gap.id)||gap.status!=='artwork-needed'||!gap.title||!gap.neededVisual) throw new Error(`Invalid Outdoor gap ${gap.id||'unknown'}.`);}

const media=[];
for(let page=1;page<=6;page+=1){
  let rows=[];
  try{rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);}catch(error){if(/rest_post_invalid_page_number|400/.test(error.message)) break; throw error;}
  if(!Array.isArray(rows)||rows.length===0) break;
  media.push(...rows);if(rows.length<100) break;
}
const norm=v=>String(v||'').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'');
const mediaIndex=new Map();
for(const item of media){
  const source=String(item?.source_url||'');let base='';try{base=decodeURIComponent(new URL(source).pathname.split('/').pop()||'');}catch{}
  for(const key of [base,item?.slug,item?.title?.raw]) if(key) mediaIndex.set(norm(key),item);
}
const rawBase='https://raw.githubusercontent.com/dtfgenetics/Thc/main/site/wordpress/assets/infographics/';
const resolved=assets.map(asset=>{const wp=mediaIndex.get(norm(asset.file));return {...asset,src:wp?.source_url||`${rawBase}${encodeURIComponent(asset.file).replaceAll('%2F','/')}`,source:wp?'wordpress':'github-canonical',mediaId:wp?.id||null};});

const titleByChapter={
  'site-sun':'Site Selection & Seasonal Sun',
  'hardening-transplant':'Hardening Off & Transplant Establishment',
  'water-rootzone':'Outdoor Water, Irrigation & Root-Zone Balance',
  'wind-support':'Wind, Support & Canopy Architecture',
  'rain-flower-risk':'Rain, Humidity & Flower Disease Risk',
  'pests-wildlife':'Pests, Wildlife & Outdoor Biosecurity',
  'pollen-sex':'Pollen Drift, Sex Expression & Neighbor Risk',
  'season-microclimate':'Seasonal Planning, Microclimates & Records'
};
function atlas(){
  const groups=entries.map(([chapter])=>{
    const items=resolved.filter(x=>x.chapter===chapter);
    const empty=items.length===0?'<div class="outv6-empty"><strong>No exact approved supporting visual yet.</strong><p>This chapter remains curriculum-first until its purpose-built THC-OUT artwork passes scientific and visual QA.</p></div>':'';
    return `<section class="outv6-group" id="outv6-${esc(chapter)}" data-outv6-group="${esc(chapter)}"><div class="outv6-head"><p class="outv6-kicker">Chapter visual references</p><h3>${esc(titleByChapter[chapter]||chapter)}</h3><p>Only existing visuals that directly support this chapter's science are shown. Outdoor-specific artwork that does not yet exist remains listed below as a production gap.</p></div>${empty}<div class="outv6-grid">${items.map(item=>`<figure class="outv6-card" data-outv6-source="${item.source}"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt)}"></a><figcaption><strong>${esc(item.title)}</strong><span>${item.source==='wordpress'?'WordPress media · approved supporting asset':'Canonical approved asset fallback'}</span></figcaption></figure>`).join('')}</div></section>`;
  }).join('');
  const gaps=map.gaps.map(g=>`<article class="outv6-gap" data-outv6-gap="${esc(g.id)}"><span>${esc(g.id)} · artwork needed</span><strong>${esc(g.title)}</strong><p>${esc(g.neededVisual)}</p></article>`).join('');
  return `<!-- dtf-outdoor-visuals-v6:start --><style id="dtf-outdoor-visuals-v6-style">
.outv6{--ink:#173020;--muted:#58685d;--line:#d8e1d7;--gold:#887432;background:#eef3e9;color:var(--ink);padding:68px 0 76px}.outv6 *{box-sizing:border-box}.outv6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.outv6-kicker{margin:0 0 7px;color:var(--gold);font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.outv6-intro{display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:24px}.outv6-intro>div{max-width:790px}.outv6 h2{margin:0;font-size:clamp(2.2rem,4vw,3.7rem);line-height:.98;letter-spacing:-.04em}.outv6 h3{margin:0;font-size:clamp(1.55rem,3vw,2.35rem);letter-spacing:-.025em}.outv6 p{color:var(--muted);line-height:1.65}.outv6-summary{padding:14px 17px;border-radius:14px;background:#fff;border:1px solid var(--line);font-weight:850}.outv6-group{padding:30px 0;border-top:1px solid #d4ddd1}.outv6-head{max-width:850px;margin-bottom:15px}.outv6-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.outv6-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(30,58,35,.05)}.outv6-card a{display:block;background:#e7ede3;aspect-ratio:4/3;overflow:hidden}.outv6-card img{width:100%;height:100%;object-fit:contain;display:block}.outv6-card figcaption{padding:13px 14px}.outv6-card strong{display:block;line-height:1.3}.outv6-card span{display:block;margin-top:5px;color:#718075;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.outv6-empty{max-width:650px;padding:15px;border-radius:13px;background:#fff9ed;border:1px solid #e7d6ae;margin-bottom:14px}.outv6-empty p{margin:4px 0 0;font-size:.92rem}.outv6-gaps{margin-top:34px;padding:22px;border-radius:19px;background:#fff9ed;border:1px solid #e7d6ae}.outv6-gap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.outv6-gap{padding:14px;border-radius:13px;background:#fff;border:1px solid #eadfc7}.outv6-gap span{display:block;color:#887432;font-size:.65rem;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.outv6-gap strong{display:block;margin:5px 0}.outv6-gap p{margin:0;font-size:.91rem}
@media(max-width:860px){.outv6-intro{align-items:flex-start;flex-direction:column}.outv6-grid,.outv6-gap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.outv6{padding:50px 0 58px}.outv6-wrap{width:min(100% - 26px,1180px)}.outv6-grid,.outv6-gap-grid{grid-template-columns:1fr}}
</style><section class="outv6" data-dtf-outdoor-visuals-v6="true"><div class="outv6-wrap"><div class="outv6-intro"><div><p class="outv6-kicker">Outdoor cultivation visual atlas</p><h2>Use site, weather and plant evidence—not outdoor folklore.</h2><p>The Outdoor V6 curriculum is paired with approved supporting plant-science visuals already in the publication library. Eleven purpose-built Outdoor graphics remain explicitly queued for original production and QA; unrelated stock or generic cannabis imagery is not substituted.</p></div><div class="outv6-summary">12 approved supporting visuals · 8 chapter groups · 11 queued originals</div></div>${groups}<section class="outv6-gaps"><p class="outv6-kicker">Purpose-built Outdoor artwork queue</p><h3>Eleven diagrams remain intentionally open.</h3><p>These THC-OUT assets already have evidence-aware production briefs. They remain artwork-needed until scientific, visual, label/spelling and page-placement QA are complete.</p><div class="outv6-gap-grid">${gaps}</div></section></div></section><!-- dtf-outdoor-visuals-v6:end -->`;
}

const page=await pageBySlug('outdoor');
const before=rendered(page.content);
if(!before.includes('data-dtf-outdoor-v6="true"')) throw new Error('Outdoor V6 curriculum is not live; refusing to publish the visual atlas onto an older page.');
if(!before.includes('data-dtf-topic="outdoor-cultivation"')) throw new Error('Outdoor page lost its canonical V3 topic owner marker.');
const clean=before.replace(/<!-- dtf-outdoor-visuals-v6:start -->[\s\S]*?<!-- dtf-outdoor-visuals-v6:end -->/g,'').trim();
const next=`${clean}\n${atlas()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('outdoor')).content);
  if(!edit.includes('data-dtf-outdoor-visuals-v6="true"')) throw new Error('Edit-context Outdoor visual atlas marker missing.');
  if((edit.match(/class="outv6-card"/g)||[]).length!==12) throw new Error('Edit-context visual count is not 12.');
  if((edit.match(/data-outv6-group=/g)||[]).length!==8) throw new Error('Edit-context visual chapter count is not 8.');
  if((edit.match(/class="outv6-gap"/g)||[]).length!==11) throw new Error('Edit-context Outdoor gap count is not 11.');
  if(!edit.includes('data-dtf-outdoor-v6="true"')||!edit.includes('data-dtf-topic="outdoor-cultivation"')) throw new Error('Edit-context Outdoor owner markers were lost.');
  const atlasHtml=edit.match(/<!-- dtf-outdoor-visuals-v6:start -->[\s\S]*?<!-- dtf-outdoor-visuals-v6:end -->/)?.[0]||'';
  if(/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(atlasHtml)) throw new Error('Unsafe visual label found in published Outdoor atlas.');

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{const response=await fetch(`${site}/learn/outdoor/?dtf_outv6=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Outdoor-Visuals-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});visitor=await response.text();if(response.ok&&visitor.includes('data-dtf-outdoor-visuals-v6="true"')){ok=true;break;}}catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor Outdoor visual atlas marker missing.');
  if((visitor.match(/class="outv6-card"/g)||[]).length!==12) throw new Error('Visitor Outdoor visual count is not 12.');
  if((visitor.match(/data-outv6-group=/g)||[]).length!==8) throw new Error('Visitor Outdoor chapter count is not 8.');
  if((visitor.match(/class="outv6-gap"/g)||[]).length!==11) throw new Error('Visitor Outdoor gap count is not 11.');
  if(!visitor.includes('data-dtf-outdoor-v6="true"')) throw new Error('Visitor page lost Outdoor V6 curriculum marker.');

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/outdoor/',visuals:12,groups:8,wordpressMedia:resolved.filter(x=>x.source==='wordpress').length,canonicalFallbacks:resolved.filter(x=>x.source!=='wordpress').length,unresolvedGaps:map.gaps.map(g=>g.id),visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:page.status||'publish'})});await writeFile(join(backupDir,'rollback.txt'),`Restored prior Outdoor page after failure: ${error.message}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback-failed.txt'),`${rollbackError.stack||rollbackError}\n`);}}
  throw error;
}
