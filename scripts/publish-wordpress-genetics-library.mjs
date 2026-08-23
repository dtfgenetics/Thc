import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const catalogPath=process.env.SEED_LINE_CATALOG||'site/wordpress/products/seed-line-catalog.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/wordpress-genetics-library';
const apply=String(process.env.APPLY_GENETICS_LIBRARY||'').toLowerCase()==='true';

if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const { readFile }=await import('node:fs/promises');
const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
if(catalog?.schemaVersion!==1||!Array.isArray(catalog?.lines)||catalog.lines.length<8) throw new Error('Seed line catalog is missing or incomplete.');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Genetics-Library/1.1'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const { join, basename }=await import('node:path');
const backupDir=join(backupRoot,`genetics-library-${stamp}`);
await mkdir(backupDir,{recursive:true});

const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const esc=(value='')=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const plain=(value='')=>String(value).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

async function fetchRetry(url,options={},attempts=4){
  let last;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{
      const response=await fetch(url,{...options,redirect:'follow',signal:AbortSignal.timeout(60_000),headers:{...headers,...(options.headers||{})}});
      if(!response.ok) throw new Error(`${options.method||'GET'} ${url} returned HTTP ${response.status}`);
      return response;
    }catch(error){
      last=error;
      if(attempt<attempts) await sleep(attempt*1300);
    }
  }
  throw last;
}
async function request(path,options={}){
  const response=await fetchRetry(`${siteUrl}${path}`,{
    ...options,
    headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}
  });
  const text=await response.text();
  if(!text) return null;
  try{return JSON.parse(text);}catch{return {raw:text.slice(0,1500)};}
}
async function getSinglePage(slug,parent){
  const params=new URLSearchParams({slug,context:'edit',per_page:'20'});
  if(parent) params.set('parent',String(parent));
  const rows=await request(`/wp-json/wp/v2/pages?${params}`);
  if(!Array.isArray(rows)) throw new Error(`Unexpected page response for ${slug}`);
  if(rows.length>1) throw new Error(`Multiple WordPress pages found for slug ${slug}`);
  return rows[0]||null;
}
async function mediaBySlug(slug){
  const rows=await request(`/wp-json/wp/v2/media?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  return Array.isArray(rows)?rows:[];
}
async function remoteBytes(url){
  const response=await fetchRetry(url,{headers:{'Cache-Control':'no-cache, no-store, max-age=0'}},3);
  return Buffer.from(await response.arrayBuffer());
}

function imageInfo(bytes){
  if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
    return {format:'png',mimeType:'image/png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  }
  if(bytes.subarray(0,3).toString('hex')==='ffd8ff'){
    let offset=2;
    while(offset+9<bytes.length){
      if(bytes[offset]!==0xff){offset+=1;continue;}
      const marker=bytes[offset+1];
      if(marker===0xd8||marker===0xd9){offset+=2;continue;}
      const length=bytes.readUInt16BE(offset+2);
      if(length<2||offset+2+length>bytes.length) break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        return {format:'jpeg',mimeType:'image/jpeg',height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};
      }
      offset+=2+length;
    }
    return {format:'jpeg',mimeType:'image/jpeg',width:null,height:null};
  }
  throw new Error('Downloaded file is not a PNG or JPEG image.');
}

async function downloadReviewedCard(card){
  const urls=[
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(card.driveFileId)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(card.driveFileId)}&confirm=t`
  ];
  const failures=[];
  for(const url of urls){
    try{
      const response=await fetchRetry(url,{headers:{Accept:'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}},3);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length<100_000) throw new Error(`image rendition is unexpectedly small (${bytes.length} bytes)`);
      const info=imageInfo(bytes);
      if(Number(card.expectedWidth)&&info.width!==Number(card.expectedWidth)) throw new Error(`width ${info.width} != ${card.expectedWidth}`);
      if(Number(card.expectedHeight)&&info.height!==Number(card.expectedHeight)) throw new Error(`height ${info.height} != ${card.expectedHeight}`);
      return {bytes,hash:sha256(bytes),sourceUrl:url,mimeType:info.mimeType,width:info.width,height:info.height};
    }catch(error){failures.push(`${url}: ${error.message}`);}
  }
  throw new Error(`${card.fileName}: reviewed Drive image could not be downloaded and validated. ${failures.join(' | ')}`);
}

async function ensureMedia(line,card,downloaded){
  const {bytes,hash,mimeType}=downloaded;
  const exactSlug=`${card.wordpressSlug}-${hash.slice(0,10)}`;
  const candidates=[...(await mediaBySlug(card.wordpressSlug)),...(await mediaBySlug(exactSlug))];
  for(const item of candidates){
    if(!item?.source_url) continue;
    try{
      const remote=await remoteBytes(item.source_url);
      if(remote.length===bytes.length&&sha256(remote)===hash){
        if(apply){
          return request(`/wp-json/wp/v2/media/${item.id}`,{
            method:'POST',
            body:JSON.stringify({
              title:card.fileName.replace(/\.[^.]+$/,''),
              alt_text:card.altText,
              caption:`DTF Genetics · ${line.name} · ${card.generation} ${card.seedType}`
            })
          });
        }
        return item;
      }
    }catch{}
  }
  if(!apply) return {id:null,source_url:null,slug:exactSlug,dryRun:true};

  const ext=mimeType==='image/png'?'.png':'.jpg';
  const stem=basename(card.fileName).replace(/\.[^.]+$/,'');
  const uploadName=`${stem}${ext}`;
  const upload=await fetch(`${siteUrl}/wp-json/wp/v2/media`,{
    method:'POST',
    redirect:'follow',
    signal:AbortSignal.timeout(120_000),
    headers:{
      ...headers,
      'Content-Type':mimeType,
      'Content-Disposition':`attachment; filename="${uploadName}"`
    },
    body:bytes
  });
  const text=await upload.text();
  let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,1200)};}
  if(!upload.ok||!body?.id) throw new Error(`${card.fileName}: WordPress upload failed (${upload.status}): ${body?.message||body?.raw||'unknown'}`);

  const updated=await request(`/wp-json/wp/v2/media/${body.id}`,{
    method:'POST',
    body:JSON.stringify({
      slug:exactSlug,
      title:stem,
      alt_text:card.altText,
      caption:`DTF Genetics · ${line.name} · ${card.generation} ${card.seedType}`
    })
  });
  const remote=await remoteBytes(updated.source_url);
  if(remote.length!==bytes.length||sha256(remote)!==hash) throw new Error(`${card.fileName}: uploaded WordPress original failed runtime byte verification`);
  return updated;
}

