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
function imageDimensions(buf){
  if(buf.length>=24 && buf[0]===0x89 && buf.toString('ascii',1,4)==='PNG') return {width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
  if(buf.length>=4 && buf[0]===0xff && buf[1]===0xd8){
    let i=2;
    while(i+9<buf.length){
      if(buf[i]!==0xff){i++;continue;}
      const marker=buf[i+1]; i+=2;
      if(marker===0xd8||marker===0xd9) continue;
      if(i+2>buf.length) break;
      const len=buf.readUInt16BE(i);
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && i+7<buf.length) return {height:buf.readUInt16BE(i+3),width:buf.readUInt16BE(i+5)};
      i+=len;
    }
  }
  if(buf.length>=30 && buf.toString('ascii',0,4)==='RIFF' && buf.toString('ascii',8,12)==='WEBP'){
    const kind=buf.toString('ascii',12,16);
    if(kind==='VP8X') return {width:1+buf.readUIntLE(24,3),height:1+buf.readUIntLE(27,3)};
    if(kind==='VP8 ' && buf.length>=30) return {width:buf.readUInt16LE(26)&0x3fff,height:buf.readUInt16LE(28)&0x3fff};
    if(kind==='VP8L' && buf.length>=25){
      const b0=buf[21],b1=buf[22],b2=buf[23],b3=buf[24];
      if(b0===0x2f) return {width:1+(b1|((b2&0x3f)<<8)),height:1+((b2>>6)|(b3<<2)|((buf[25]||0)&0x0f)<<10)};
    }
  }
  return null;
}

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
    if(fs.existsSync(src)){
      const dimensions=imageDimensions(fs.readFileSync(src));
      if(!dimensions) errors.push(`unsupported or unreadable raster dimensions: ${rel}`);
      else if(Math.max(dimensions.width,dimensions.height)<2400) errors.push(`production raster below 2400px long-edge minimum: ${rel} (${dimensions.width}x${dimensions.height})`);
    }
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
