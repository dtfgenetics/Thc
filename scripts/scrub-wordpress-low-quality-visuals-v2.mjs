import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_VISUAL_SCRUB||'').toLowerCase()==='true';
const deleteMedia=String(process.env.DELETE_BANNED_MEDIA||'').toLowerCase()==='true';
const skipPublicVerification=String(process.env.SKIP_PUBLIC_VISUAL_VERIFICATION||'').toLowerCase()==='true';
const policyPath=process.env.DTF_VISUAL_QUALITY_POLICY||join(process.cwd(),'site/wordpress/visual-quality-policy.json');
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-visual-quality-quarantine';
const timestamp=new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
const backupDir=join(backupRoot,`visual-quarantine-v2-${timestamp}`);

if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
await mkdir(backupDir,{recursive:true});
const policy=JSON.parse(await readFile(policyPath,'utf8'));
if(Number(policy?.schemaVersion||0)<2||policy?.mode!=='quarantine') throw new Error('Visual quality policy v2+ is required');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Visual-Quality-Quarantine/2.0'};
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(path,options={}){
  let lastError;
  for(let attempt=1;attempt<=5;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{
        ...options,
        headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
        redirect:'follow',
        signal:AbortSignal.timeout(60000)
      });
      const text=await response.text();
      let body=null;
      try{body=text?JSON.parse(text):null}catch{body=text}
      if((response.status===429||response.status>=500)&&attempt<5){await sleep(attempt*1800);continue}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){
      lastError=error;
      if(attempt<5){await sleep(attempt*1800);continue}
    }
  }
  throw lastError;
}

function rendered(value){
  if(typeof value==='string') return value;
  if(value&&typeof value==='object') return value.raw||value.rendered||'';
  return '';
}
function startsWithAny(value,list=[]){
  const text=String(value||'').toLowerCase();
  return list.some(entry=>text.startsWith(String(entry).toLowerCase()));
}
function containsAny(value,list=[]){
  const text=String(value||'').toLowerCase();
  return list.some(entry=>text.includes(String(entry).toLowerCase()));
}
function mediaText(item){
  return [item?.slug,rendered(item?.title),item?.alt_text,rendered(item?.caption),rendered(item?.description),item?.source_url]
    .filter(Boolean).join(' ').toLowerCase();
}
function isApprovedMedia(item){
  if((policy.approvedMediaSlugs||[]).includes(item?.slug)) return true;
  return startsWithAny(item?.slug,policy.approvedMediaSlugPrefixes||[]);
}
function isBannedMedia(item){
  if(isApprovedMedia(item)) return false;
  const banned=policy.bannedMedia||{};
  return startsWithAny(item?.slug,banned.slugPrefixes)
    || startsWithAny(item?.alt_text,banned.altPrefixes)
    || containsAny(rendered(item?.title),banned.titleContains)
    || containsAny(rendered(item?.caption),banned.captionContains)
    || containsAny(rendered(item?.description),banned.descriptionContains)
    || containsAny(item?.source_url,banned.urlContains)
    || containsAny(mediaText(item),banned.anyTextContains);
}

async function fetchAll(restBase,params={}){
  const rows=[];
  for(let page=1;page<=100;page+=1){
    const query=new URLSearchParams({context:'edit',per_page:'100',page:String(page),...params});
    try{
      const batch=await request(`/wp-json/wp/v2/${restBase}?${query}`);
      if(!Array.isArray(batch)||!batch.length) break;
      rows.push(...batch);
      if(batch.length<100) break;
    }catch(error){
      if(/invalid page number|rest_post_invalid_page_number|400/i.test(error.message)) break;
      throw error;
    }
  }
  return rows;
}

function escapeRegex(value=''){
  return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}
function removeContainersByNeedle(input,needle){
  if(!needle) return input;
  const marker=escapeRegex(needle);
  let html=String(input||'');
  for(const tag of ['figure','picture']){
    html=html.replace(new RegExp(`<${tag}\\b(?:(?!<\\/${tag}>)[\\s\\S])*?${marker}(?:(?!<\\/${tag}>)[\\s\\S])*?<\\/${tag}>`,'gi'),'');
  }
  html=html.replace(new RegExp(`<a\\b[^>]*>\\s*<img\\b[^>]*(?:src|srcset)=["'][^"']*${marker}[^"']*["'][^>]*\\/?>(?:\\s*)<\\/a>`,'gi'),'');
  html=html.replace(new RegExp(`<img\\b[^>]*(?:src|srcset)=["'][^"']*${marker}[^"']*["'][^>]*\\/?>`,'gi'),'');
  return html;
}
function removeByAltPrefix(input,prefix){
  const marker=escapeRegex(prefix);
  let html=String(input||'');
  html=html.replace(new RegExp(`<figure\\b(?:(?!<\\/figure>)[\\s\\S])*?<img\\b[^>]*alt=["']${marker}[^"']*["'][^>]*>(?:(?!<\\/figure>)[\\s\\S])*?<\\/figure>`,'gi'),'');
  html=html.replace(new RegExp(`<img\\b[^>]*alt=["']${marker}[^"']*["'][^>]*\\/?>`,'gi'),'');
  return html;
}

const media=await fetchAll('media');
const bannedMedia=media.filter(isBannedMedia);
const bannedIds=new Set(bannedMedia.map(item=>Number(item.id)).filter(Boolean));
const bannedUrls=[...new Set(bannedMedia.map(item=>item.source_url).filter(Boolean))];
const explicitUrlNeedles=[...new Set([...(policy.bannedMedia?.urlContains||[]),...(policy.bannedHtml?.urlContains||[])].filter(Boolean))];
await writeFile(join(backupDir,'banned-media.json'),`${JSON.stringify(bannedMedia,null,2)}\n`);

