import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_PLANT_BIOLOGY_VISUALS_V6||'').toLowerCase()==='true';
const mapPath=process.env.PLANT_BIOLOGY_VISUAL_MAP||'site/wordpress/education/plant-biology-v6-visual-map.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-plant-biology-visuals-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Plant-Biology-Visuals-V6/1.0'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`plant-biology-visuals-${stamp}`);
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
if(map?.schemaVersion!==1||map?.curriculumId!=='plant-biology-v6') throw new Error('Invalid Plant Biology visual map.');
const entries=Object.entries(map.chapters||{});
if(entries.length!==8) throw new Error(`Expected 8 chapter visual groups, found ${entries.length}.`);
const assets=entries.flatMap(([chapter,items])=>(items||[]).map(item=>({chapter,...item})));
if(assets.length!==20) throw new Error(`Expected 20 mapped canonical visuals, found ${assets.length}.`);
for(const asset of assets){
  if(!asset.file||/draft|quarantine|superseded/i.test(asset.file)) throw new Error(`Unsafe visual mapping: ${asset.file}`);
  await access(`site/wordpress/assets/infographics/${asset.file}`);
}
if(!Array.isArray(map.gaps)||map.gaps.length!==2||map.gaps.some(g=>g.status!=='needed')) throw new Error('Expected exactly two explicitly unresolved visual gaps.');

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
  'identity-morphology':'Plant Identity & Whole-Plant Morphology',
  'cells-tissues-meristems':'Cells, Tissues & Meristems',
  roots:'Roots',
  'stems-transport':'Stems & Vascular Transport',
  'leaves-stomata':'Leaves, Stomata & Gas Exchange',
  'carbon-water-energy':'Photosynthesis, Respiration & Water Relations',
  'growth-signaling':'Hormones, Tropisms & Stress Responses',
  'reproduction-trichomes-senescence':'Flowers, Reproduction, Trichomes & Senescence'
};
function atlas(){
  const groups=entries.map(([chapter])=>{
    const items=resolved.filter(x=>x.chapter===chapter);
    return `<section class="pb6v-group" id="pb6v-${esc(chapter)}" data-pb6v-group="${esc(chapter)}"><div class="pb6v-head"><p class="pb6v-kicker">Chapter visual references</p><h3>${esc(titleByChapter[chapter]||chapter)}</h3><p>Use these diagrams with the chapter lessons. Each image is mapped to this topic deliberately; unrelated “close enough” visuals are excluded.</p></div><div class="pb6v-grid">${items.map(item=>`<figure class="pb6v-card" data-pb6v-source="${item.source}"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt)}"></a><figcaption><strong>${esc(item.title)}</strong><span>${item.source==='wordpress'?'WordPress media · canonical asset':'Canonical asset fallback'}</span></figcaption></figure>`).join('')}</div></section>`;
  }).join('');
  return `<!-- dtf-plant-biology-visuals-v6:start --><style id="dtf-plant-biology-visuals-v6-style">
.pb6v{--cream:#f7f4ea;--ink:#14301f;--muted:#53675b;--line:#d7e2d9;--green:#1f7242;--gold:#8a7330;background:#eef3ec;color:var(--ink);padding:68px 0 76px}.pb6v *{box-sizing:border-box}.pb6v-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.pb6v-kicker{margin:0 0 7px;color:var(--gold);font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.pb6v-intro{display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:24px}.pb6v-intro>div{max-width:760px}.pb6v h2{margin:0;font-size:clamp(2.2rem,4vw,3.7rem);line-height:.98;letter-spacing:-.04em}.pb6v h3{margin:0;font-size:clamp(1.55rem,3vw,2.35rem);letter-spacing:-.025em}.pb6v p{color:var(--muted);line-height:1.65}.pb6v-summary{padding:14px 17px;border-radius:14px;background:#fff;border:1px solid var(--line);font-weight:850}.pb6v-group{padding:30px 0;border-top:1px solid #d4dfd5}.pb6v-head{max-width:820px;margin-bottom:15px}.pb6v-head p:last-child{margin-bottom:0}.pb6v-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.pb6v-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,48,27,.05)}.pb6v-card a{display:block;background:#e7eee7;aspect-ratio:4/3;overflow:hidden}.pb6v-card img{width:100%;height:100%;object-fit:contain;display:block}.pb6v-card figcaption{padding:13px 14px}.pb6v-card strong{display:block;line-height:1.3}.pb6v-card span{display:block;margin-top:5px;color:#718078;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.pb6v-note{margin-top:26px;padding:19px 21px;border-radius:17px;background:#fff9ed;border:1px solid #e7d6ae}.pb6v-note strong{display:block;margin-bottom:6px}.pb6v-note p{margin:0}
@media(max-width:860px){.pb6v-intro{align-items:flex-start;flex-direction:column}.pb6v-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.pb6v{padding:50px 0 58px}.pb6v-wrap{width:min(100% - 26px,1180px)}.pb6v-grid{grid-template-columns:1fr}}
</style><section class="pb6v" data-dtf-plant-biology-visuals-v6="true"><div class="pb6v-wrap"><div class="pb6v-intro"><div><p class="pb6v-kicker">Plant Biology visual atlas</p><h2>See the structures and processes behind the lessons.</h2><p>The curriculum is paired with canonical THC visual references so anatomy and physiology are learned visually, not from text alone.</p></div><div class="pb6v-summary">20 verified visuals · 8 chapter groups</div></div>${groups}<aside class="pb6v-note"><strong>Two diagrams still need dedicated production.</strong><p>The remaining gaps are the complete pollination → fertilization → seed-development sequence and the senescence → nutrient-remobilization → abscission sequence. Existing anatomy or hormone graphics are not being mislabeled as replacements.</p></aside></div></section><!-- dtf-plant-biology-visuals-v6:end -->`;
}

