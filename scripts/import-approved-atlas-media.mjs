#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const root=process.cwd();
const appRoot=path.join(root,'apps/growlens-web/public/atlas');
const mirrorRoot=path.join(root,'site/public-route-patch/atlas');
const importsRoot=path.join(appRoot,'data/media-imports');
console.log('THC Plant Atlas approved-media importer: verifying source, checksum, dimensions and mirrors.');
const registryPath=path.join(appRoot,'data/media-registry-v1.json');
const mirrorRegistryPath=path.join(mirrorRoot,'data/media-registry-v1.json');

function jpegSize(buf){
  if(buf[0]!==0xff||buf[1]!==0xd8) return null;
  let i=2;
  while(i<buf.length){
    if(buf[i]!==0xff){i++;continue;}
    const marker=buf[i+1]; i+=2;
    if(marker===0xd8||marker===0xd9) continue;
    const len=buf.readUInt16BE(i); 
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      return {height:buf.readUInt16BE(i+3),width:buf.readUInt16BE(i+5)};
    }
    i+=len;
  }
  return null;
}
function pngSize(buf){
  if(buf.length<24||buf.toString('ascii',1,4)!=='PNG') return null;
  return {width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
}
function dims(buf){return jpegSize(buf)||pngSize(buf);}
function writeBoth(rel,buf){
  for(const base of [appRoot,mirrorRoot]){
    const dest=path.join(base,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,buf);
  }
}
async function resolveDescriptor(descriptor,file){
  if(!descriptor.commonsTitle) return descriptor;
  const params=new URLSearchParams({
    action:'query',format:'json',prop:'imageinfo',titles:descriptor.commonsTitle,
    iiprop:'url|sha1|size|mime'
  });
  const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params.toString(),{headers:{'User-Agent':'DTF-Plant-Atlas-Media-Importer/1.0'}});
  if(!response.ok) throw new Error(`${file}: Commons metadata lookup failed HTTP ${response.status}`);
  const data=await response.json();
  const page=Object.values(data.query?.pages||{})[0];
  const info=page?.imageinfo?.[0];
  if(!info?.url||!info?.sha1||!info?.width||!info?.height) throw new Error(`${file}: incomplete Commons metadata for ${descriptor.commonsTitle}`);
  if(descriptor.expectedWidth && Number(descriptor.expectedWidth)!==Number(info.width)) throw new Error(`${file}: Commons width mismatch ${info.width}`);
  if(descriptor.expectedHeight && Number(descriptor.expectedHeight)!==Number(info.height)) throw new Error(`${file}: Commons height mismatch ${info.height}`);
  return {...descriptor,downloadUrl:info.url,expectedSha1:String(info.sha1).toLowerCase(),expectedWidth:Number(info.width),expectedHeight:Number(info.height)};
}
async function main(){
  if(!fs.existsSync(importsRoot)){console.log('No approved media imports directory.');return;}
  const files=fs.readdirSync(importsRoot).filter(x=>x.endsWith('.json')).sort();
  const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
  let changed=false;
  for(const file of files){
    let descriptor=JSON.parse(fs.readFileSync(path.join(importsRoot,file),'utf8'));
    if(descriptor.status!=='approved-for-import') continue;
    const record=registry.records.find(r=>r.entityId===descriptor.asset.entityId);
    if(!record) throw new Error(`${file}: unknown entity ${descriptor.asset.entityId}`);
    if(!registry.assetClasses.includes(descriptor.asset.class)) throw new Error(`${file}: unknown class ${descriptor.asset.class}`);
    const existingIndex=record.assets.findIndex(a=>a.assetId===descriptor.asset.assetId);
    const rel=descriptor.asset.src.replace(/^\/atlas\//,'');
    const localSource=path.join(appRoot,rel),localMirror=path.join(mirrorRoot,rel);
    const localReady=fs.existsSync(localSource)&&fs.existsSync(localMirror)&&fs.readFileSync(localSource).equals(fs.readFileSync(localMirror));
    const metadataReady=existingIndex>=0&&JSON.stringify(record.assets[existingIndex])===JSON.stringify(descriptor.asset);
    if(localReady&&metadataReady){
      console.log(`Verified local ${descriptor.asset.assetId}; skipping remote fetch.`);
      continue;
    }
    descriptor=await resolveDescriptor(descriptor,file);
    const response=await fetch(descriptor.downloadUrl,{headers:{'User-Agent':'DTF-Plant-Atlas-Media-Importer/1.0'}});
    if(!response.ok) throw new Error(`${file}: download failed HTTP ${response.status}`);
    const buf=Buffer.from(await response.arrayBuffer());
    const sha1=crypto.createHash('sha1').update(buf).digest('hex');
    if(sha1!==descriptor.expectedSha1.toLowerCase()) throw new Error(`${file}: SHA1 mismatch ${sha1}`);
    const size=dims(buf); if(!size) throw new Error(`${file}: unsupported or unreadable image`);
    if(size.width!==descriptor.expectedWidth||size.height!==descriptor.expectedHeight) throw new Error(`${file}: dimension mismatch ${size.width}x${size.height}`);
    if(Math.max(size.width,size.height)<2400) throw new Error(`${file}: production asset below 2400px long-edge minimum`);
    writeBoth(rel,buf);
    if(existingIndex>=0){
      const before=JSON.stringify(record.assets[existingIndex]);
      const after=JSON.stringify(descriptor.asset);
      if(before!==after){record.assets[existingIndex]=descriptor.asset;changed=true;}
    }else{
      record.assets.push(descriptor.asset);changed=true;
    }
    const have=new Set(record.assets.map(a=>a.class));
    const nextStatus=record.required.every(kind=>have.has(kind))?'approved':'in-production';
    if(record.status!==nextStatus){record.status=nextStatus;changed=true;}
    console.log(`Imported ${descriptor.asset.assetId}: ${size.width}x${size.height}, sha1=${sha1}`);
  }
  if(changed){
    registry.updated=new Date().toISOString().slice(0,10);
    const text=JSON.stringify(registry,null,2)+'\n';
    fs.writeFileSync(registryPath,text);fs.writeFileSync(mirrorRegistryPath,text);
  }
}
await main();
