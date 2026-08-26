import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_GENETICS_BREEDING_VISUALS_V6||'').toLowerCase()==='true';
const mapPath=process.env.GENETICS_BREEDING_VISUAL_MAP||'site/wordpress/education/genetics-breeding-v6-visual-map.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-genetics-breeding-visuals-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Genetics-Breeding-Visuals-V6/2.0'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`genetics-breeding-visuals-${stamp}`);
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
if(map?.schemaVersion!==1||map?.curriculumId!=='genetics-breeding-v6'||map?.route!=='/learn/genetics-breeding/') throw new Error('Invalid Genetics & Breeding visual map.');
if(map?.publicationPolicy?.approvedOnly!==true||map?.publicationPolicy?.draftExcluded!==true||map?.publicationPolicy?.qaRequiredExcluded!==true) throw new Error('Genetics visual map must retain approved-only publication policy.');
const entries=Object.entries(map.chapters||{});
if(entries.length!==8) throw new Error(`Expected 8 Genetics chapter visual groups, found ${entries.length}.`);
const assets=entries.flatMap(([chapter,items])=>{
  if(!Array.isArray(items)) throw new Error(`${chapter}: chapter visual mapping must be an array.`);
  return items.map(item=>({chapter,...item}));
});
const gaps=Array.isArray(map.gaps)?map.gaps:[];
if(!gaps.length||gaps.some(g=>g.status!=='needed'||!g.id||!g.title||!g.neededVisual)) throw new Error('Every unresolved Genetics visual gap must be explicitly described and marked needed.');
for(const asset of assets){
  if(!asset.file||!/\.(?:png|jpe?g|webp)$/i.test(asset.file)||/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(asset.file)) throw new Error(`Unsafe visual mapping: ${asset.file}`);
  if(!asset.title||!asset.alt) throw new Error(`${asset.file}: mapped Genetics visual requires title and alt text.`);
  await access(`site/wordpress/assets/infographics/${asset.file}`);
}

const media=[];
for(let page=1;page<=8;page+=1){
  let rows=[];
  try{rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);}catch(error){if(/rest_post_invalid_page_number|400/.test(error.message)) break;throw error;}
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
const resolved=assets.map(asset=>{
  const wp=mediaIndex.get(norm(basename(asset.file)));
  return {...asset,src:wp?.source_url||`${rawBase}${encodeURIComponent(asset.file).replaceAll('%2F','/')}`,source:wp?'wordpress':'github-canonical',mediaId:wp?.id||null};
});

const titleByChapter={
  'genotype-phenotype-environment':'Genotype, Phenotype & Environment',
  'population-structure-lineage-identity':'Population Structure, Lineage & Genetic Identity',
  'inheritance-segregation-generations':'Inheritance, Segregation & Generations',
  'chemotype-cannabinoid-genetics':'Chemotype & Cannabinoid Genetics',
  'sex-determination-expression':'Sex Determination & Sex Expression',
  'selection-phenotyping-parent-choice':'Phenotyping, Selection & Parent Choice',
  'stabilization-testing-line-development':'Stabilization, Testing & Line Development',
  'molecular-tools-records-breeding-evidence':'Molecular Tools, Records & Breeding Evidence'
};
const visualCount=resolved.length;
const gapCount=gaps.length;

