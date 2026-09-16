import { setDefaultResultOrder } from 'node:dns';
import { writeFile } from 'node:fs/promises';

setDefaultResultOrder('ipv4first');

const ORIGIN=(process.env.DTF_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const MAX_PAGES=Math.max(8,Number(process.env.DTF_LINK_AUDIT_MAX_PAGES||300));
const MAX_DEPTH=Math.max(1,Number(process.env.DTF_LINK_AUDIT_MAX_DEPTH||5));
const CONCURRENCY=Math.max(1,Math.min(12,Number(process.env.DTF_LINK_AUDIT_CONCURRENCY||6)));
const JSON_PATH=process.env.DTF_LINK_AUDIT_JSON||'sitewide-link-integrity.json';
const MD_PATH=process.env.DTF_LINK_AUDIT_MD||'sitewide-link-integrity.md';
const seedRoutes=['/','/seeds/','/learn/','/tools/','/games/','/projects/','/community/','/shop/','/gallery/','/about/','/contact/'];
const ignoredPrefixes=['/wp-admin/','/wp-json/','/wp-login.php','/feed/','/comments/','/xmlrpc.php'];
const assetRx=/\.(?:css|js|mjs|map|json|xml|txt|pdf|zip|gz|tgz|rar|7z|png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|mov|mp3|wav|woff2?|ttf|eot)$/i;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function normalize(raw,base){
  if(!raw) return null;
  const value=String(raw).trim();
  if(!value||value.startsWith('#')||/^(?:mailto|tel|javascript|data):/i.test(value)) return null;
  let url;
  try{url=new URL(value,base);}catch{return null;}
  if(url.origin!==new URL(ORIGIN).origin) return null;
  url.hash='';
  const path=url.pathname.replace(/\/{2,}/g,'/')||'/';
  if(ignoredPrefixes.some(prefix=>path.startsWith(prefix))||assetRx.test(path)) return null;
  for(const key of [...url.searchParams.keys()]){
    if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key)) url.searchParams.delete(key);
  }
  if(url.search) return null;
  return path;
}

function linksFrom(html,base){
  const links=[];
  for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>/gi)){
    const path=normalize(match[2],base);
    if(path) links.push(path);
  }
  return [...new Set(links)];
}

async function get(path){
  let lastError;
  for(let attempt=1;attempt<=3;attempt+=1){
    try{
      const url=new URL(path,`${ORIGIN}/`);
      url.searchParams.set('dtf_link_audit',`${Date.now()}-${attempt}`);
      const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(25000),headers:{accept:'text/html,*/*','cache-control':'no-cache, no-store, max-age=0',pragma:'no-cache','user-agent':'DTFSeeds-Link-Integrity/1.0'}});
      const body=await response.text();
      return {path,status:response.status,ok:response.ok,contentType:response.headers.get('content-type')||'',finalUrl:response.url,body,error:null};
    }catch(error){lastError=error;if(attempt<3) await sleep(attempt*300);}
  }
  return {path,status:0,ok:false,contentType:'',finalUrl:new URL(path,`${ORIGIN}/`).href,body:'',error:lastError?.message||String(lastError)};
}

const queue=seedRoutes.map(path=>({path,depth:0,from:null}));
const queued=new Set(seedRoutes);
const seen=new Set();
const pages=[];
const inbound=new Map();

while(queue.length&&pages.length<MAX_PAGES){
  const batch=[];
  while(queue.length&&batch.length<CONCURRENCY&&pages.length+batch.length<MAX_PAGES){
    const item=queue.shift();queued.delete(item.path);
    if(seen.has(item.path)) continue;
    seen.add(item.path);batch.push(item);
  }
  if(!batch.length) continue;
  const fetched=await Promise.all(batch.map(item=>get(item.path)));
  for(let i=0;i<fetched.length;i+=1){
    const item=batch[i];const page=fetched[i];
    const html=page.body||'';
    const isHtml=page.contentType.toLowerCase().includes('text/html')||/^\s*<!doctype html|^\s*<html\b/i.test(html);
    const links=page.status===200&&isHtml?linksFrom(html,page.finalUrl):[];
    const issues=[];
    if(page.error) issues.push(`Fetch failed: ${page.error}`);
    else if(page.status!==200) issues.push(`HTTP ${page.status}`);
    else if(!isHtml) issues.push(`Expected HTML; received ${page.contentType||'unknown content type'}`);
    pages.push({path:item.path,depth:item.depth,from:item.from,status:page.status,finalUrl:page.finalUrl,links,issues,passed:issues.length===0});
    if(item.depth>=MAX_DEPTH||issues.length) continue;
    for(const target of links){
      if(!inbound.has(target)) inbound.set(target,new Set());
      inbound.get(target).add(item.path);
      if(seen.has(target)||queued.has(target)||seen.size+queue.length>=MAX_PAGES*2) continue;
      queued.add(target);queue.push({path:target,depth:item.depth+1,from:item.path});
    }
  }
}

const broken=pages.filter(page=>!page.passed).map(page=>({
  path:page.path,
  status:page.status,
  issue:page.issues.join('; '),
  linkedFrom:[...(inbound.get(page.path)||[])].sort(),
}));
const redirects=pages.filter(page=>page.status===200&&new URL(page.finalUrl).pathname!==page.path).map(page=>({path:page.path,finalPath:new URL(page.finalUrl).pathname}));
const report={generatedAt:new Date().toISOString(),origin:ORIGIN,config:{maxPages:MAX_PAGES,maxDepth:MAX_DEPTH,concurrency:CONCURRENCY},summary:{checked:pages.length,passed:pages.length-broken.length,broken:broken.length,redirected:redirects.length},broken,redirects,pages:pages.map(({links,...page})=>page)};
const lines=['# DTFSeeds Internal Link Integrity','',`Generated: ${report.generatedAt}`,'',`Checked: **${report.summary.checked}** · broken: **${report.summary.broken}** · redirected: **${report.summary.redirected}**`,''];
if(broken.length){lines.push('## Broken routes','');for(const item of broken) lines.push(`- \`${item.path}\` — ${item.issue}${item.linkedFrom.length?` — linked from ${item.linkedFrom.map(v=>`\`${v}\``).join(', ')}`:''}`);}else lines.push('All crawled same-origin HTML links resolved successfully.');
if(redirects.length){lines.push('','## Redirected internal routes','');for(const item of redirects.slice(0,100)) lines.push(`- \`${item.path}\` → \`${item.finalPath}\``);}
const markdown=`${lines.join('\n')}\n`;
await Promise.all([writeFile(JSON_PATH,`${JSON.stringify(report,null,2)}\n`),writeFile(MD_PATH,markdown)]);
console.log(markdown);
if(broken.length) process.exitCode=1;
