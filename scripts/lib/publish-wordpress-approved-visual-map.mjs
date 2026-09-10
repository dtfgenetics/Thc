import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const humanize=v=>String(v||'').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
const rasterBase=v=>String(v||'').replace(/\.(png|jpe?g|webp)$/i,'');

export async function publishApprovedVisualMap(config){
  const {
    site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,''),
    user=process.env.WP_API_USERNAME||'',
    pass=process.env.WP_API_PASSWORD||'',
    apply=false,
    mapPath,
    curriculumId,
    pageSlug,
    marker,
    liveCurriculumMarker,
    title='Approved visual atlas',
    intro='Only reviewed, finished visuals are published here.',
    backupRoot='/tmp/dtf-approved-visual-map',
    exclusionPath='site/wordpress/assets/infographics/infographic-exclusions.json',
    assetRoot='site/wordpress/assets/infographics'
  }=config||{};
  if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
  if(!mapPath||!curriculumId||!pageSlug||!marker) throw new Error('mapPath, curriculumId, pageSlug and marker are required.');

  const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Approved-Visual-Map/1.0'};
  const stamp=new Date().toISOString().replace(/[-:.]/g,'');
  const backupDir=join(backupRoot,`${pageSlug}-${stamp}`);
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
  if(!Number.isInteger(map?.schemaVersion)||map.schemaVersion<1||map?.curriculumId!==curriculumId) throw new Error(`Invalid visual map for ${curriculumId}.`);
  const exclusions=JSON.parse(await readFile(exclusionPath,'utf8'));
  const fragments=Array.isArray(exclusions.excludePathFragments)?exclusions.excludePathFragments:[];
  const allowed=new Set(Array.isArray(exclusions.allowedExceptions)?exclusions.allowedExceptions:[]);
  const rejectedBasenames=new Set(['THC-C008_Infographic_Flower_Anatomy_Reproduction','THC-C009_Infographic_Trichomes_Secretory_Biology']);
  const isExcluded=file=>{
    const value=String(file||'');
    if(allowed.has(value)) return false;
    return rejectedBasenames.has(rasterBase(basename(value)))||fragments.some(fragment=>value.includes(fragment))||/draft|quarantine|superseded|legacy|qa[-_ ]?required/i.test(value);
  };

  let groups=[];
  if(map.chapters&&typeof map.chapters==='object') groups=Object.entries(map.chapters).map(([id,items])=>({id,title:humanize(id),items:Array.isArray(items)?items:[]}));
  else if(Array.isArray(map.visuals)){
    const byChapter=new Map();
    for(const item of map.visuals){const id=String(item.chapterNumber??'general');if(!byChapter.has(id)) byChapter.set(id,[]);byChapter.get(id).push(item);}
    groups=[...byChapter.entries()].map(([id,items])=>({id:`chapter-${id}`,title:id==='general'?'General':`Chapter ${id}`,items}));
  } else throw new Error(`${mapPath}: expected chapters object or visuals array.`);

  const assets=groups.flatMap(group=>group.items.map(item=>({group:group.id,...item})));
  for(const asset of assets){
    if(!asset.file||isExcluded(asset.file)) throw new Error(`${mapPath}: unsafe/excluded visual mapping: ${asset.file}`);
    await access(`${assetRoot}/${asset.file}`);
  }

  const media=[];
  for(let page=1;page<=5;page+=1){
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
  const resolved=assets.map(asset=>{const wp=mediaIndex.get(norm(asset.file));return {...asset,src:wp?.source_url||`${rawBase}${encodeURIComponent(asset.file).replaceAll('%2F','/')}`,source:wp?'wordpress':'github-canonical'};});

  const htmlGroups=groups.map(group=>{
    const items=resolved.filter(item=>item.group===group.id);
    if(!items.length) return '';
    return `<section class="dtfvm-group" data-dtfvm-group="${esc(group.id)}"><h3>${esc(group.title)}</h3><div class="dtfvm-grid">${items.map(item=>`<figure class="dtfvm-card"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt||item.title||'Approved educational visual')}"></a><figcaption><strong>${esc(item.title||humanize(basename(item.file)))}</strong></figcaption></figure>`).join('')}</div></section>`;
  }).join('');
  const gaps=(map.gaps||[]).map(g=>`<li><strong>${esc(g.title||g.id)}</strong>${g.neededVisual?` — ${esc(g.neededVisual)}`:''}</li>`).join('');
  const block=`<!-- ${marker}:start --><style id="${marker}-style">.dtfvm{background:#eef3ec;color:#14301f;padding:64px 0}.dtfvm *{box-sizing:border-box}.dtfvm-wrap{width:min(1180px,calc(100% - 32px));margin:auto}.dtfvm-head{max-width:820px;margin-bottom:28px}.dtfvm-kicker{font-size:.7rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#85722f}.dtfvm h2{font-size:clamp(2rem,4vw,3.4rem);line-height:1;margin:0 0 12px}.dtfvm h3{font-size:1.6rem;margin:0 0 14px}.dtfvm-group{padding:24px 0;border-top:1px solid #d7e2d9}.dtfvm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.dtfvm-card{margin:0;background:#fff;border:1px solid #d7e2d9;border-radius:16px;overflow:hidden}.dtfvm-card a{display:block;aspect-ratio:4/3;background:#e7eee7}.dtfvm-card img{width:100%;height:100%;object-fit:contain;display:block}.dtfvm-card figcaption{padding:12px 14px}.dtfvm-gaps{margin-top:28px;padding:18px 20px;background:#fff9ed;border:1px solid #e7d6ae;border-radius:16px}.dtfvm-gaps li{margin:.45rem 0}@media(max-width:850px){.dtfvm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.dtfvm-grid{grid-template-columns:1fr}}</style><section class="dtfvm" data-approved-visual-map="${esc(curriculumId)}"><div class="dtfvm-wrap"><header class="dtfvm-head"><p class="dtfvm-kicker">Approved visual library</p><h2>${esc(title)}</h2><p>${esc(intro)}</p><strong>${resolved.length} approved visual${resolved.length===1?'':'s'}</strong></header>${htmlGroups}${gaps?`<aside class="dtfvm-gaps"><strong>Intentionally open visual-production gaps</strong><ul>${gaps}</ul></aside>`:''}</div></section><!-- ${marker}:end -->`;

  const page=await pageBySlug(pageSlug);
  const before=rendered(page.content);
  if(liveCurriculumMarker&&!before.includes(liveCurriculumMarker)) throw new Error(`${pageSlug}: required live curriculum marker is missing.`);
  const startEsc=marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const clean=before.replace(new RegExp(`<!-- ${startEsc}:start -->[\\s\\S]*?<!-- ${startEsc}:end -->`,'g'),'').trim();
  const next=`${clean}\n${block}`;
  await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
  await writeFile(join(backupDir,'next.html'),next);
  if(!apply){console.log(JSON.stringify({apply:false,pageId:page.id,visuals:resolved.length,gaps:(map.gaps||[]).length,backupDir},null,2));return;}

  let wrote=false;
  try{
    await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;
    const edit=rendered((await pageBySlug(pageSlug)).content);
    if(!edit.includes(`data-approved-visual-map="${curriculumId}"`)) throw new Error('Edit-context approved visual marker missing.');
    if((edit.match(/class="dtfvm-card"/g)||[]).length!==resolved.length) throw new Error(`Edit-context visual count is not ${resolved.length}.`);
    for(const fragment of fragments) if(fragment&&edit.includes(fragment)&&!allowed.has(fragment)) throw new Error(`Excluded visual family leaked into edit context: ${fragment}`);
    for(const rejected of rejectedBasenames) if(edit.includes(rejected)) throw new Error(`Rejected visual leaked into edit context: ${rejected}`);

    let visitor='';let ok=false;
    for(let attempt=1;attempt<=8;attempt+=1){
      try{const response=await fetch(`${site}${map.route||`/learn/${pageSlug}/`}?dtf_visual_audit=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Approved-Visual-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});visitor=await response.text();if(response.ok&&visitor.includes(`data-approved-visual-map="${curriculumId}"`)){ok=true;break;}}catch{}
      await sleep(attempt*1800);
    }
    await writeFile(join(backupDir,'visitor.html'),visitor);
    if(!ok) throw new Error('Visitor approved visual marker missing.');
    if((visitor.match(/class="dtfvm-card"/g)||[]).length!==resolved.length) throw new Error(`Visitor visual count is not ${resolved.length}.`);
    for(const rejected of rejectedBasenames) if(visitor.includes(rejected)) throw new Error(`Rejected visual leaked into visitor page: ${rejected}`);
    const report={generatedAt:new Date().toISOString(),apply:true,pageId:page.id,visuals:resolved.length,groups:groups.filter(g=>g.items.length).length,gaps:(map.gaps||[]).length,visitorVerified:true,backupDir};
    await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
    console.log(JSON.stringify(report,null,2));
  }catch(error){
    if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:true,reason:error.message},null,2)}\n`);}catch(rollbackError){await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify({restored:false,reason:error.message,rollbackError:rollbackError.message},null,2)}\n`);}}
    throw error;
  }
}