function scrubHtml(input=''){
  let output=String(input||'');
  for(const url of bannedUrls) output=removeContainersByNeedle(output,url);
  for(const needle of explicitUrlNeedles) output=removeContainersByNeedle(output,needle);
  for(const prefix of policy.bannedHtml?.altPrefixes||[]) output=removeByAltPrefix(output,prefix);
  for(const klass of policy.bannedHtml?.classContains||[]){
    const marker=escapeRegex(klass);
    output=output.replace(new RegExp(`<figure\\b[^>]*class=["'][^"']*${marker}[^"']*["'][^>]*>[\\s\\S]*?<\\/figure>`,'gi'),'');
  }
  return output.replace(/\n{3,}/g,'\n\n');
}

async function fetchTypes(){
  const types=await request('/wp-json/wp/v2/types?context=edit');
  const allow=new Set(policy.contentTypes||['page','post','product']);
  return Object.values(types||{})
    .filter(type=>allow.has(type.slug||type.rest_base||'')||allow.has(type.name||''))
    .filter(type=>type?.rest_base&&type.rest_base!=='media');
}

const scanned=[];
const changed=[];
for(const type of await fetchTypes()){
  let records=[];
  try{records=await fetchAll(type.rest_base)}catch(error){
    scanned.push({type:type.slug||type.rest_base,restBase:type.rest_base,error:error.message});
    continue;
  }
  scanned.push({type:type.slug||type.rest_base,restBase:type.rest_base,count:records.length});
  for(const record of records){
    const original=rendered(record.content);
    const scrubbed=scrubHtml(original);
    const featuredId=Number(record.featured_media||0);
    const featuredBanned=bannedIds.has(featuredId);
    if(scrubbed===original&&!featuredBanned) continue;
    await writeFile(join(backupDir,`${type.rest_base}-${record.id}-before.json`),`${JSON.stringify(record,null,2)}\n`);
    changed.push({
      type:type.slug||type.rest_base,
      restBase:type.rest_base,
      id:record.id,
      slug:record.slug,
      removedChars:original.length-scrubbed.length,
      clearedFeaturedMedia:featuredBanned
    });
    if(apply){
      await request(`/wp-json/wp/v2/${type.rest_base}/${record.id}`,{
        method:'POST',
        body:JSON.stringify({content:scrubbed,...(featuredBanned?{featured_media:0}:{})})
      });
    }
  }
}

const deleted=[];
if(apply&&deleteMedia){
  for(const item of bannedMedia){
    try{
      await request(`/wp-json/wp/v2/media/${item.id}?force=true`,{method:'DELETE'});
      deleted.push({id:item.id,slug:item.slug,source_url:item.source_url});
    }catch(error){
      deleted.push({id:item.id,slug:item.slug,source_url:item.source_url,error:error.message});
    }
  }
}

async function fetchPublic(path){
  const separator=path.includes('?')?'&':'?';
  const response=await fetch(`${siteUrl}${path}${separator}dtf_visual_guard=${Date.now()}-${Math.random().toString(16).slice(2)}`,{
    headers:{
      'Cache-Control':'no-cache, no-store, max-age=0',
      'Pragma':'no-cache',
      'User-Agent':'DTFSeeds-Visual-Quality-Verification/2.0'
    },
    redirect:'follow',
    signal:AbortSignal.timeout(45000)
  });
  if(!response.ok) throw new Error(`Public verification failed for ${path}: HTTP ${response.status}`);
  return response.text();
}

const verification=[];
if(!skipPublicVerification){
  for(const path of policy.verifyRoutes||['/','/learn/','/tools/','/seeds/','/shop/']){
    try{
      const html=await fetchPublic(path);
      const lower=html.toLowerCase();
      const failures=[];
      for(const needle of explicitUrlNeedles){
        if(lower.includes(String(needle).toLowerCase())) failures.push(`banned-url-fragment:${needle}`);
      }
      for(const prefix of policy.bannedHtml?.altPrefixes||[]){
        const marker=String(prefix).toLowerCase();
        if(lower.includes(`alt=\"${marker}`)||lower.includes(`alt='${marker}`)) failures.push(`banned-alt:${prefix}`);
      }
      for(const url of bannedUrls){
        if(html.includes(url)) failures.push(`banned-media-url:${url}`);
      }
      verification.push({path,ok:failures.length===0,failures});
    }catch(error){
      verification.push({path,ok:false,error:error.message});
    }
  }
}

const report={
  generatedAt:new Date().toISOString(),
  version:2,
  apply,
  deleteMedia,
  skipPublicVerification,
  policyPath,
  bannedMediaCount:bannedMedia.length,
  changedContentCount:changed.length,
  deletedMediaCount:deleted.filter(item=>!item.error).length,
  deletedMediaErrors:deleted.filter(item=>item.error),
  scanned,
  changed,
  verification,
  explicitUrlNeedles,
  rule:'Unapproved legacy educational/infographic media is quarantined from public presentation. Image-less UI is preferred to unapproved media. Future visuals must use the explicitly approved media path.'
};
await writeFile(join(backupDir,'visual-quarantine-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'visual-quarantine-latest.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));

if(deleted.some(item=>item.error)) throw new Error('One or more banned WordPress media items could not be deleted');
if(!skipPublicVerification&&verification.some(item=>!item.ok)) throw new Error('Public verification still found banned visual references or could not verify a required route');
