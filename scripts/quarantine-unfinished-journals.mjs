import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const apply=String(process.env.APPLY_JOURNAL_QUARANTINE||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-journal-quarantine';
const consumerKey=process.env.WC_CONSUMER_KEY||'';
const consumerSecret=process.env.WC_CONSUMER_SECRET||'';
const wpUsername=process.env.WP_API_USERNAME||'';
const wpPassword=process.env.WP_API_PASSWORD||'';
const authHeader=consumerKey&&consumerSecret
  ? `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
  : wpUsername&&wpPassword
    ? `Basic ${Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')}`
    : '';
if(!authHeader) throw new Error('WooCommerce or WordPress production credentials are required');

const targets=[
  {id:623,slug:'custom-autographed-garden-journal'},
  {id:625,slug:'custom-autographed-garden-journal-2'},
  {id:627,slug:'custom-autographed-garden-journal-3'},
  {id:629,slug:'custom-autographed-garden-journal-4'},
  {id:631,slug:'custom-autographed-garden-journal-5'}
];
const stamp=new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
const backupDir=join(backupRoot,`journal-quarantine-${stamp}`);
await mkdir(backupDir,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(path,options={}){
  let lastError;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{
        ...options,
        headers:{Authorization:authHeader,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
        redirect:'follow',signal:AbortSignal.timeout(30_000)
      });
      const text=await response.text();
      let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,500)};}
      if((response.status>=500||response.status===429)&&attempt<5){await sleep(attempt*2000);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){lastError=error;if(attempt<5){await sleep(attempt*2000);continue;}}
  }
  throw lastError;
}

async function publicStoreBySlug(slug){
  const response=await fetch(`${siteUrl}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}&dtf_journal_verify=${Date.now()}`,{headers:{Accept:'application/json','Cache-Control':'no-cache','User-Agent':'DTFSeeds-Journal-Quarantine/1.0'},redirect:'follow',signal:AbortSignal.timeout(30_000)});
  const text=await response.text();
  let body=null;try{body=JSON.parse(text);}catch{}
  if(!response.ok||!Array.isArray(body)) throw new Error(`Public Store API verification failed for ${slug} (${response.status})`);
  return body;
}

const before=[];
for(const target of targets){
  const product=await request(`/wp-json/wc/v3/products/${target.id}`);
  if(Number(product.id)!==target.id||product.slug!==target.slug) throw new Error(`Pinned journal target mismatch for ID ${target.id}`);
  const safetyIssues=[];
  if(product.status!=='publish') safetyIssues.push(`status=${product.status}`);
  if(String(product.sku||'').trim()) safetyIssues.push('has SKU');
  if(Array.isArray(product.images)&&product.images.length) safetyIssues.push('has product images');
  if(Array.isArray(product.attributes)&&product.attributes.length) safetyIssues.push('has product attributes');
  if(Number(product.total_sales||0)>0) safetyIssues.push(`has total_sales=${product.total_sales}`);
  if(safetyIssues.length) throw new Error(`Refusing to quarantine ${target.slug}: ${safetyIssues.join(', ')}`);
  before.push(product);
  await writeFile(join(backupDir,`product-${target.id}-before.json`),`${JSON.stringify(product,null,2)}\n`);
}

const changed=[];
let rollbackAttempted=false;
try{
  if(apply){
    for(const product of before){
      const updated=await request(`/wp-json/wc/v3/products/${product.id}`,{method:'PUT',body:JSON.stringify({status:'draft'})});
      if(updated.status!=='draft') throw new Error(`WooCommerce did not draft product ${product.id}`);
      changed.push(product.id);
    }

    for(const target of targets){
      const privateProduct=await request(`/wp-json/wc/v3/products/${target.id}`);
      if(privateProduct.status!=='draft') throw new Error(`Private verification failed for journal ${target.id}`);
      const publicMatches=await publicStoreBySlug(target.slug);
      if(publicMatches.length!==0) throw new Error(`Journal ${target.id} remains public in the Store API`);
    }

    const shopResponse=await fetch(`${siteUrl}/shop/?dtf_journal_quarantine_verify=${Date.now()}`,{headers:{Accept:'text/html','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Journal-Quarantine/1.0'},redirect:'follow',signal:AbortSignal.timeout(30_000)});
    const shopHtml=await shopResponse.text();
    if(!shopResponse.ok) throw new Error(`Shop verification failed (${shopResponse.status})`);
    if(/Custom[- ]Autographed Garden Journal/i.test(shopHtml)) throw new Error('A quarantined journal title remains on the public Shop archive');
  }
}catch(error){
  if(apply&&changed.length){
    rollbackAttempted=true;
    for(const product of before.filter(item=>changed.includes(item.id))){
      try{await request(`/wp-json/wc/v3/products/${product.id}`,{method:'PUT',body:JSON.stringify({status:product.status,catalog_visibility:product.catalog_visibility})});}catch{}
    }
  }
  throw new Error(`${error instanceof Error?error.message:String(error)}; rollbackAttempted=${rollbackAttempted}`);
}

const report={
  generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,
  targetIds:targets.map(t=>t.id),changed,rollbackAttempted,
  rationale:'Public audit showed five simple journal products with no SKU, category, product image, selectable attributes, reviews, or distinguishing variant data. Quarantine is reversible and does not delete product records.'
};
await writeFile(join(backupDir,'journal-quarantine-report.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
