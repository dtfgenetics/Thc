#!/usr/bin/env node
// Validate release manifests and WooCommerce draft metadata without exposing paid file URLs.
// Usage: node scripts/validate-digital-products-release.mjs <release-folder>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const folder=process.argv[2];
if(!folder){console.error('Usage: node scripts/validate-digital-products-release.mjs <release-folder>');process.exit(2)}
const issues=[];
const exists=n=>fs.existsSync(path.join(folder,n));
const required=['DTF_Cultivation_Record_Workbook_v1.pdf','DTF_Environmental_Measurement_Toolkit_v1.pdf','DTF_Environmental_Calculator_and_Grow_Logs_v1.xlsx','STORE_CATALOG_DRAFT.json','WooCommerce_DRAFT_Product_Import.csv'];
for(const file of required) if(!exists(file)) issues.push('Missing required file: '+file);
if(exists('STORE_CATALOG_DRAFT.json')){
  let json;
  try{json=JSON.parse(fs.readFileSync(path.join(folder,'STORE_CATALOG_DRAFT.json'),'utf8'))}catch(e){issues.push('Invalid catalog JSON: '+e.message)}
  if(json){
    const skus=new Set();
    for(const product of json.products||[]){
      if(skus.has(product.sku))issues.push('Duplicate SKU '+product.sku);
      skus.add(product.sku);
      if(product.status!=='draft')issues.push('Catalog product not in draft: '+product.sku);
      for(const f of product.files||[])if(!exists(f))issues.push(product.sku+' missing deliverable '+f);
    }
  }
}
if(exists('SHA256SUMS.txt')){
 const lines=fs.readFileSync(path.join(folder,'SHA256SUMS.txt'),'utf8').trim().split(/\r?\n/);
 for(const line of lines){
  const m=/^([a-f0-9]{64})\s+(.+)$/.exec(line);
  if(!m){issues.push('Invalid checksum line');continue;}
  const [_,digest,filename]=m;
  if(!exists(filename)){issues.push('Checksum target absent: '+filename);continue;}
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,filename))).digest('hex');
  if(digest!==actual)issues.push('Checksum mismatch: '+filename);
 }
}else issues.push('SHA256SUMS.txt missing');
if(issues.length){console.error('FAIL\n'+issues.join('\n'));process.exit(1)}
console.log('PASS: release structure, draft catalog and included SHA256 checksums');
console.log('NOT VERIFIED: file protection, processor eligibility, actual WooCommerce product attachments, orders, refunds, checkout or live publication.');
