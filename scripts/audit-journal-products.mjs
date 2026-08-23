import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const outputRoot=process.env.JOURNAL_AUDIT_ROOT||'/tmp/dtf-journal-audit';
await mkdir(outputRoot,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchJson(url){
  let lastError;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'DTFSeeds-Journal-Audit/1.0'},redirect:'follow',signal:AbortSignal.timeout(30_000)});
      const text=await response.text();
      let body=null;try{body=text?JSON.parse(text):null;}catch{}
      if(response.status>=500&&attempt<5){await sleep(attempt*2000);continue;}
      if(!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0,300)}`);
      return body;
    }catch(error){lastError=error;if(attempt<5){await sleep(attempt*2000);continue;}}
  }
  throw lastError;
}

const products=await fetchJson(`${siteUrl}/wp-json/wc/store/v1/products?per_page=100`);
if(!Array.isArray(products)) throw new Error('WooCommerce Store API did not return a product list');
const journals=products.filter(product=>/journal/i.test(String(product?.name||'')));

function text(html=''){return String(html).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
const rows=journals.map(product=>({
  id:product.id,
  name:product.name,
  slug:product.slug,
  sku:product.sku||null,
  permalink:product.permalink,
  price:product.prices?.price||null,
  regularPrice:product.prices?.regular_price||null,
  salePrice:product.prices?.sale_price||null,
  currency:product.prices?.currency_code||null,
  onSale:Boolean(product.on_sale),
  hasOptions:Boolean(product.has_options),
  isPurchasable:Boolean(product.is_purchasable),
  averageRating:product.average_rating||null,
  reviewCount:product.review_count||0,
  categories:(product.categories||[]).map(c=>({id:c.id,name:c.name,slug:c.slug})),
  attributes:(product.attributes||[]).map(a=>({id:a.id,name:a.name,terms:a.terms||[],hasVariations:Boolean(a.has_variations)})),
  images:(product.images||[]).map(image=>({id:image.id,src:image.src,name:image.name,alt:image.alt})),
  shortDescription:text(product.short_description||''),
  description:text(product.description||'').slice(0,1000)
}));

const fingerprint=row=>JSON.stringify({name:row.name.toLowerCase().replace(/[^a-z0-9]+/g,' '),price:row.price,regularPrice:row.regularPrice,salePrice:row.salePrice,attributes:row.attributes,images:row.images.map(i=>i.id),description:row.description});
const fingerprintGroups={};
for(const row of rows){const fp=fingerprint(row);(fingerprintGroups[fp]??=[]).push(row.id);}
const exactDuplicateGroups=Object.values(fingerprintGroups).filter(ids=>ids.length>1);
const report={generatedAt:new Date().toISOString(),siteUrl,totalStoreProducts:products.length,journalCount:rows.length,journals:rows,exactDuplicateGroups};
await writeFile(join(outputRoot,'journal-products-audit.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
