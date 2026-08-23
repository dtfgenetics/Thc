import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_LIFECYCLE_PROPAGATION_VISUALS_V6||'').toLowerCase()==='true';
const mapPath=process.env.LIFECYCLE_PROPAGATION_VISUAL_MAP||'site/wordpress/education/lifecycle-propagation-v6-visual-map.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-lifecycle-propagation-visuals-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Lifecycle-Propagation-Visuals-V6/1.0'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`lifecycle-propagation-visuals-${stamp}`);
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
if(map?.schemaVersion!==1||map?.curriculumId!=='lifecycle-propagation-v6') throw new Error('Invalid Lifecycle & Propagation visual map.');
const entries=Object.entries(map.chapters||{});
if(entries.length!==8) throw new Error(`Expected 8 chapter visual groups, found ${entries.length}.`);
const assets=entries.flatMap(([chapter,items])=>(items||[]).map(item=>({chapter,...item})));
if(assets.length!==17) throw new Error(`Expected 17 mapped canonical visuals, found ${assets.length}.`);
for(const asset of assets){
  if(!asset.file||/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(asset.file)) throw new Error(`Unsafe visual mapping: ${asset.file}`);
  await access(`site/wordpress/assets/infographics/${asset.file}`);
}
if(!Array.isArray(map.gaps)||map.gaps.length!==4||map.gaps.some(g=>g.status!=='needed')) throw new Error('Expected exactly four explicitly unresolved Lifecycle visual gaps.');

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
  'seed-identity-quality':'Seed Identity, Quality & Storage',
  'germination':'Germination: From Imbibition to Radicle Emergence',
  'seedling-establishment':'Seedling Establishment',
  'clonal-propagation':'Clonal Propagation & Mother Stock',
  'transplant-acclimation':'Transplanting, Acclimation & Early Vegetative Growth',
  'vegetative-development':'Vegetative Development & Crop Readiness',
  'reproductive-transition':'Reproductive Transition, Sex Expression & Flower Development',
  'maturation-cycle-records':'Maturation, Senescence & Lifecycle Records'
};
function atlas(){
  const groups=entries.map(([chapter])=>{
    const items=resolved.filter(x=>x.chapter===chapter);
    return `<section class="lp6v-group" id="lp6v-${esc(chapter)}" data-lp6v-group="${esc(chapter)}"><div class="lp6v-head"><p class="lp6v-kicker">Chapter visual references</p><h3>${esc(titleByChapter[chapter]||chapter)}</h3><p>These visuals support the exact biology taught in this chapter. Broad or misleading substitutions are excluded.</p></div><div class="lp6v-grid">${items.map(item=>`<figure class="lp6v-card" data-lp6v-source="${item.source}"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt)}"></a><figcaption><strong>${esc(item.title)}</strong><span>${item.source==='wordpress'?'WordPress media · canonical asset':'Canonical asset fallback'}</span></figcaption></figure>`).join('')}</div></section>`;
  }).join('');
  const gaps=map.gaps.map(g=>`<article class="lp6v-gap"><span>Visual production gap</span><strong>${esc(g.title)}</strong><p>${esc(g.neededVisual)}</p></article>`).join('');
  return `<!-- dtf-lifecycle-propagation-visuals-v6:start --><style id="dtf-lifecycle-propagation-visuals-v6-style">
.lp6v{--ink:#14301f;--muted:#53675b;--line:#d7e2d9;--gold:#8a7330;background:#eef3ec;color:var(--ink);padding:68px 0 76px}.lp6v *{box-sizing:border-box}.lp6v-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.lp6v-kicker{margin:0 0 7px;color:var(--gold);font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.lp6v-intro{display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:24px}.lp6v-intro>div{max-width:760px}.lp6v h2{margin:0;font-size:clamp(2.2rem,4vw,3.7rem);line-height:.98;letter-spacing:-.04em}.lp6v h3{margin:0;font-size:clamp(1.55rem,3vw,2.35rem);letter-spacing:-.025em}.lp6v p{color:var(--muted);line-height:1.65}.lp6v-summary{padding:14px 17px;border-radius:14px;background:#fff;border:1px solid var(--line);font-weight:850}.lp6v-group{padding:30px 0;border-top:1px solid #d4dfd5}.lp6v-head{max-width:820px;margin-bottom:15px}.lp6v-head p:last-child{margin-bottom:0}.lp6v-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.lp6v-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,48,27,.05)}.lp6v-card a{display:block;background:#e7eee7;aspect-ratio:4/3;overflow:hidden}.lp6v-card img{width:100%;height:100%;object-fit:contain;display:block}.lp6v-card figcaption{padding:13px 14px}.lp6v-card strong{display:block;line-height:1.3}.lp6v-card span{display:block;margin-top:5px;color:#718078;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.lp6v-gaps{margin-top:34px;padding:22px;border-radius:19px;background:#fff9ed;border:1px solid #e7d6ae}.lp6v-gap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.lp6v-gap{padding:14px;border-radius:13px;background:#fff;border:1px solid #eadfc7}.lp6v-gap span{display:block;color:#8a7330;font-size:.65rem;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.lp6v-gap strong{display:block;margin:5px 0}.lp6v-gap p{margin:0;font-size:.91rem}
@media(max-width:860px){.lp6v-intro{align-items:flex-start;flex-direction:column}.lp6v-grid,.lp6v-gap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.lp6v{padding:50px 0 58px}.lp6v-wrap{width:min(100% - 26px,1180px)}.lp6v-grid,.lp6v-gap-grid{grid-template-columns:1fr}}
</style><section class="lp6v" data-dtf-lifecycle-propagation-visuals-v6="true"><div class="lp6v-wrap"><div class="lp6v-intro"><div><p class="lp6v-kicker">Lifecycle & Propagation visual atlas</p><h2>See each stage, structure and transition.</h2><p>The 32-lesson curriculum is paired with approved THC visuals already in the publication library. Supporting diagrams are labeled by their actual purpose rather than repurposed as something they do not show.</p></div><div class="lp6v-summary">17 verified visuals · 8 chapter groups</div></div>${groups}<section class="lp6v-gaps"><p class="lp6v-kicker">Still needs dedicated visual production</p><h3>Four diagrams remain intentionally open.</h3><p>These concepts do not yet have an exact approved visual in the canonical library, so they remain visible production targets instead of being filled by misleading near-matches.</p><div class="lp6v-gap-grid">${gaps}</div></section></div></section><!-- dtf-lifecycle-propagation-visuals-v6:end -->`;
}

