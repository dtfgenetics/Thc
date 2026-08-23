import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_ENVIRONMENT_VPD_VISUALS_V6||'').toLowerCase()==='true';
const mapPath=process.env.ENVIRONMENT_VPD_VISUAL_MAP||'site/wordpress/education/environment-vpd-v6-visual-map.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-environment-vpd-visuals-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Environment-VPD-Visuals-V6/1.0'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`environment-vpd-visuals-${stamp}`);
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
if(map?.schemaVersion!==1||map?.curriculumId!=='environment-vpd-v6') throw new Error('Invalid Environment & VPD visual map.');
const entries=Object.entries(map.chapters||{});
if(entries.length!==8) throw new Error(`Expected 8 chapter visual groups, found ${entries.length}.`);
const assets=entries.flatMap(([chapter,items])=>(items||[]).map(item=>({chapter,...item})));
if(assets.length!==14) throw new Error(`Expected 14 mapped canonical visuals, found ${assets.length}.`);
for(const asset of assets){
  if(!asset.file||/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(asset.file)) throw new Error(`Unsafe visual mapping: ${asset.file}`);
  await access(`site/wordpress/assets/infographics/${asset.file}`);
}
if(!Array.isArray(map.gaps)||map.gaps.length!==5||map.gaps.some(g=>g.status!=='needed')) throw new Error('Expected exactly five explicitly unresolved Environment visual gaps.');

const media=[];
for(let page=1;page<=5;page+=1){
  let rows=[];
  try{rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);}catch(error){if(/rest_post_invalid_page_number|400/.test(error.message)) break; throw error;}
  if(!Array.isArray(rows)||rows.length===0) break;
  media.push(...rows);
  if(rows.length<100) break;
}
const norm=v=>String(v||'').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'');
const mediaIndex=new Map();
for(const item of media){
  const source=String(item?.source_url||'');
  let base='';try{base=decodeURIComponent(new URL(source).pathname.split('/').pop()||'');}catch{}
  for(const key of [base,item?.slug,item?.title?.raw]) if(key) mediaIndex.set(norm(key),item);
}
const rawBase='https://raw.githubusercontent.com/dtfgenetics/Thc/main/site/wordpress/assets/infographics/';
const resolved=assets.map(asset=>{
  const wp=mediaIndex.get(norm(asset.file));
  return {...asset,src:wp?.source_url||`${rawBase}${encodeURIComponent(asset.file).replaceAll('%2F','/')}`,source:wp?'wordpress':'github-canonical',mediaId:wp?.id||null};
});

const titleByChapter={
  'measurement-sensors-mapping':'Measurement, Sensors & Canopy Mapping',
  'temperature-leaf-energy':'Air Temperature, Leaf Temperature & Energy Balance',
  'humidity-dew-condensation':'Humidity, Vapor Pressure, Dew Point & Condensation',
  'vpd-meaning-limits':'VPD: Meaning, Calculation & Limits',
  'transpiration-root-supply':'Transpiration, Stomata & Root-Zone Supply',
  'airflow-ventilation-moisture-removal':'Air Movement, Ventilation & Moisture Removal',
  'co2-coordination-safety':'CO2, Light, Ventilation & Safety Coordination',
  'control-transitions-records':'Control Envelopes, Transitions, Alarms & Records'
};
function atlas(){
  const groups=entries.map(([chapter])=>{
    const items=resolved.filter(x=>x.chapter===chapter);
    const empty=items.length===0?'<div class="ev6v-empty"><strong>No exact approved visual yet.</strong><p>This chapter remains text-supported until the dedicated diagram listed below is produced and reviewed.</p></div>':'';
    return `<section class="ev6v-group" id="ev6v-${esc(chapter)}" data-ev6v-group="${esc(chapter)}"><div class="ev6v-head"><p class="ev6v-kicker">Chapter visual references</p><h3>${esc(titleByChapter[chapter]||chapter)}</h3><p>Only visuals that directly support the biology or measurement concept are shown here.</p></div>${empty}<div class="ev6v-grid">${items.map(item=>`<figure class="ev6v-card" data-ev6v-source="${item.source}"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt)}"></a><figcaption><strong>${esc(item.title)}</strong><span>${item.source==='wordpress'?'WordPress media · canonical asset':'Canonical asset fallback'}</span></figcaption></figure>`).join('')}</div></section>`;
  }).join('');
  const gaps=map.gaps.map(g=>`<article class="ev6v-gap"><span>Visual production gap</span><strong>${esc(g.title)}</strong><p>${esc(g.neededVisual)}</p></article>`).join('');
  return `<!-- dtf-environment-vpd-visuals-v6:start --><style id="dtf-environment-vpd-visuals-v6-style">
.ev6v{--ink:#143027;--muted:#53675f;--line:#d7e2dc;--gold:#887432;background:#eef3ef;color:var(--ink);padding:68px 0 76px}.ev6v *{box-sizing:border-box}.ev6v-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.ev6v-kicker{margin:0 0 7px;color:var(--gold);font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.ev6v-intro{display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:24px}.ev6v-intro>div{max-width:760px}.ev6v h2{margin:0;font-size:clamp(2.2rem,4vw,3.7rem);line-height:.98;letter-spacing:-.04em}.ev6v h3{margin:0;font-size:clamp(1.55rem,3vw,2.35rem);letter-spacing:-.025em}.ev6v p{color:var(--muted);line-height:1.65}.ev6v-summary{padding:14px 17px;border-radius:14px;background:#fff;border:1px solid var(--line);font-weight:850}.ev6v-group{padding:30px 0;border-top:1px solid #d4dfd8}.ev6v-head{max-width:820px;margin-bottom:15px}.ev6v-head p:last-child{margin-bottom:0}.ev6v-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.ev6v-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,48,35,.05)}.ev6v-card a{display:block;background:#e7eee9;aspect-ratio:4/3;overflow:hidden}.ev6v-card img{width:100%;height:100%;object-fit:contain;display:block}.ev6v-card figcaption{padding:13px 14px}.ev6v-card strong{display:block;line-height:1.3}.ev6v-card span{display:block;margin-top:5px;color:#718079;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.ev6v-empty{max-width:620px;padding:15px;border-radius:13px;background:#fff9ed;border:1px solid #e7d6ae;margin-bottom:14px}.ev6v-empty p{margin:4px 0 0;font-size:.92rem}.ev6v-gaps{margin-top:34px;padding:22px;border-radius:19px;background:#fff9ed;border:1px solid #e7d6ae}.ev6v-gap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.ev6v-gap{padding:14px;border-radius:13px;background:#fff;border:1px solid #eadfc7}.ev6v-gap span{display:block;color:#887432;font-size:.65rem;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.ev6v-gap strong{display:block;margin:5px 0}.ev6v-gap p{margin:0;font-size:.91rem}
@media(max-width:860px){.ev6v-intro{align-items:flex-start;flex-direction:column}.ev6v-grid,.ev6v-gap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.ev6v{padding:50px 0 58px}.ev6v-wrap{width:min(100% - 26px,1180px)}.ev6v-grid,.ev6v-gap-grid{grid-template-columns:1fr}}
</style><section class="ev6v" data-dtf-environment-vpd-visuals-v6="true"><div class="ev6v-wrap"><div class="ev6v-intro"><div><p class="ev6v-kicker">Environment & VPD visual atlas</p><h2>Measure the environment the plant actually experiences.</h2><p>The 32-lesson curriculum is paired with approved environmental and plant-physiology visuals already in the publication library. Chapters without an exact diagram remain visibly open rather than being filled with a misleading near-match.</p></div><div class="ev6v-summary">14 verified visuals · 8 chapter groups</div></div>${groups}<section class="ev6v-gaps"><p class="ev6v-kicker">Still needs dedicated visual production</p><h3>Five environmental diagrams remain intentionally open.</h3><p>These are important enough to require purpose-built, reviewed graphics. Generic VPD or climate artwork will not be substituted for them.</p><div class="ev6v-gap-grid">${gaps}</div></section></div></section><!-- dtf-environment-vpd-visuals-v6:end -->`;
}