const page=await pageBySlug('plant-biology');
const before=rendered(page.content);
if(!before.includes('data-dtf-plant-biology-v6="true"')) throw new Error('Plant Biology V6 curriculum is not live; refusing to publish visual atlas onto an older page.');
const clean=before.replace(/<!-- dtf-plant-biology-visuals-v6:start -->[\s\S]*?<!-- dtf-plant-biology-visuals-v6:end -->/g,'').trim();
const next=`${clean}\n${atlas()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('plant-biology')).content);
  if(!edit.includes('data-dtf-plant-biology-visuals-v6="true"')) throw new Error('Edit-context visual atlas marker missing.');
  if((edit.match(/class="pb6v-card"/g)||[]).length!==20) throw new Error('Edit-context visual count is not 20.');
  if((edit.match(/data-pb6v-group=/g)||[]).length!==8) throw new Error('Edit-context visual chapter count is not 8.');
  if(/draft|quarantine|superseded/i.test(edit.match(/<!-- dtf-plant-biology-visuals-v6:start -->[\s\S]*?<!-- dtf-plant-biology-visuals-v6:end -->/)?.[0]||'')) throw new Error('Unsafe visual label found in published atlas.');

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{const response=await fetch(`${site}/learn/plant-biology/?dtf_pb6v=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Plant-Biology-Visuals-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});visitor=await response.text();if(response.ok&&visitor.includes('data-dtf-plant-biology-visuals-v6="true"')){ok=true;break;}}catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor visual atlas marker missing.');
  if((visitor.match(/class="pb6v-card"/g)||[]).length!==20) throw new Error('Visitor visual count is not 20.');
  if((visitor.match(/data-pb6v-group=/g)||[]).length!==8) throw new Error('Visitor visual chapter count is not 8.');
  if(!visitor.includes('data-dtf-plant-biology-v6="true"')) throw new Error('Visitor page lost Plant Biology V6 curriculum marker.');

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,visuals:20,groups:8,wordpressMedia:resolved.filter(x=>x.source==='wordpress').length,canonicalFallbacks:resolved.filter(x=>x.source!=='wordpress').length,unresolvedGaps:map.gaps.map(g=>g.id),visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:true,reason:error.message},null,2)}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:false,reason:error.message,rollbackError:rollbackError.message},null,2)}\n`);}}
  throw error;
}
