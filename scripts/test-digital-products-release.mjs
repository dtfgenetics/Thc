#!/usr/bin/env node
// Negative regression checks for the digital-commerce release gate.
// Usage: node scripts/test-digital-products-release.mjs <release-folder>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const source=process.argv[2];
if(!source){console.error('Supply the extracted release directory');process.exit(2)}
const validator=path.join(source,'validate-commerce-release.mjs');
const files=fs.readdirSync(source).filter(f=>fs.statSync(path.join(source,f)).isFile());
const run=(dir)=>spawnSync(process.execPath,[validator,dir],{encoding:'utf8'});
assert.equal(run(source).status,0,'Original package failed validation');
const cases=[
 ['price changed',dir=>{const f=path.join(dir,'WooCommerce_DRAFT_Product_Import.csv');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('19.99','99.99'))}],
 ['PDF modified',dir=>fs.appendFileSync(path.join(dir,'DTF_Cultivation_Record_Workbook_v1.pdf'),'tampered')],
 ['missing bundle',dir=>{const f=path.join(dir,'STORE_CATALOG_DRAFT.json');const c=JSON.parse(fs.readFileSync(f));c.products=c.products.filter(x=>x.sku!=='DTF-FIELD-BUNDLE-001');fs.writeFileSync(f,JSON.stringify(c))}]
];
for(const [name,change] of cases){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dtf-check-'));try{files.forEach(f=>fs.copyFileSync(path.join(source,f),path.join(dir,f)));change(dir);assert.notEqual(run(dir).status,0,'Accepted invalid release: '+name);console.log('PASS rejected '+name)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
console.log('PASS: all negative regression tests');