function badge(text){
  return `<span style="display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;background:#e7f1e9;color:#17462a;font-size:.78rem;font-weight:850;letter-spacing:.04em;text-transform:uppercase">${esc(text)}</span>`;
}
function button(href,label,primary=true){
  const bg=primary?'#173c25':'#fff';
  const fg=primary?'#fff':'#173c25';
  return `<a href="${esc(href)}" style="display:inline-block;margin:5px 8px 5px 0;padding:12px 18px;border-radius:999px;background:${bg};color:${fg};border:1px solid #173c25;text-decoration:none;font-weight:850">${esc(label)}</a>`;
}
function image(media,alt,{eager=false}={}){
  if(!media?.source_url) return '';
  return `<img src="${esc(media.source_url)}" alt="${esc(alt)}" ${eager?'loading="eager" fetchpriority="high"':'loading="lazy"'} decoding="async" style="display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;border-radius:22px;box-shadow:0 18px 46px rgba(8,34,17,.16)">`;
}
function cardPanel(inner){
  return `<article style="background:#fff;border:1px solid #dce8df;border-radius:24px;padding:20px;box-shadow:0 12px 34px rgba(13,55,29,.07)">${inner}</article>`;
}
function lineageHtml(line){
  if(line.lineage) return `<p><strong>Lineage:</strong> ${esc(line.lineage)}</p>`;
  return `<p><strong>Lineage:</strong> Controlled parentage record not yet published. DTF will not guess or invent parentage.</p>`;
}
function traitsHtml(line){
  const items=(line.breedingDirection||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  return items?`<ul>${items}</ul>`:'';
}
function storeButtons(line){
  if(!Array.isArray(line.storeRoutes)||!line.storeRoutes.length) return `<p style="color:#5c6c61"><strong>Store status:</strong> No current WooCommerce route is claimed from this catalog page.</p>`;
  return `<p>${line.storeRoutes.map((r,i)=>button(r.path,r.label,i===0)).join('')}</p>`;
}
function releaseGallery(line,mediaList){
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">${line.releaseCards.map((c,i)=>cardPanel(`${image(mediaList[i],c.altText,{eager:i===0})}<p style="margin:14px 0 4px">${badge(`${c.generation} · ${c.seedType}`)}</p><h3 style="font-size:1.25rem;margin:8px 0 0">${esc(line.name)}</h3>`)).join('')}</div>`;
}
function linePageHtml(line,mediaList){
  return `<div data-dtf-genetics-line="${esc(line.slug)}" style="background:#f4f8f4;color:#173522">
<section style="max-width:1180px;margin:auto;padding:54px 22px 34px">
  <p style="margin:0 0 10px;color:#2d7d48;font-size:.82rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase">DTF Genetics · line profile</p>
  <h1 style="font-size:clamp(2.5rem,6vw,4.8rem);line-height:.98;letter-spacing:-.04em;margin:0 0 16px">${esc(line.name)}</h1>
  <p style="font-size:1.12rem;line-height:1.8;color:#46604e;max-width:800px">${esc(line.summary)}</p>
  <p>${badge(line.status.replaceAll('-',' '))}</p>
</section>
<section style="max-width:1180px;margin:auto;padding:8px 22px 54px">${releaseGallery(line,mediaList)}</section>
<section style="background:#12341f;color:#fff"><div style="max-width:1180px;margin:auto;padding:54px 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px">
  <div><h2 style="font-size:clamp(1.8rem,4vw,3rem);margin:0 0 14px;color:#fff">Lineage & project direction</h2>${lineageHtml(line)}${line.releaseSpecificLineage?`<p><strong>Reviewed F1 card lineage:</strong> ${esc(line.releaseSpecificLineage)}</p>`:''}${line.floweringObservation?`<p><strong>Flowering observation:</strong> ${esc(line.floweringObservation)}</p>`:''}</div>
  <div><h2 style="font-size:1.5rem;margin:0 0 12px;color:#fff">Selection / packaging direction</h2>${traitsHtml(line)}<p style="color:#cfe0d3;line-height:1.7">These are breeding goals, packaging observations, or planning ranges—not guarantees that every seed will express identical traits.</p></div>
</div></section>
<section style="max-width:1180px;margin:auto;padding:54px 22px">
  <h2 style="font-size:clamp(1.8rem,4vw,2.8rem);margin:0 0 12px">Availability</h2>
  ${storeButtons(line)}
  <p>${button('/seeds/','Back to Seeds / Genetics',false)}${button('/learn/genetics-breeding/','Learn genetics & breeding',false)}</p>
</section>
</div>`;
}

const seedsPage=await getSinglePage('seeds',null);
if(!seedsPage?.id) throw new Error('Canonical /seeds/ page was not found.');
await writeFile(join(backupDir,'seeds-before.json'),`${JSON.stringify(seedsPage,null,2)}\n`);

const prepared=[];
for(const line of catalog.lines){
  const media=[];
  const downloads=[];
  for(const card of line.releaseCards){
    const downloaded=await downloadReviewedCard(card);
    downloads.push(downloaded);
    media.push(await ensureMedia(line,card,downloaded));
  }
  prepared.push({line,media,downloads});
}

const childResults=[];
for(const {line,media} of prepared){
  const existing=await getSinglePage(line.slug,seedsPage.id);
  if(existing) await writeFile(join(backupDir,`page-${existing.id}-${line.slug}-before.json`),`${JSON.stringify(existing,null,2)}\n`);
  const payload={
    slug:line.slug,
    parent:seedsPage.id,
    title:`${line.name} | DTF Genetics`,
    content:linePageHtml(line,media),
    excerpt:plain(line.summary),
    status:'publish',
    featured_media:Number(media[0]?.id)||0
  };
  let page=existing;
  if(apply){
    page=existing
      ? await request(`/wp-json/wp/v2/pages/${existing.id}`,{method:'POST',body:JSON.stringify(payload)})
      : await request('/wp-json/wp/v2/pages',{method:'POST',body:JSON.stringify(payload)});
  }
  childResults.push({slug:line.slug,id:page?.id||existing?.id||null,status:page?.status||existing?.status||'dry-run',link:page?.link||`${siteUrl}/seeds/${line.slug}/`});
}

const grid=prepared.map(({line,media})=>{
  const first=line.releaseCards[0];
  const img=image(media[0],first.altText);
  const releases=line.releaseCards.map(c=>`${c.generation} ${c.seedType}`).join(' · ');
  const lineage=line.lineage?esc(line.lineage):'Lineage record pending';
  return cardPanel(`<a href="/seeds/${esc(line.slug)}/" style="color:inherit;text-decoration:none">${img}<p style="margin:14px 0 8px">${badge(releases)}</p><h2 style="font-size:1.55rem;margin:0 0 8px">${esc(line.name)}</h2><p style="font-weight:800;color:#2a5838">${lineage}</p><p style="line-height:1.7;color:#506357">${esc(line.summary)}</p><span style="font-weight:850;color:#215d36">Open line profile →</span></a>`);
}).join('');

const currentStoreRoutes=[
  {label:'Blue Mango F2 Regular',path:'/product/10-regular-f2-blue-mango-seeds/'},
  {label:'Blue Mango F2 Feminized',path:'/product/10-feminized-f2-blue-mango-x/'},
  {label:'Blue Bubblegum F1 Regular',path:'/product/10-reg-f1-blueberry-bubblegum/'}
];

const blueMango=prepared.find(x=>x.line.id==='blue-mango');
const seedsHtml=`<div data-dtf-genetics-library="2026" style="background:#f4f8f4;color:#173522">
<section style="max-width:1240px;margin:auto;padding:58px 22px 38px;display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:38px;align-items:center">
  <div><p style="margin:0 0 10px;color:#2d7d48;font-size:.82rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase">DTF Genetics · documented breeding library</p><h1 style="font-size:clamp(2.6rem,6vw,5rem);line-height:.98;letter-spacing:-.045em;margin:0 0 20px">From breeding notes to current releases.</h1><p style="font-size:1.13rem;line-height:1.8;color:#46604e;max-width:760px">Browse DTF Genetics by line. Every profile has a title, reviewed strain-card artwork, generation and seed-type context, description, verified lineage where available, and direct store routes only when a WooCommerce listing actually exists.</p><p>${button('#genetics-library','Browse the genetics library',true)}${button('/shop/','Shop current releases',false)}${button('/learn/genetics-breeding/','Learn genetics & breeding',false)}</p></div>
  <div>${image(blueMango?.media?.[0],blueMango?.line?.releaseCards?.[0]?.altText||'Blue Mango DTF Genetics strain card',{eager:true})}</div>
</section>
<section id="genetics-library" style="max-width:1240px;margin:auto;padding:12px 22px 62px">
  <div style="display:flex;justify-content:space-between;gap:20px;align-items:end;flex-wrap:wrap;margin-bottom:22px"><div><p style="margin:0 0 8px;color:#2d7d48;font-weight:900;text-transform:uppercase;letter-spacing:.12em">Line profiles</p><h2 style="font-size:clamp(2rem,4vw,3.35rem);margin:0">DTF Genetics library</h2></div><p style="max-width:570px;color:#516858;line-height:1.65;margin:0">Unknown parentage is intentionally labeled as unverified rather than guessed. Trait copy is treated as breeding or packaging direction, not a guaranteed phenotype.</p></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px">${grid}</div>
</section>
<section style="background:#12341f;color:#fff"><div style="max-width:1240px;margin:auto;padding:58px 22px">
  <p style="margin:0 0 8px;color:#8ed1a1;font-weight:900;text-transform:uppercase;letter-spacing:.12em">Current WooCommerce routes</p><h2 style="font-size:clamp(2rem,4vw,3rem);margin:0 0 14px;color:#fff">Shop only what is actually listed.</h2><p style="max-width:780px;line-height:1.8;color:#cee0d2">Product pages control current price, inventory, quantity, seed type, fulfillment information and policies. The genetics library never invents availability.</p><p>${currentStoreRoutes.map((r,i)=>button(r.path,r.label,i===0)).join('')}</p>
</div></section>
<section style="max-width:1240px;margin:auto;padding:58px 22px">
  <h2 style="font-size:clamp(1.9rem,4vw,3rem);margin:0 0 14px">How to read the catalog</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px">
    ${cardPanel('<h3>Lineage</h3><p>Verified parents are shown when a controlled record or reviewed release card supports them. Unknown parentage stays unknown until documented.</p>')}
    ${cardPanel('<h3>Generation & seed type</h3><p>F1, F2, F3, BX1, regular and feminized labels belong to specific releases. A line can have more than one release form.</p>')}
    ${cardPanel('<h3>Traits & timing</h3><p>Aroma, color, resin, structure and flowering windows describe breeding direction or planning observations. Environment and phenotype variation matter.</p>')}
  </div>
</section>
</div>`;

let seedsAfter=seedsPage;
if(apply){
  seedsAfter=await request(`/wp-json/wp/v2/pages/${seedsPage.id}`,{
    method:'POST',
    body:JSON.stringify({
      title:'Seeds / Genetics',
      content:seedsHtml,
      status:'publish',
      featured_media:Number(blueMango?.media?.[0]?.id)||0
    })
  });
}

const report={
  generatedAt:new Date().toISOString(),
  siteUrl,
  apply,
  seedsPageId:seedsAfter?.id||seedsPage.id,
  lineCount:catalog.lines.length,
  cardCount:catalog.lines.reduce((sum,line)=>sum+line.releaseCards.length,0),
  media:prepared.flatMap(({line,media,downloads})=>media.map((m,i)=>({
    line:line.slug,
    generation:line.releaseCards[i].generation,
    seedType:line.releaseCards[i].seedType,
    driveFileId:line.releaseCards[i].driveFileId,
    renditionBytes:downloads[i].bytes.length,
    renditionSha256:downloads[i].hash,
    width:downloads[i].width,
    height:downloads[i].height,
    id:m?.id||null,
    url:m?.source_url||null
  }))),
  pages:childResults
};
await writeFile(join(backupDir,'genetics-library-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'genetics-library-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
