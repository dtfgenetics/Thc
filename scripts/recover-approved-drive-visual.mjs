import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

const manifestPath=process.env.RECOVERY_MANIFEST||process.argv[2]||'';
if(!manifestPath) throw new Error('RECOVERY_MANIFEST or manifest path argument is required.');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));

const fail=(message)=>{throw new Error(`${manifestPath}: ${message}`);};
if(manifest?.schemaVersion!==1) fail('schemaVersion must be 1');
if(!manifest?.publication?.oneAtATime) fail('oneAtATime must be true');
if(manifest?.publication?.status!=='awaiting-canonical-binary-import') fail(`unexpected publication status: ${manifest?.publication?.status}`);
if(!manifest?.drive?.fileId) fail('drive.fileId is required');
if(!manifest?.drive?.sha256||!/^[a-f0-9]{64}$/i.test(manifest.drive.sha256)) fail('drive.sha256 must be a 64-character SHA-256');
if(!Number(manifest?.drive?.widthPx)||!Number(manifest?.drive?.heightPx)) fail('expected width/height are required');
if(!Number(manifest?.drive?.sizeBytes)) fail('expected sizeBytes is required');
if(manifest?.drive?.driveStatus!=='approved') fail('Drive source must be explicitly approved');

const root=manifest?.canonical?.destinationRoot;
const fileName=manifest?.canonical?.destinationFilename;
if(root!=='site/wordpress/assets/infographics') fail(`unsupported destination root: ${root}`);
if(!fileName||/[\\/]/.test(fileName)) fail('destinationFilename must be a basename');
if(/draft|review|required|legacy|superseded|quarantine|rebuild/i.test(fileName)) fail('unsafe status marker in destination filename');
const expectedExt=String(manifest?.drive?.actualFileExtension||'').toLowerCase();
if(!['jpg','jpeg','png'].includes(expectedExt)) fail(`unsupported actual extension: ${expectedExt}`);
const actualNameExt=(fileName.split('.').pop()||'').toLowerCase();
if((expectedExt==='jpeg'?'jpg':expectedExt)!==(actualNameExt==='jpeg'?'jpg':actualNameExt)) fail(`destination extension ${actualNameExt} does not match actual encoding ${expectedExt}`);

const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
function imageInfo(bytes){
  if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a') return {format:'png',mimeType:'image/png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  if(bytes.subarray(0,3).toString('hex')==='ffd8ff'){
    let offset=2;
    while(offset+9<bytes.length){
      if(bytes[offset]!==0xff){offset+=1;continue;}
      const marker=bytes[offset+1];
      if(marker===0xd8||marker===0xd9){offset+=2;continue;}
      const length=bytes.readUInt16BE(offset+2);
      if(length<2||offset+2+length>bytes.length) break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return {format:'jpeg',mimeType:'image/jpeg',height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};
      offset+=2+length;
    }
  }
  fail('downloaded bytes are not a supported PNG/JPEG image');
}

const urls=[
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(manifest.drive.fileId)}&export=download&confirm=t`,
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(manifest.drive.fileId)}&confirm=t`
];
let bytes=null;let sourceUrl='';const failures=[];
for(const url of urls){
  try{
    const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(90_000),headers:{Accept:'image/avif,image/webp,image/apng,image/*,*/*;q=0.8','User-Agent':'DTFSeeds-Single-Visual-Recovery/1.0'}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const candidate=Buffer.from(await response.arrayBuffer());
    const info=imageInfo(candidate);
    const hash=sha256(candidate);
    if(candidate.length!==Number(manifest.drive.sizeBytes)) throw new Error(`size ${candidate.length} != ${manifest.drive.sizeBytes}`);
    if(info.width!==Number(manifest.drive.widthPx)||info.height!==Number(manifest.drive.heightPx)) throw new Error(`dimensions ${info.width}x${info.height} != ${manifest.drive.widthPx}x${manifest.drive.heightPx}`);
    if(hash.toLowerCase()!==String(manifest.drive.sha256).toLowerCase()) throw new Error(`sha256 ${hash} != ${manifest.drive.sha256}`);
    const mimeExpected=String(manifest.drive.actualMimeType||'');
    if(mimeExpected&&info.mimeType!==mimeExpected) throw new Error(`MIME ${info.mimeType} != ${mimeExpected}`);
    bytes=candidate;sourceUrl=url;break;
  }catch(error){failures.push(`${url}: ${error.message}`);}
}
if(!bytes) fail(`approved Drive binary could not be downloaded and validated: ${failures.join(' | ')}`);

const destination=join(root,fileName);
await mkdir(dirname(destination),{recursive:true});
try{
  const existing=await readFile(destination);
  if(sha256(existing)!==sha256(bytes)) fail(`destination already exists with different bytes: ${destination}`);
}catch(error){
  if(error?.code!=='ENOENT') throw error;
}
await writeFile(destination,bytes);

manifest.canonical.sha256=sha256(bytes);
manifest.canonical.sizeBytes=bytes.length;
manifest.canonical.widthPx=manifest.drive.widthPx;
manifest.canonical.heightPx=manifest.drive.heightPx;
manifest.publication.status='canonical-binary-imported';
manifest.publication.importedAt=new Date().toISOString();
manifest.publication.sourceTransport='validated-google-drive-direct-download';
manifest.publication.nextStep='Map this exact canonical filename to the single intended visual slot, run deterministic audits, publish, and verify live before recovering another asset.';
await writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);

console.log(JSON.stringify({manifestPath,destination,bytes:bytes.length,sha256:sha256(bytes),sourceUrl},null,2));
