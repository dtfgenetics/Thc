import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const outputRoot=process.env.SHOP_CACHE_AUDIT_ROOT||'/tmp/dtf-shop-cache-audit';
await mkdir(outputRoot,{recursive:true});
const expectedTitle='10 Regular F1 Blue Bubblegum Seeds';
const oldTitle='10 reg f1 Blueberry bubblegum';
const slug='10-reg-f1-blueberry-bubblegum';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchText(url,headers={}){
  let lastError;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(url,{headers:{Accept:'text/html','User-Agent':'DTFSeeds-Shop-Cache-Audit/1.0',...headers},redirect:'follow',signal:AbortSignal.timeout(30_000)});
      const text=await response.text();
      if(response.status>=500&&attempt<5){await sleep(attempt*2000);continue;}
      return {status:response.status,ok:response.ok,text,headers:Object.fromEntries([...response.headers.entries()].filter(([key])=>/cache|age|server|vary|etag|last-modified/i.test(key)))};
    }catch(error){lastError=error;if(attempt<5){await sleep(attempt*2000);continue;}}
  }
  throw lastError;
}

async function fetchJson(url){
  const result=await fetchText(url,{Accept:'application/json'});
  let body=null;try{body=JSON.parse(result.text);}catch{}
  return {...result,body};
}

const stamp=Date.now();
const base=await fetchText(`${siteUrl}/shop/`);
const busted=await fetchText(`${siteUrl}/shop/?dtf_shop_cache_audit=${stamp}`,{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache'});
const store=await fetchJson(`${siteUrl}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`);
const product=Array.isArray(store.body)?store.body[0]:null;

function pageState(result){
  return {
    status:result.status,
    expectedTitlePresent:result.text.includes(expectedTitle),
    oldTitlePresent:result.text.includes(oldTitle),
    headers:result.headers
  };
}

const report={
  generatedAt:new Date().toISOString(),siteUrl,expectedTitle,oldTitle,slug,
  baseShop:pageState(base),
  cacheBustedShop:pageState(busted),
  storeApi:{status:store.status,name:product?.name||null,id:product?.id||null,expectedTitleMatches:product?.name===expectedTitle,headers:store.headers},
  diagnosis:null
};
if(report.storeApi.expectedTitleMatches&&report.cacheBustedShop.expectedTitlePresent&&!report.baseShop.expectedTitlePresent) report.diagnosis='base-shop-cache-stale';
else if(report.storeApi.expectedTitleMatches&&report.cacheBustedShop.expectedTitlePresent&&report.baseShop.expectedTitlePresent) report.diagnosis='shop-is-current';
else if(report.storeApi.expectedTitleMatches&&!report.cacheBustedShop.expectedTitlePresent) report.diagnosis='shop-render-source-stale-or-archive-object-cache';
else report.diagnosis='woocommerce-source-not-canonical';

await writeFile(join(outputRoot,'shop-cache-audit.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
if(!store.ok||!base.ok||!busted.ok) process.exitCode=1;
