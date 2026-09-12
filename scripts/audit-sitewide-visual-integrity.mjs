import { setDefaultResultOrder } from 'node:dns';
import { writeFile } from 'node:fs/promises';

setDefaultResultOrder('ipv4first');

const BASE_URL=(process.env.DTF_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const MAX_PAGES=Math.max(8,Number(process.env.DTF_VISUAL_AUDIT_MAX_PAGES||350));
const MAX_DEPTH=Math.max(1,Number(process.env.DTF_VISUAL_AUDIT_MAX_DEPTH||5));
const CONCURRENCY=Math.min(12,Math.max(1,Number(process.env.DTF_VISUAL_AUDIT_CONCURRENCY||6)));
const MAX_IMAGES=Math.max(0,Number(process.env.DTF_VISUAL_AUDIT_MAX_IMAGES||250));
const JSON_REPORT=process.env.DTF_VISUAL_AUDIT_JSON||'sitewide-visual-integrity.json';
const MARKDOWN_REPORT=process.env.DTF_VISUAL_AUDIT_MD||'sitewide-visual-integrity.md';

const expectedNav=[
  ['Home','/'],
  ['Seeds','/seeds/'],
  ['Learn','/learn/'],
  ['Courses','/courses/'],
  ['Diagnostic','/tools/'],
  ['Games','/games/'],
  ['Community','/community/'],
  ['Shop','/shop/']
];
const seedRoutes=['/','/seeds/','/learn/','/courses/','/tools/','/games/','/community/','/shop/'];
const ignoredPrefixes=['/wp-admin/','/wp-json/','/wp-login.php','/feed/','/comments/feed/','/xmlrpc.php'];
const ignoredExtensions=/\.(?:css|js|mjs|map|json|xml|txt|pdf|zip|gz|tgz|rar|7z|png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|mov|mp3|wav|woff2?|ttf|eot)$/i;

const unique=values=>[...new Set(values)];
const esc=value=>String(value).replaceAll('|','\\|').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function normalizeInternal(raw,base){
  if(!raw) return null;
  const trimmed=String(raw).trim();
  if(!trimmed||trimmed.startsWith('#')||/^(?:mailto|tel|javascript|data):/i.test(trimmed)) return null;
  let url;
  try{url=new URL(trimmed,base);}catch{return null;}
  if(url.origin!==new URL(BASE_URL).origin) return null;
  url.hash='';
  for(const key of [...url.searchParams.keys()]){
    if(/^utm_/i.test(key)||['fbclid','gclid','dtf_audit','dtf_visual_audit'].includes(key)) url.searchParams.delete(key);
  }
  // Query/action URLs should not become crawl nodes. Their canonical page is enough for visual QA.
  if(url.search&&/[?&](?:add-to-cart|remove_item|wc-ajax|s|orderby|filter_|attribute_|replytocom|rest_route)=/i.test(url.search)) return null;
  if(url.search) return null;
  const path=url.pathname.replace(/\/{2,}/g,'/');
  if(ignoredPrefixes.some(prefix=>path.startsWith(prefix))) return null;
  if(ignoredExtensions.test(path)) return null;
  return path||'/';
}

function getAttr(tag,name){
  const match=tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`,'i'));
  return match?.[2]??null;
}

function stripTags(value=''){
  return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
}

function extractHeader(html){
  const matches=[...html.matchAll(/<header\b[^>]*data-dtf-shell=["']header-v5["'][^>]*>[\s\S]*?<\/header>/gi)];
  return {count:matches.length,html:matches[0]?.[0]||''};
}

function extractLinks(html,base){
  const links=[];
  for(const match of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
    const tag=match[0].match(/<a\b[^>]*>/i)?.[0]||'';
    const href=getAttr(tag,'href');
    if(!href) continue;
    links.push({href,label:stripTags(match[0]),internal:normalizeInternal(href,base)});
  }
  return links;
}

function extractImages(html,base){
  const images=[];
  for(const match of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=match[0];
    const src=getAttr(tag,'src')||getAttr(tag,'data-src')||'';
    const alt=getAttr(tag,'alt');
    let absolute='';
    try{absolute=src?new URL(src,base).href:'';}catch{}
    images.push({src,absolute,alt,tag:tag.slice(0,260)});
  }
  return images;
}

function duplicateIds(html){
  const counts=new Map();
  for(const tag of html.matchAll(/<[^>]+\bid\s*=\s*(["'])(.*?)\1[^>]*>/gi)){
    const id=tag[2];
    counts.set(id,(counts.get(id)||0)+1);
  }
  return [...counts.entries()].filter(([,count])=>count>1).map(([id,count])=>({id,count}));
}

function hasViewport(html){
  return /<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["'][^"']*width=device-width/i.test(html)||/<meta\b[^>]*content\s*=\s*["'][^"']*width=device-width[^"']*["'][^>]*name\s*=\s*["']viewport["']/i.test(html);
}

function count(html,re){return (html.match(re)||[]).length;}

async function fetchHtml(path){
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const url=new URL(path,`${BASE_URL}/`);
      url.searchParams.set('dtf_visual_audit',`${Date.now()}-${attempt}`);
      const started=Date.now();
      const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(25_000),headers:{accept:'text/html,*/*','cache-control':'no-cache, no-store, max-age=0',pragma:'no-cache','user-agent':'DTFSeeds-Visual-Integrity/1.0'}});
      const body=await response.text();
      return {path,status:response.status,ok:response.ok,contentType:response.headers.get('content-type')||'',finalUrl:response.url,body,durationMs:Date.now()-started,error:null};
    }catch(error){lastError=error;await sleep(250*attempt);}
  }
  return {path,status:0,ok:false,contentType:'',finalUrl:new URL(path,`${BASE_URL}/`).href,body:'',durationMs:0,error:lastError?.message||String(lastError)};
}

function inspectPage(fetched,depth){
  const issues=[];const warnings=[];
  const html=fetched.body||'';
  const base=fetched.finalUrl||new URL(fetched.path,`${BASE_URL}/`).href;
  if(fetched.error) issues.push(`Fetch failed: ${fetched.error}`);
  if(!fetched.error&&fetched.status!==200) issues.push(`HTTP ${fetched.status}; expected 200`);
  if(fetched.status===200&&!fetched.contentType.toLowerCase().includes('text/html')) issues.push(`Expected HTML; received ${fetched.contentType||'unknown content type'}`);
  if(fetched.status!==200||!fetched.contentType.toLowerCase().includes('text/html')) return {path:fetched.path,depth,...fetched,issues,warnings,links:[],images:[],passed:issues.length===0};

  const shell=extractHeader(html);
  if(shell.count!==1) issues.push(`Expected exactly one V5 header; found ${shell.count}`);
  const uxCount=count(html,/id=["']dtf-sitewide-ux-polish-v1["']/gi);
  if(uxCount!==1) issues.push(`Expected exactly one shared UX polish marker; found ${uxCount}`);
  const responsiveCount=count(html,/id=["']dtf-responsive-layout-v1["']/gi);
  if(responsiveCount!==1) issues.push(`Expected exactly one responsive layout marker; found ${responsiveCount}`);
  if(!hasViewport(html)) issues.push('Missing width=device-width viewport meta');

  if(shell.html){
    const headerLinks=extractLinks(shell.html,base);
    for(const [label,href] of expectedNav){
      const found=headerLinks.some(link=>link.label===label&&link.internal===href);
      if(!found) issues.push(`V5 navigation missing ${label} → ${href}`);
    }
    for(const stale of ['Genetics','Tools']){
      if(headerLinks.some(link=>link.label===stale)) issues.push(`Stale primary navigation label remains: ${stale}`);
    }
  }

  const h1=count(html,/<h1\b/gi);
  if(h1===0) warnings.push('No H1 found');
  if(h1>1) warnings.push(`Multiple H1 elements found (${h1})`);

  const dups=duplicateIds(html);
  if(dups.length) warnings.push(`Duplicate HTML ids: ${dups.slice(0,8).map(item=>`${item.id}×${item.count}`).join(', ')}${dups.length>8?'…':''}`);

  const images=extractImages(html,base);
  const missingAlt=images.filter(image=>image.alt===null);
  if(missingAlt.length) warnings.push(`${missingAlt.length} image(s) missing an alt attribute`);
  const emptySrc=images.filter(image=>!image.src);
  if(emptySrc.length) issues.push(`${emptySrc.length} image(s) have no usable src/data-src`);

  const links=extractLinks(html,base);
  return {path:fetched.path,depth,status:fetched.status,ok:fetched.ok,contentType:fetched.contentType,finalUrl:fetched.finalUrl,durationMs:fetched.durationMs,error:fetched.error,issues,warnings,links,images,passed:issues.length===0};
}

async function crawl(){
  const seen=new Set();
  const queued=new Set(seedRoutes);
  const queue=seedRoutes.map(path=>({path,depth:0,from:'seed'}));
  const pages=[];
  while(queue.length&&pages.length<MAX_PAGES){
    const batch=[];
    while(queue.length&&batch.length<CONCURRENCY&&pages.length+batch.length<MAX_PAGES){
      const item=queue.shift();
      queued.delete(item.path);
      if(seen.has(item.path)) continue;
      seen.add(item.path);batch.push(item);
    }
    if(!batch.length) continue;
    const fetched=await Promise.all(batch.map(item=>fetchHtml(item.path)));
    for(let i=0;i<fetched.length;i++){
      const page=inspectPage(fetched[i],batch[i].depth);pages.push(page);
      if(batch[i].depth>=MAX_DEPTH||page.status!==200) continue;
      for(const link of page.links){
        const path=link.internal;
        if(!path||seen.has(path)||queued.has(path)||pages.length+queue.length>=MAX_PAGES*2) continue;
        queued.add(path);queue.push({path,depth:batch[i].depth+1,from:page.path});
      }
    }
  }
  return pages;
}

async function inspectImages(pages){
  const candidates=[];const seen=new Set();
  for(const page of pages){
    for(const image of page.images||[]){
      if(!image.absolute||seen.has(image.absolute)) continue;
      let url;try{url=new URL(image.absolute);}catch{continue;}
      if(url.origin!==new URL(BASE_URL).origin) continue;
      seen.add(image.absolute);candidates.push({url:image.absolute,page:page.path});
      if(candidates.length>=MAX_IMAGES) break;
    }
    if(candidates.length>=MAX_IMAGES) break;
  }
  const results=[];
  for(let offset=0;offset<candidates.length;offset+=CONCURRENCY){
    const batch=candidates.slice(offset,offset+CONCURRENCY);
    const checked=await Promise.all(batch.map(async item=>{
      try{
        let response=await fetch(item.url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(15_000),headers:{'cache-control':'no-cache','user-agent':'DTFSeeds-Visual-Integrity/1.0'}});
        if(response.status===405||response.status===403) response=await fetch(item.url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(15_000),headers:{range:'bytes=0-0','cache-control':'no-cache','user-agent':'DTFSeeds-Visual-Integrity/1.0'}});
        return {...item,status:response.status,ok:response.ok,contentType:response.headers.get('content-type')||'',error:null};
      }catch(error){return {...item,status:0,ok:false,contentType:'',error:error?.message||String(error)};}
    }));
    results.push(...checked);
  }
  return results;
}

function render(report){
  const lines=['# DTFSeeds Sitewide Visual Integrity Audit','',`Generated: ${report.generatedAt}`,'',`Overall: **${report.passed?'PASS':'FAIL'}**`,'',`HTML routes passing structural checks: **${report.summary.passed}/${report.summary.total}**`,'',`Unique same-origin images checked: **${report.images.checked}** · broken: **${report.images.broken}**`,'', '| Route | HTTP | Depth | Issues | Warnings | Result |','|---|---:|---:|---:|---:|---|'];
  for(const page of report.pages) lines.push(`| ${esc(page.path)} | ${page.status||'ERR'} | ${page.depth} | ${page.issues.length} | ${page.warnings.length} | ${page.passed?'PASS':'FAIL'} |`);
  const failures=report.pages.filter(page=>page.issues.length);
  if(failures.length){lines.push('','## Structural failures','');for(const page of failures){lines.push(`### ${page.path}`,'');for(const issue of page.issues) lines.push(`- ${issue}`);lines.push('');}}
  const warningPages=report.pages.filter(page=>page.warnings.length);
  if(warningPages.length){lines.push('','## Visual/accessibility warnings','');for(const page of warningPages.slice(0,100)){lines.push(`- **${page.path}** — ${page.warnings.join('; ')}`);}if(warningPages.length>100) lines.push(`- … ${warningPages.length-100} more warning page(s); see JSON report.`);}
  if(report.images.failures.length){lines.push('','## Broken same-origin images','');for(const image of report.images.failures.slice(0,100)) lines.push(`- ${image.url} (from ${image.page}) — ${image.error||`HTTP ${image.status}`}`);}
  return `${lines.join('\n')}\n`;
}

const pages=await crawl();
const imageResults=MAX_IMAGES>0?await inspectImages(pages):[];
const brokenImages=imageResults.filter(image=>!image.ok||!/^image\//i.test(image.contentType));
for(const image of brokenImages){
  const page=pages.find(candidate=>candidate.path===image.page);
  if(page){page.issues.push(`Broken/unexpected image response: ${image.url} (${image.error||`HTTP ${image.status} ${image.contentType}`})`);page.passed=false;}
}

const report={
  generatedAt:new Date().toISOString(),baseUrl:BASE_URL,
  config:{maxPages:MAX_PAGES,maxDepth:MAX_DEPTH,concurrency:CONCURRENCY,maxImages:MAX_IMAGES},
  passed:pages.length>0&&pages.every(page=>page.passed)&&brokenImages.length===0,
  summary:{total:pages.length,passed:pages.filter(page=>page.passed).length,failed:pages.filter(page=>!page.passed).length,warnings:pages.reduce((sum,page)=>sum+page.warnings.length,0)},
  images:{checked:imageResults.length,broken:brokenImages.length,failures:brokenImages},
  pages:pages.map(({links,images,...page})=>page)
};
const markdown=render(report);
await Promise.all([writeFile(JSON_REPORT,`${JSON.stringify(report,null,2)}\n`,'utf8'),writeFile(MARKDOWN_REPORT,markdown,'utf8')]);
console.log(markdown);
if(!report.passed) process.exitCode=1;
