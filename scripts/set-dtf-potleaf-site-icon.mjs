// production-trigger: 2026-08-30 potleaf favicon v3 transport resilience
import dns from 'node:dns';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const iconPath=process.env.DTF_BRAND_ICON||join(process.cwd(),'site/wordpress/assets/brand/dtf-potleaf-512.png');
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-potleaf-site-icon';
const cacheVersion=(process.env.DTF_ICON_CACHE_VERSION||'v3-20260823').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
const mediaSlug=`dtf-potleaf-site-icon-${cacheVersion}`;
const uploadFilename=`${mediaSlug}.png`;
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
if(!cacheVersion) throw new Error('DTF_ICON_CACHE_VERSION resolved to an empty value');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Potleaf-Icon/3.1'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,stamp);
await mkdir(backupDir,{recursive:true});

const transientStatuses=new Set([408,425,429,500,502,503,504]);
const transientCodes=new Set(['ETIMEDOUT','ECONNRESET','ECONNREFUSED','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET']);
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

function errorCode(error){
  return error?.code||error?.cause?.code||error?.cause?.errors?.find?.((entry)=>entry?.code)?.code||'';
}

function isTransientError(error){
  const status=Number(error?.status||0);
  return transientStatuses.has(status)||error instanceof TypeError||error?.name==='TimeoutError'||error?.name==='AbortError'||transientCodes.has(errorCode(error));
}

function retryDelay(attempt){
  return Math.min(12_000,1200+(attempt*1800));
}

async function request(path,options={}){
  const method=String(options.method||'GET').toUpperCase();
  const attempts=Math.max(1,Number(options.attempts||7));
  const fetchOptions={...options};
  delete fetchOptions.attempts;
  let lastError=null;

  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{
        ...fetchOptions,
        headers:{...headers,...(fetchOptions.body?{'Content-Type':'application/json'}:{}),...(fetchOptions.headers||{})},
        redirect:'follow',
        signal:AbortSignal.timeout(45_000)
      });
      const text=await response.text();
      let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
      if(!response.ok){
        const error=new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
        error.status=response.status;
        throw error;
      }
      return body;
    }catch(error){
      lastError=error;
      if(!isTransientError(error)||attempt>=attempts) throw error;
      const delay=retryDelay(attempt);
      console.warn(`[potleaf-retry] ${method} ${path} failed with ${errorCode(error)||error?.name||error?.status||'transient error'}; retrying ${attempt}/${attempts} in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError||new Error(`${method} ${path} failed after ${attempts} attempts`);
}

async function findExistingIconMedia(){
  const existing=await request(`/wp-json/wp/v2/media?slug=${encodeURIComponent(mediaSlug)}&context=edit&per_page=10`);
  return Array.isArray(existing)&&existing[0]?.id?existing[0]:null;
}

async function uploadIconMedia(){
  const bytes=await readFile(iconPath);
  let lastError=null;

  for(let attempt=1;attempt<=3;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}/wp-json/wp/v2/media`,{
        method:'POST',
        headers:{...headers,'Content-Type':'image/png','Content-Disposition':`attachment; filename="${uploadFilename}"`},
        body:bytes,
        redirect:'follow',
        signal:AbortSignal.timeout(120_000)
      });
      const text=await response.text();
      let body=null;try{body=JSON.parse(text);}catch{body={raw:text.slice(0,500)};}
      if(!response.ok||!body?.id){
        const error=new Error(`Potleaf upload failed (${response.status}): ${JSON.stringify(body).slice(0,500)}`);
        error.status=response.status;
        throw error;
      }
      return body;
    }catch(error){
      lastError=error;
      if(!isTransientError(error)) throw error;
      console.warn(`[potleaf-upload] upload response was transient/ambiguous on attempt ${attempt}/3: ${error?.message||error}`);

      for(let reconcileAttempt=1;reconcileAttempt<=3;reconcileAttempt+=1){
        await sleep(reconcileAttempt*1800);
        const observed=await findExistingIconMedia();
        if(observed){
          console.warn(`[potleaf-upload] recovered media ${observed.id} by slug after ambiguous upload response`);
          return observed;
        }
      }

      if(attempt>=3) throw error;
      await sleep(attempt*2500);
    }
  }

  throw lastError||new Error('Potleaf upload failed');
}

async function ensureIconMedia(){
  const existing=await findExistingIconMedia();
  if(existing) return existing;
  const uploaded=await uploadIconMedia();
  return request(`/wp-json/wp/v2/media/${uploaded.id}`,{method:'POST',body:JSON.stringify({
    slug:mediaSlug,
    title:`DTF Genetics Cannabis Leaf ${cacheVersion}`,
    alt_text:'DTF Genetics cannabis leaf logo',
    caption:`DTF Genetics cannabis leaf brand mark (${cacheVersion})`
  })});
}

const settings=await request('/wp-json/wp/v2/settings?context=edit');
await writeFile(join(backupDir,'settings-before.json'),`${JSON.stringify(settings,null,2)}\n`);
const media=await ensureIconMedia();
const mediaId=Number(media.id||0);
const sourceUrl=media.source_url||media.guid?.rendered||'';
if(!mediaId) throw new Error('Potleaf media ID not resolved');
if(!sourceUrl.toLowerCase().includes(mediaSlug)) throw new Error(`Versioned favicon URL missing expected slug ${mediaSlug}: ${sourceUrl}`);

const payload={};
if(Object.prototype.hasOwnProperty.call(settings,'site_icon')) payload.site_icon=mediaId;
if(Object.prototype.hasOwnProperty.call(settings,'site_logo')) payload.site_logo=mediaId;
if(!Object.keys(payload).length) throw new Error('WordPress settings endpoint exposes neither site_icon nor site_logo');

await request('/wp-json/wp/v2/settings',{method:'POST',body:JSON.stringify(payload)});
const after=await request('/wp-json/wp/v2/settings?context=edit');
if(Object.prototype.hasOwnProperty.call(after,'site_icon')&&Number(after.site_icon)!==mediaId) throw new Error(`site_icon verification failed: expected ${mediaId}, saw ${after.site_icon}`);
if(Object.prototype.hasOwnProperty.call(after,'site_logo')&&Number(after.site_logo)!==mediaId) throw new Error(`site_logo verification failed: expected ${mediaId}, saw ${after.site_logo}`);

const homeRows=await request('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=10');
if(Array.isArray(homeRows)&&homeRows.length===1){
  await writeFile(join(backupDir,'home-before.json'),`${JSON.stringify(homeRows[0],null,2)}\n`);
  await request(`/wp-json/wp/v2/pages/${homeRows[0].id}`,{method:'POST',body:JSON.stringify({featured_media:mediaId,status:'publish'})});
}

const report={mediaId,mediaSlug,cacheVersion,sourceUrl,siteIcon:Number(after.site_icon||0),siteLogo:Number(after.site_logo||0),backupDir};
await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'latest.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
