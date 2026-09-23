#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const sourcePath=path.join(root,'apps/growlens-web/public/atlas/data/media-registry-v1.json');
const mirrorPath=path.join(root,'site/public-route-patch/atlas/data/media-registry-v1.json');
const mediaRoot=path.join(root,'apps/growlens-web/public/atlas/media');
const mirrorMediaRoot=path.join(root,'site/public-route-patch/atlas/media');
const cmd=process.argv[2]||'help';

const read=()=>JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const write=(data)=>{
  data.updated=new Date().toISOString().slice(0,10);
  const text=JSON.stringify(data,null,2)+'\n';
  fs.writeFileSync(sourcePath,text);
  fs.writeFileSync(mirrorPath,text);
};
const usage=()=>{
  console.log('Usage:');
  console.log('  node scripts/atlas-media-registry.mjs template <entityId> <class>');
  console.log('  node scripts/atlas-media-registry.mjs register <asset-json-file>');
  console.log('  node scripts/atlas-media-registry.mjs status');
  console.log('  node scripts/atlas-media-registry.mjs validate');
};
const requiredAssetFields=['assetId','entityId','class','src','source','creator','license','captureType','plantStage','organ','illustrativeOrMeasured'];
function validateAsset(asset,registry){
  const errors=[];
  for(const field of requiredAssetFields) if(!asset[field]) errors.push(`missing ${field}`);
  if(asset.class&&!registry.assetClasses.includes(asset.class)) errors.push(`unknown class ${asset.class}`);
  const rec=registry.records.find(r=>r.entityId===asset.entityId);
  if(!rec) errors.push(`unknown entityId ${asset.entityId}`);
  if(asset.src&&!asset.src.startsWith('/atlas/media/')) errors.push('src must start with /atlas/media/');
  if(asset.src){
    const rel=asset.src.replace(/^\/atlas\/media\//,'');
    const src=path.join(mediaRoot,rel),mir=path.join(mirrorMediaRoot,rel);
    if(!fs.existsSync(src)) errors.push(`source media missing: ${path.relative(root,src)}`);
    if(!fs.existsSync(mir)) errors.push(`mirror media missing: ${path.relative(root,mir)}`);
    if(fs.existsSync(src)&&fs.existsSync(mir)&&!fs.readFileSync(src).equals(fs.readFileSync(mir))) errors.push(`media mirror mismatch: ${rel}`);
  }
  return errors;
}
if(cmd==='template'){
  const [, , , entityId, assetClass]=process.argv;
  if(!entityId||!assetClass){usage();process.exit(2);}
  const registry=read(),record=registry.records.find(r=>r.entityId===entityId);
  if(!record) throw new Error(`Unknown entityId: ${entityId}`);
  if(!registry.assetClasses.includes(assetClass)) throw new Error(`Unknown asset class: ${assetClass}`);
  console.log(JSON.stringify({
    assetId:`PA-${entityId.toUpperCase().replace(/[^A-Z0-9]+/g,'-')}-001`,
    entityId,
    class:assetClass,
    src:`/atlas/media/${entityId}/replace-me.png`,
    source:'replace with source/provenance',
    creator:'replace with creator',
    license:'replace with redistribution license',
    captureType:assetClass.includes('microscopy')?'microscopy':assetClass.includes('photoreal')||assetClass.includes('macro')?'photography':'illustration',
    plantStage:'replace with applicable stage',
    organ:'replace with tissue/organ',
    illustrativeOrMeasured:assetClass.includes('microscopy')?'measured':'illustrative',
    alt:'replace with concise scientific alt text',
    title:'replace with display title'
  },null,2));
  process.exit(0);
}
if(cmd==='register'){
  const file=process.argv[3]; if(!file){usage();process.exit(2);}
  const registry=read(),asset=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  const errors=validateAsset(asset,registry);
  if(errors.length){console.error(errors.map(x=>' - '+x).join('\n'));process.exit(1);}
  for(const record of registry.records) record.assets=record.assets.filter(a=>a.assetId!==asset.assetId);
  const record=registry.records.find(r=>r.entityId===asset.entityId);
  record.assets.push(asset);
  const classes=new Set(record.assets.map(a=>a.class));
  record.status=record.required.every(k=>classes.has(k))?'approved':'in-production';
  write(registry);
  console.log(`Registered ${asset.assetId} for ${asset.entityId}; status=${record.status}`);
  process.exit(0);
}
if(cmd==='status'){
  const registry=read();
  for(const r of registry.records){
    const have=new Set(r.assets.map(a=>a.class));
    const missing=r.required.filter(k=>!have.has(k));
    console.log(`${r.entityId}: ${r.status} | ${r.assets.length} assets | missing: ${missing.join(', ')||'none'}`);
  }
  process.exit(0);
}
if(cmd==='validate'){
  const registry=read(); let errors=[];
  const ids=new Set();
  for(const r of registry.records){
    for(const asset of r.assets){
      if(ids.has(asset.assetId)) errors.push(`duplicate assetId ${asset.assetId}`);
      ids.add(asset.assetId);
      errors.push(...validateAsset(asset,registry).map(e=>`${asset.assetId}: ${e}`));
    }
  }
  if(errors.length){console.error(errors.map(x=>' - '+x).join('\n'));process.exit(1);}
  console.log(`Atlas media registry valid: ${ids.size} registered production assets.`);
  process.exit(0);
}
usage();