const page=await pageBySlug('lifecycle-propagation');
const before=rendered(page.content);
if(!before.includes('data-dtf-lifecycle-propagation-v6="true"')) throw new Error('Lifecycle & Propagation V6 curriculum is not live; refusing to publish visual atlas onto an older page.');
const clean=before.replace(/<!-- dtf-lifecycle-propagation-visuals-v6:start -->[\s\S]*?<!-- dtf-lifecycle-propagation-visuals-v6:end -->/g,'').trim();
const next=`${clean}\n${atlas()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('lifecycle-propagation')).content);
  if(!edit.includes('data-dtf-lifecycle-propagation-visuals-v6="true"')) throw new Error('Edit-context Lifecycle visual atlas marker missing.');
  if((edit.match(/class="lp6v-card"/g)||[]).length!==17) throw new Error('Edit-context visual count is not 17.');
  if((edit.match(/data-lp6v-group=/g)||[]).length!==8) throw new Error('Edit-context visual chapter count is not 8.');
  if((edit.match(/class="lp6v-gap"/g)||[]).length!==4) throw new Error('Edit-context visual gap count is not 4.');
  const atlasHtml=edit.match(/<!-- dtf-lifecycle-propagation-visuals-v6:start -->[\s\S]*?<!-- dtf-lifecycle-propagation-visuals-v6:end -->/)?.[0]||'';
  if(/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(atlasHtml)) throw new Error('Unsafe visual label found in published Lifecycle atlas.');

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{const response=await fetch(`${site}/learn/lifecycle-propagation/?dtf_lp6v=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Lifecycle-Propagation-Visuals-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});visitor=await response.text();if(response.ok&&visitor.includes('data-dtf-lifecycle-propagation-visuals-v6="true"')){ok=true;break;}}catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor Lifecycle visual atlas marker missing.');
  if((visitor.match(/class="lp6v-card"/g)||[]).length!==17) throw new Error('Visitor visual count is not 17.');
  if((visitor.match(/data-lp6v-group=/g)||[]).length!==8) throw new Error('Visitor visual chapter count is not 8.');
  if((visitor.match(/class="lp6v-gap"/g)||[]).length!==4) throw new Error('Visitor visual gap count is not 4.');
  if(!visitor.includes('data-dtf-lifecycle-propagation-v6="true"')) throw new Error('Visitor page lost Lifecycle & Propagation V6 curriculum marker.');

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,visuals:17,groups:8,wordpressMedia:resolved.filter(x=>x.source==='wordpress').length,canonicalFallbacks:resolved.filter(x=>x.source!=='wordpress').length,unresolvedGaps:map.gaps.map(g=>g.id),visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:true,reason:error.message},null,2)}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:false,reason:error.message,rollbackError:rollbackError.message},null,2)}\n`);}}
  throw error;
}