function atlas(){
  const groups=entries.map(([chapter])=>{
    const items=resolved.filter(x=>x.chapter===chapter);
    const empty=items.length===0?'<div class="gb6v-empty"><strong>No exact approved visual yet.</strong><p>This chapter remains text-supported until its purpose-built diagram passes review.</p></div>':'';
    return `<section class="gb6v-group" id="gb6v-${esc(chapter)}" data-gb6v-group="${esc(chapter)}"><div class="gb6v-head"><p class="gb6v-kicker">Chapter visual references</p><h3>${esc(titleByChapter[chapter]||chapter)}</h3><p>Only reviewed visuals that directly support this genetics or breeding concept are shown.</p></div>${empty}<div class="gb6v-grid">${items.map(item=>`<figure class="gb6v-card" data-gb6v-source="${esc(item.source)}"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt)}"></a><figcaption><strong>${esc(item.title)}</strong><span>${item.source==='wordpress'?'WordPress media · canonical asset':'Canonical GitHub asset'}</span></figcaption></figure>`).join('')}</div></section>`;
  }).join('');
  const gapHtml=gaps.map(g=>`<article class="gb6v-gap"><span>Visual production gap</span><strong>${esc(g.title)}</strong><p>${esc(g.neededVisual)}</p></article>`).join('');
  return `<!-- dtf-genetics-breeding-visuals-v6:start --><style id="dtf-genetics-breeding-visuals-v6-style">
.gb6v{--ink:#17332a;--muted:#566a61;--line:#d4e1da;--gold:#8a7331;background:#edf3ef;color:var(--ink);padding:68px 0 76px}.gb6v *{box-sizing:border-box}.gb6v-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.gb6v-kicker{margin:0 0 7px;color:var(--gold);font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.gb6v-intro{display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:24px}.gb6v-intro>div{max-width:780px}.gb6v h2{margin:0;font-size:clamp(2.2rem,4vw,3.7rem);line-height:.98;letter-spacing:-.04em}.gb6v h3{margin:0;font-size:clamp(1.55rem,3vw,2.35rem);letter-spacing:-.025em}.gb6v p{color:var(--muted);line-height:1.65}.gb6v-summary{padding:14px 17px;border-radius:14px;background:#fff;border:1px solid var(--line);font-weight:850}.gb6v-group{padding:30px 0;border-top:1px solid #cfddd6}.gb6v-head{max-width:840px;margin-bottom:15px}.gb6v-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.gb6v-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,48,35,.05)}.gb6v-card a{display:block;background:#e5ede9;aspect-ratio:4/3;overflow:hidden}.gb6v-card img{width:100%;height:100%;object-fit:contain;display:block}.gb6v-card figcaption{padding:13px 14px}.gb6v-card strong{display:block;line-height:1.3}.gb6v-card span{display:block;margin-top:5px;color:#718079;font-size:.7rem;font-weight:800;text-transform:uppercase}.gb6v-empty{max-width:650px;padding:15px;border-radius:13px;background:#fff9ed;border:1px solid #e7d6ae;margin-bottom:14px}.gb6v-empty p{margin:4px 0 0;font-size:.92rem}.gb6v-gaps{margin-top:34px;padding:22px;border-radius:19px;background:#fff9ed;border:1px solid #e7d6ae}.gb6v-gap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.gb6v-gap{padding:14px;border-radius:13px;background:#fff;border:1px solid #eadfc7}.gb6v-gap span{display:block;color:#887432;font-size:.65rem;font-weight:950;text-transform:uppercase}.gb6v-gap strong{display:block;margin:5px 0}.gb6v-gap p{margin:0;font-size:.91rem}@media(max-width:860px){.gb6v-intro{align-items:flex-start;flex-direction:column}.gb6v-grid,.gb6v-gap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.gb6v{padding:50px 0 58px}.gb6v-wrap{width:min(100% - 26px,1180px)}.gb6v-grid,.gb6v-gap-grid{grid-template-columns:1fr}}
</style><section class="gb6v" data-dtf-genetics-breeding-visuals-v6="true"><div class="gb6v-wrap"><div class="gb6v-intro"><div><p class="gb6v-kicker">Genetics & Breeding visual atlas</p><h2>See inheritance as populations, evidence and controlled generations—not strain-name mythology.</h2><p>The 32-lesson Genetics curriculum shows only visuals that have passed the current publication policy. Unresolved genetics concepts remain named production targets rather than receiving generic cannabis artwork.</p></div><div class="gb6v-summary">${visualCount} approved visual${visualCount===1?'':'s'} · 8 chapter groups · ${gapCount} open visual targets</div></div>${groups}<section class="gb6v-gaps"><p class="gb6v-kicker">Still needs dedicated visual production</p><h3>${gapCount} Genetics diagram${gapCount===1?'':'s'} remain intentionally open.</h3><p>These concepts require purpose-built, evidence-aware graphics. Pollen photographs, strain cards and generic plant art are not substitutes for inheritance or genomic diagrams.</p><div class="gb6v-gap-grid">${gapHtml}</div></section></div></section><!-- dtf-genetics-breeding-visuals-v6:end -->`;
}

const page=await pageBySlug('genetics-breeding');
const before=rendered(page.content);
if(!before.includes('data-dtf-genetics-breeding-v6="true"')) throw new Error('Genetics & Breeding V6 curriculum is not live; refusing visual publication.');
if(!before.includes('data-dtf-topic="genetics-breeding"')||!before.includes('data-dtf-learning-v4="topic-genetics-breeding"')) throw new Error('Genetics V3/V4 ownership markers are missing.');
const clean=before.replace(/<!-- dtf-genetics-breeding-visuals-v6:start -->[\s\S]*?<!-- dtf-genetics-breeding-visuals-v6:end -->/g,'').trim();
const next=`${clean}\n${atlas()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
const verifyCounts=(html,where)=>{
  if(!html.includes('data-dtf-genetics-breeding-visuals-v6="true"')) throw new Error(`${where}: Genetics visual atlas marker missing.`);
  if((html.match(/class="gb6v-card"/g)||[]).length!==visualCount) throw new Error(`${where}: Genetics visual count does not match quality map (${visualCount}).`);
  if((html.match(/data-gb6v-group=/g)||[]).length!==8) throw new Error(`${where}: Genetics visual chapter count is not 8.`);
  if((html.match(/class="gb6v-gap"/g)||[]).length!==gapCount) throw new Error(`${where}: Genetics visual gap count does not match quality map (${gapCount}).`);
  if(!html.includes('data-dtf-genetics-breeding-v6="true"')||!html.includes('data-dtf-topic="genetics-breeding"')||!html.includes('data-dtf-learning-v4="topic-genetics-breeding"')) throw new Error(`${where}: Genetics curriculum ownership markers are incomplete.`);
  const block=html.match(/<!-- dtf-genetics-breeding-visuals-v6:start -->[\s\S]*?<!-- dtf-genetics-breeding-visuals-v6:end -->/)?.[0]||'';
  if(/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(block)) throw new Error(`${where}: unsafe asset-state label found in Genetics atlas.`);
};
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  verifyCounts(rendered((await pageBySlug('genetics-breeding')).content),'Edit context');
  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}/learn/genetics-breeding/?dtf_gb6v=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Genetics-Breeding-Visuals-V6-Verify/2.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
      visitor=await response.text();if(response.ok&&visitor.includes('data-dtf-genetics-breeding-visuals-v6="true"')){ok=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor Genetics visual atlas marker missing.');
  verifyCounts(visitor,'Visitor');
  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/genetics-breeding/',visuals:visualCount,groups:8,wordpressMedia:resolved.filter(x=>x.source==='wordpress').length,canonicalFallbacks:resolved.filter(x=>x.source!=='wordpress').length,unresolvedGaps:gaps.map(g=>g.id),visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:true,at:new Date().toISOString()},null,2)}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:false,error:rollbackError.message,at:new Date().toISOString()},null,2)}\n`);}}
  throw error;
}