const page=await pageBySlug('environment-vpd');
const before=rendered(page.content);
if(!before.includes('data-dtf-environment-vpd-v6="true"')) throw new Error('Environment & VPD V6 curriculum is not live; refusing to publish visual atlas onto an older page.');
const clean=before.replace(/<!-- dtf-environment-vpd-visuals-v6:start -->[\s\S]*?<!-- dtf-environment-vpd-visuals-v6:end -->/g,'').trim();
const next=`${clean}\n${atlas()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('environment-vpd')).content);
  if(!edit.includes('data-dtf-environment-vpd-visuals-v6="true"')) throw new Error('Edit-context Environment visual atlas marker missing.');
  if((edit.match(/class="ev6v-card"/g)||[]).length!==14) throw new Error('Edit-context visual count is not 14.');
  if((edit.match(/data-ev6v-group=/g)||[]).length!==8) throw new Error('Edit-context visual chapter count is not 8.');
  if((edit.match(/class="ev6v-gap"/g)||[]).length!==5) throw new Error('Edit-context visual gap count is not 5.');
  const atlasHtml=edit.match(/<!-- dtf-environment-vpd-visuals-v6:start -->[\s\S]*?<!-- dtf-environment-vpd-visuals-v6:end -->/)?.[0]||'';
  if(/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(atlasHtml)) throw new Error('Unsafe visual label found in published Environment atlas.');

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{const response=await fetch(`${site}/learn/environment-vpd/?dtf_ev6v=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Environment-VPD-Visuals-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});visitor=await response.text();if(response.ok&&visitor.includes('data-dtf-environment-vpd-visuals-v6="true"')){ok=true;break;}}catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor Environment visual atlas marker missing.');
  if((visitor.match(/class="ev6v-card"/g)||[]).length!==14) throw new Error('Visitor visual count is not 14.');
  if((visitor.match(/data-ev6v-group=/g)||[]).length!==8) throw new Error('Visitor visual chapter count is not 8.');
  if((visitor.match(/class="ev6v-gap"/g)||[]).length!==5) throw new Error('Visitor visual gap count is not 5.');
  if(!visitor.includes('data-dtf-environment-vpd-v6="true"')) throw new Error('Visitor page lost Environment & VPD V6 curriculum marker.');

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,visuals:14,groups:8,wordpressMedia:resolved.filter(x=>x.source==='wordpress').length,canonicalFallbacks:resolved.filter(x=>x.source!=='wordpress').length,unresolvedGaps:map.gaps.map(g=>g.id),visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:true,reason:error.message},null,2)}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:false,reason:error.message,rollbackError:rollbackError.message},null,2)}\n`);}}
  throw error;
}
