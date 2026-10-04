import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME;
const pass=process.env.WP_API_PASSWORD;
const mapFile=process.env.ENCYCLOPEDIA_VISUAL_MAP||'site/wordpress/education/encyclopedia/volume03-visual-map.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-encyclopedia-visuals';
const assetRoot=path.join(process.cwd(),'site/wordpress/assets/infographics');
if(!user||!pass) throw new Error('Missing WordPress API credentials.');
const auth=Buffer.from(`${user}:${pass}`).toString('base64');
const map=JSON.parse(await readFile(mapFile,'utf8'));
if(map?.schemaVersion!==1||!Array.isArray(map.items)||map.items.length<1||map.items.length>420) throw new Error('Visual map must contain 1-420 schemaVersion 1 items.');

const ids=map.items.map(x=>x.id);
if(new Set(ids).size!==ids.length) throw new Error('Visual map lesson IDs must be unique.');
if(map.batch==='encyclopedia-all-visuals-v1'){
  const expectedIds=Array.from({length:420},(_,i)=>`THC-ENC-${String(i+1).padStart(3,'0')}`);
  if(ids.length!==420||expectedIds.some(id=>!ids.includes(id))) throw new Error('Full visual map must contain exactly THC-ENC-001 through THC-ENC-420.');
}
if(new Set(map.items.map(x=>x.assetPath)).size!==map.items.length) throw new Error('Visual map asset paths must be unique.');
for(const item of map.items){
  if(!item.title||!/^THC-ENC-\d{3}$/.test(item.id)||!/\.(?:jpe?g|png|webp)$/i.test(item.assetPath)) throw new Error(`Invalid visual map item: ${JSON.stringify(item)}`);
}

