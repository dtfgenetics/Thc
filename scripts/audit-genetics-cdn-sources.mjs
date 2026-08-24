import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import process from 'node:process';

const catalogPath=process.env.SEED_LINE_CATALOG||'site/wordpress/products/seed-line-catalog.json';
const output=process.env.GENETICS_CDN_REPORT||'genetics-cdn-source-report.json';
const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
if(catalog?.schemaVersion!==1||catalog.lines?.length!==8)throw new Error('Expected canonical 8-line genetics catalog.');
const sha=b=>createHash('sha256').update(b).digest('hex');
function imageInfo(b){if(b.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return{mime:'image/png',width:b.readUInt32BE(16),height:b.readUInt32BE(20)};if(b.subarray(0,3).toString('hex')==='ffd8ff'){let o=2;while(o+9<b.length){if(b[o]!==255){o++;continue}const m=b[o+1];if(m===216||m===217){o+=2;continue}const n=b.readUInt16BE(o+2);if(n<2||o+2+n>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m))return{mime:'image/jpeg',height:b.readUInt16BE(o+5),width:b.readUInt16BE(o+7)};o+=2+n}}throw new Error('Unsupported or invalid image');}
const rows=[];
for(const line of catalog.lines){for(const card of line.releaseCards||[]){const r=await fetch(card.sourceUrl,{headers:{Accept:'image/*','Cache-Control':'no-cache, no-store, max-age=0','User-Agent':'DTFSeeds-Genetics-CDN-Audit/1.0'},redirect:'follow',signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`${line.id} ${card.generation} ${card.seedType}: CDN HTTP ${r.status}`);const b=Buffer.from(await r.arrayBuffer());const info=imageInfo(b);if(info.width!==Number(card.expectedWidth)||info.height!==Number(card.expectedHeight))throw new Error(`${line.id} ${card.generation}: dimensions ${info.width}x${info.height} != ${card.expectedWidth}x${card.expectedHeight}`);rows.push({lineId:line.id,lineName:line.name,generation:card.generation,seedType:card.seedType,wordpressSlug:card.wordpressSlug,url:card.sourceUrl,mimeType:info.mime,width:info.width,height:info.height,cdnByteLength:b.length,cdnSha256:sha(b),provenanceByteLength:card.sourceByteLength??null,provenanceSha256:card.sourceSha256??null});}}
if(rows.length!==10)throw new Error(`Expected 10 reviewed card sources; found ${rows.length}`);
const report={generatedAt:new Date().toISOString(),catalogPath,count:rows.length,rows};
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
