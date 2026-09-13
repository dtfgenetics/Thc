import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_VISUAL_SCRUB||'').toLowerCase()==='true';
const deleteMedia=String(process.env.DELETE_BANNED_MEDIA||'').toLowerCase()==='true';
const policyPath=process.env.DTF_VISUAL_QUALITY_POLICY||join(process.cwd(),'site/wordpress/visual-quality-policy.json');
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-visual-quality-quarantine';
const timestamp=new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
const backupDir=join(backupRoot,`visual-quarantine-${timestamp}`);

if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
await mkdir(backupDir,{recursive:true});
const policy=JSON.parse(await readFile(policyPath,'utf8'));
if(policy?.schemaVersion!==1||policy?.mode!=='quarantine') throw new Error('Invalid visual quality policy');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Visual-Quality-Quarantine/1.0'};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

async function request(path,options={}){
  let last;
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
      if((response.status===429||response.status>=500)&&attempt<5){await sleep(attempt*1500);continue}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<5){await sleep(attempt*1500);continue}}
  }
  throw last;
}

function rendered(value){
  if(typeof value==='string') return value;
  if(value&&typeof value==='object') return value.raw||value.rendered||'';
  return '';
}
function mediaText(item){
  return [item?.slug,rendered(item?.title),item?.alt_text,rendered(item?.caption),rendered(item?.description),item?.source_url].filter(Boolean).join(' ').toLowerCase();
}
function startsWithAny(value,list=[]){
  const v=String(value||'').toLowerCase();
  return list.some(x=>v.startsWith(String(x).toLowerCase()));
}
function containsAny(value,list=[]){
  const v=String(value||'').toLowerCase();
  return list.some(x=>v.includes(String(x).toLowerCase()));
}
function isBannedMedia(item){
  const banned=policy.bannedMedia||{};
  if((policy.approvedMediaSlugs||[]).includes(item?.slug)) return false;
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

const media=await fetchAll('media');
const bannedMedia=media.filter(isBannedMedia);
const bannedIds=new Set(bannedMedia.map(x=>Number(x.id)).filter(Boolean));
const bannedUrls=[...new Set(bannedMedia.map(x=>x.source_url).filter(Boolean))];
await writeFile(join(backupDir,'banned-media.json'),`${JSON.stringify(bannedMedia,null,2)}\n`);

function escapeRegex(value=''){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function removeContainersByNeedle(html,needle){
  const n=escapeRegex(needle);
  let out=html;
  const wrappers=['figure','picture'];
  for(const tag of wrappers){
    out=out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?${n}[\\s\\S]*?<\\/${tag}>`,'gi'),'');
  }
  out=out.replace(new RegExp(`<a\\b[^>]*>[\\s\\S]*?<img\\b[^>]*(?:src|srcset)=["'][^"']*${n}[^"']*["'][^>]*>[\\s\\S]*?<\\/a>`,'gi'),'');
  out=out.replace(new RegExp(`<img\\b[^>]*(?:src|srcset)=["'][^"']*${n}[^"']*["'][^>]*\\/?>`,'gi'),'');
  return out;
}
function scrubHtml(input=''){
  let out=String(input||'');
  for(const url of bannedUrls) out=removeContainersByNeedle(out,url);
  for(const marker of policy.bannedHtml?.altPrefixes||[]){
    const m=escapeRegex(marker);
    out=out.replace(new RegExp(`<figure\\b[^>]*>[\\s\\S]*?<img\\b[^>]*alt=["']${m}[^"']*["'][^>]*>[\\s\\S]*?<\\/figure>`,'gi'),'');
    out=out.replace(new RegExp(`<img\\b[^>]*alt=["']${m}[^"']*["'][^>]*\\/?>`,'gi'),'');
  }
  for(const klass of policy.bannedHtml?.classContains||[]){
    const k=escapeRegex(klass);
    out=out.replace(new RegExp(`<figure\\b[^>]*class=["'][^"']*${k}[^"']*["'][^>]*>[\\s\\S]*?<\\/figure>`,'gi'),'');
  }
  return out.replace(/\n{3,}/g,'\n\n');
}

async function fetchTypes(){
  const types=await request('/wp-json/wp/v2/types?context=edit');
  const allow=new Set(policy.contentTypes||['page','post','product']);
  return Object.values(types||{}).filter(t=>allow.has(t.slug||t.rest_base||'')||allow.has(t.name||'')).filter(t=>t?.rest_base&&t.rest_base!=='media');
}

const types=await fetchTypes();
const changed=[];
const scanned=[];
for(const type of types){
  let records=[];
  try{records=await fetchAll(type.rest_base)}catch(error){
    scanned.push({type:type.slug||type.rest_base,restBase:type.rest_base,error:error.message});
    continue;
  }
  scanned.push({type:type.slug||type.rest_base,restBase:type.rest_base,count:records.length});
  for(const record of records){
    const original=rendered(record.content);
    const scrubbed=scrubHtml(original);
    const featured=Number(record.featured_media||0);
    const featuredBanned=bannedIds.has(featured);
    if(scrubbed===original&&!featuredBanned) continue;
    await writeFile(join(backupDir,`${type.rest_base}-${record.id}-before.json`),`${JSON.stringify(record,null,2)}\n`);
    changed.push({type:type.slug||type.rest_base,restBase:type.rest_base,id:record.id,slug:record.slug,removedChars:original.length-scrubbed.length,clearedFeaturedMedia:featuredBanned});
    if(apply){
      await request(`/wp-json/wp/v2/${type.rest_base}/${record.id}`,{method:'POST',body:JSON.stringify({content:scrubbed,...(featuredBanned?{featured_media:0}:{})})});
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
  const response=await fetch(`${siteUrl}${path}${path.includes('?')?'&':'?'}dtf_visual_guard=${Date.now()}`,{
    headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache','User-Agent':'DTFSeeds-Visual-Quality-Verification/1.0'},
    redirect:'follow',
    signal:AbortSignal.timeout(45000)
  });
  if(!response.ok) throw new Error(`Public verification failed for ${path}: HTTP ${response.status}`);
  return response.text();
}

const verification=[];
for(const path of policy.verifyRoutes||['/','/learn/','/tools/','/seeds/','/shop/']){
  try{
    const html=await fetchPublic(path);
    const failures=[];
    for(const url of bannedUrls){if(html.includes(url)) failures.push(`banned-url:${url}`)}
    for(const marker of policy.bannedHtml?.altPrefixes||[]){if(html.toLowerCase().includes(`alt=\"${marker.toLowerCase()}`)||html.toLowerCase().includes(`alt='${marker.toLowerCase()}`)) failures.push(`banned-alt:${marker}`)}
    verification.push({path,ok:failures.length===0,failures});
  }catch(error){verification.push({path,ok:false,error:error.message})}
}

const report={
  generatedAt:new Date().toISOString(),
  apply,
  deleteMedia,
  policyPath,
  bannedMediaCount:bannedMedia.length,
  changedContentCount:changed.length,
  deletedMediaCount:deleted.filter(x=>!x.error).length,
  deletedMediaErrors:deleted.filter(x=>x.error),
  scanned,
  changed,
  verification,
  rule:'Legacy low-quality educational media is quarantined from public presentation. Image-less UI is preferred to unapproved media. Future visuals must use an explicitly approved production asset path and must not reuse the banned legacy media slugs.'
};
await writeFile(join(backupDir,'visual-quarantine-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'visual-quarantine-latest.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));

if(apply&&verification.some(x=>!x.ok)) throw new Error('Public verification still found banned visual references or could not verify a required route');