const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const stablePageSlug=id=>id.toLowerCase();
const slugify=value=>String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,145);
async function canonicalMediaIdentity(assetPath){
  const full=path.join(assetRoot,assetPath);
  const bytes=await readFile(full);
  const ext=path.extname(assetPath).toLowerCase();
  const hash=createHash('sha256').update(bytes).digest('hex');
  const baseSlug=slugify(assetPath.slice(0,-ext.length))||'visual';
  return {full,hash,slug:`dtf-edu-${baseSlug}-${hash.slice(0,10)}`.slice(0,190)};
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transientStatuses=new Set([429,500,502,503,504]);
const writeDelayMs=Math.max(0,Number(process.env.ENCYCLOPEDIA_VISUAL_WP_WRITE_DELAY_MS||100));
async function request(endpoint,{method='GET',body}={}){
  const retrySafe=method==='GET'||(method==='POST'&&/^\/(?:pages|media)\/\d+$/.test(endpoint))||(method==='DELETE'&&/^\/media\/\d+/.test(endpoint));
  const maxAttempts=retrySafe?7:1;
  let lastError=null;
  for(let attempt=1;attempt<=maxAttempts;attempt+=1){
    try{
      const res=await fetch(`${site}/wp-json/wp/v2${endpoint}`,{
        method,
        headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'},
        body:body?JSON.stringify(body):undefined,
        signal:AbortSignal.timeout(60_000)
      });
      const text=await res.text(); let parsed;
      try{parsed=text?JSON.parse(text):null;}catch{parsed=text;}
      if(res.ok){
        if(method!=='GET'&&writeDelayMs) await sleep(writeDelayMs);
        return {data:parsed,headers:res.headers};
      }
      const message=`${method} ${endpoint} failed ${res.status}: ${typeof parsed==='string'?parsed.slice(0,900):JSON.stringify(parsed).slice(0,900)}`;
      if(!retrySafe||!transientStatuses.has(res.status)||attempt===maxAttempts) throw new Error(message);
      const retryAfter=Number(res.headers.get('retry-after')||0);
      const delay=retryAfter>0?retryAfter*1000:Math.min(15_000,750*(2**(attempt-1)));
      console.warn(`${message} · retrying attempt ${attempt+1}/${maxAttempts} after ${delay}ms`);
      await sleep(delay);
    }catch(error){
      lastError=error;
      const retryableNetwork=retrySafe&&(error?.name==='TimeoutError'||error?.name==='AbortError'||/fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(String(error?.message||error)));
      if(!retryableNetwork||attempt===maxAttempts) throw error;
      const delay=Math.min(15_000,750*(2**(attempt-1)));
      console.warn(`${method} ${endpoint} network error: ${String(error?.message||error)} · retrying attempt ${attempt+1}/${maxAttempts} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastError||new Error(`${method} ${endpoint} exhausted retries`);
}
async function wp(endpoint,opts){return (await request(endpoint,opts)).data;}
async function recoverUploadedMedia(item,identity,defaultSlug){
  const candidates=[];
  for(const slug of [identity.slug,defaultSlug]){
    const rows=await wp(`/media?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`).catch(()=>[]);
    for(const row of rows||[]) if(!candidates.some(x=>x.id===row.id)) candidates.push(row);
  }
  const matching=candidates.filter(row=>{
    const source=String(row.source_url||'');
    const filename=path.basename(item.assetPath).replace(/["\r\n]/g,'_');
    return row.slug===identity.slug||row.slug===defaultSlug||source.endsWith('/'+filename);
  });
  if(matching.length>1) throw new Error(`${item.id}: ambiguous media recovery found ${matching.length} candidate uploads.`);
  return matching[0]||null;
}
async function uploadCanonicalMedia(item,identity){
  const bytes=await readFile(identity.full);
  const ext=path.extname(item.assetPath).toLowerCase();
  const mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';
  const filename=path.basename(item.assetPath).replace(/["\r\n]/g,'_');
  const defaultSlug=slugify(filename.slice(0,-ext.length));
  let created=null;
  let lastError=null;
  for(let attempt=1;attempt<=5;attempt+=1){
    try{
      const res=await fetch(`${site}/wp-json/wp/v2/media`,{
        method:'POST',
        headers:{
          Authorization:`Basic ${auth}`,
          'Content-Type':mime,
          'Content-Disposition':`attachment; filename="${filename}"`,
          'Cache-Control':'no-cache, no-store, max-age=0',
          Pragma:'no-cache'
        },
        body:bytes,
        signal:AbortSignal.timeout(60_000)
      });
      const text=await res.text();
      try{created=text?JSON.parse(text):null;}catch{created=text;}
      if(res.ok&&created?.id) break;
      const message=`${item.id}: media upload failed ${res.status}: ${typeof created==='string'?created.slice(0,900):JSON.stringify(created).slice(0,900)}`;
      if(!transientStatuses.has(res.status)||attempt===5) throw new Error(message);
      lastError=new Error(message);
    }catch(error){
      lastError=error;
      const recovered=await recoverUploadedMedia(item,identity,defaultSlug);
      if(recovered){created=recovered;break;}
      if(attempt===5) throw error;
    }
    const delay=Math.min(15_000,1000*(2**(attempt-1)));
    console.warn(`${item.id}: retrying media upload attempt ${attempt+1}/5 after ${delay}ms`);
    await sleep(delay);
  }
  if(!created?.id) throw lastError||new Error(`${item.id}: media upload exhausted retries`);
  const description=`DTF Genetics THC Encyclopedia companion teaching visual. Repository path: ${item.assetPath}. SHA-256: ${identity.hash}.`;
  const updated=await wp(`/media/${created.id}`,{method:'POST',body:{
    slug:identity.slug,
    title:item.title,
    alt_text:item.altText||`${item.title} — companion teaching visual`,
    caption:`${item.id} companion teaching visual for Teaching Healthy Cultivation.`,
    description
  }});
  if(!String(updated?.source_url||'').includes('/wp-content/uploads/')) throw new Error(`${item.id}: uploaded media source URL is not a WordPress upload URL.`);
  return updated;
}
async function getAll(endpoint){
  const out=[];
  for(let page=1;;page++){
    const join=endpoint.includes('?')?'&':'?';
    const rows=await wp(`${endpoint}${join}per_page=100&page=${page}`);
    if(!Array.isArray(rows)) throw new Error(`Expected array from ${endpoint}`);
    out.push(...rows);
    if(rows.length<100) break;
  }
  return out;
}

const pagePreflightById=new Map();
const preflightConcurrency=Math.max(1,Math.min(20,Number(process.env.ENCYCLOPEDIA_VISUAL_PREFLIGHT_CONCURRENCY||8)));
let preflightNext=0;
async function preflightWorker(){
  while(true){
    const index=preflightNext++;
    if(index>=map.items.length) return;
    const item=map.items[index];
    const pages=await wp(`/pages?slug=${encodeURIComponent(stablePageSlug(item.id))}&context=edit&per_page=100`);
    const pageMatches=(pages||[]).filter(p=>String(p.content?.raw||'').includes(`data-thc-encyclopedia-id=\\"${item.id}\\"`)||String(p.content?.raw||'').includes(`data-thc-encyclopedia-id="${item.id}"`));
    if(pageMatches.length!==1) throw new Error(`${item.id}: expected exactly one canonical encyclopedia page, found ${pageMatches.length}.`);
    const page=pageMatches[0];
    const raw=String(page.content?.raw||'');
    if(!raw.includes('<h2>Terms to know</h2>')) throw new Error(`${item.id}: canonical insertion marker is missing.`);
    pagePreflightById.set(item.id,{page,raw});
  }
}
await Promise.all(Array.from({length:preflightConcurrency},()=>preflightWorker()));
if(pagePreflightById.size!==map.items.length) throw new Error('Page preflight did not resolve every visual-map lesson.');

const media=await getAll('/media?context=edit&orderby=id&order=asc');
const preflight=[];
for(const item of map.items){
  const identity=await canonicalMediaIdentity(item.assetPath);
  const pathMarker=`Repository path: ${item.assetPath}.`;
  const mediaMatches=[...new Map(media.filter(m=>{
    const description=String(m.description?.raw||m.description?.rendered||'');
    return m.slug===identity.slug||description.includes(pathMarker);
  }).map(m=>[m.id,m])).values()];
  if(mediaMatches.length>1) throw new Error(`${item.id}: expected at most one WordPress media item for ${item.assetPath} (slug ${identity.slug}), found ${mediaMatches.length}.`);
  let mediaItem=mediaMatches[0]||null;
  let mediaCreated=false;
  if(!mediaItem){
    mediaItem=await uploadCanonicalMedia(item,identity);
    media.push(mediaItem);
    mediaCreated=true;
  }
  if(!String(mediaItem.source_url||'').includes('/wp-content/uploads/')) throw new Error(`${item.id}: media source URL is not a WordPress upload URL.`);
  const pagePreflight=pagePreflightById.get(item.id);
  if(!pagePreflight) throw new Error(`${item.id}: page preflight record is missing.`);
  const {page,raw}=pagePreflight;
  preflight.push({item,media:mediaItem,page,raw,mediaSlug:mediaItem.slug,assetHash:identity.hash,mediaCreated});
}

const now=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(backupRoot,now);
await mkdir(backupDir,{recursive:true});
await writeFile(path.join(backupDir,'preflight.json'),JSON.stringify(preflight.map(x=>({
  id:x.item.id,title:x.item.title,assetPath:x.item.assetPath,assetSha256:x.assetHash,pageId:x.page.id,pageLink:x.page.link,mediaId:x.media.id,mediaSlug:x.mediaSlug,mediaSourceUrl:x.media.source_url,mediaCreated:x.mediaCreated
})),null,2));
await writeFile(path.join(backupDir,'pre-write-pages.json'),JSON.stringify(preflight.map(x=>({
  id:x.item.id,pageId:x.page.id,status:x.page.status,slug:x.page.slug,title:x.page.title?.raw||x.page.title?.rendered||'',content:x.raw,excerpt:x.page.excerpt?.raw||''
})),null,2));

function visualBlock(x){
  const id=esc(x.item.id), title=esc(x.item.title), alt=esc(x.item.altText||`${x.item.title} — companion teaching visual`), src=esc(x.media.source_url);
  return `<!-- THC-ENC-VISUAL:${id} START -->\n<figure class="thc-lesson-visual" data-thc-lesson-visual-id="${id}" style="margin:24px 0 30px;padding:14px;background:#f4f8f5;border:1px solid #dbe8df;border-radius:18px">\n<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${alt}" loading="lazy" decoding="async" style="display:block;width:100%;height:auto;border-radius:12px"></a>\n<figcaption style="margin:10px 4px 2px;line-height:1.55;color:#587064"><strong>${id} companion teaching visual.</strong> Visual support for this controlled lesson. <a href="/learn/infographics/">Open the searchable infographic library →</a></figcaption>\n</figure>\n<!-- THC-ENC-VISUAL:${id} END -->`;
}
function nextContent(x){
  const marker=new RegExp(`<!-- THC-ENC-VISUAL:${x.item.id} START -->[\\s\\S]*?<!-- THC-ENC-VISUAL:${x.item.id} END -->\\s*`,'g');
  const cleaned=x.raw.replace(marker,'');
  const anchor='<h2>Terms to know</h2>';
  const idx=cleaned.indexOf(anchor);
  if(idx<0) throw new Error(`${x.item.id}: insertion marker disappeared after cleanup.`);
  const result=cleaned.slice(0,idx)+visualBlock(x)+'\n'+cleaned.slice(idx);
  const count=(result.match(new RegExp(`data-thc-lesson-visual-id=\"${x.item.id}\"`,'g'))||[]).length;
  if(count!==1) throw new Error(`${x.item.id}: expected exactly one visual marker after render, found ${count}.`);
  return result;
}

const updated=[];
let rollback={attempted:false,succeeded:[],failed:[]};
try{
  for(const x of preflight){
    const content=nextContent(x);
    const page=await wp(`/pages/${x.page.id}`,{method:'POST',body:{content,status:x.page.status}});
    updated.push({id:x.item.id,pageId:page.id,link:page.link,mediaId:x.media.id,mediaSlug:x.mediaSlug,mediaSourceUrl:x.media.source_url,assetPath:x.item.assetPath,assetSha256:x.assetHash});
  }
}catch(error){
  rollback.attempted=true;
  for(const done of [...updated].reverse()){
    const original=preflight.find(x=>x.item.id===done.id);
    try{
      await wp(`/pages/${original.page.id}`,{method:'POST',body:{content:original.raw,status:original.page.status}});
      rollback.succeeded.push(done.id);
    }catch(rollbackError){
      rollback.failed.push({id:done.id,error:String(rollbackError?.message||rollbackError)});
    }
  }
  for(const created of preflight.filter(x=>x.mediaCreated).reverse()){
    try{
      await wp(`/media/${created.media.id}?force=true`,{method:'DELETE'});
      rollback.succeeded.push(`${created.item.id}:media`);
    }catch(mediaRollbackError){
      rollback.failed.push({id:`${created.item.id}:media`,error:String(mediaRollbackError?.message||mediaRollbackError)});
    }
  }
  await writeFile(path.join(backupDir,'rollback-result.json'),JSON.stringify(rollback,null,2));
  throw error;
}

const report={
  batch:map.batch,
  mapFile,
  lessonVisualsAttached:updated.length,
  existingWordPressMediaReused:preflight.filter(x=>!x.mediaCreated).length,
  newMediaUploads:preflight.filter(x=>x.mediaCreated).length,
  updated,
  rollback,
  backupDir,
  generatedAt:new Date().toISOString()
};
await writeFile(path.join(backupDir,'encyclopedia-visual-publication-report.json'),JSON.stringify(report,null,2));
await writeFile(path.join(backupRoot,'latest-backup-path.txt'),backupDir+'\n');
console.log(JSON.stringify(report,null,2));
