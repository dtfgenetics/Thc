#!/usr/bin/env node
// Audits the exact URLs recorded by the canonical WordPress publisher.
// This differs from a guessed static media directory: WordPress uploads may be
// renamed, and the publisher also supports approved GitHub-raw asset URLs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const reportPath=process.env.ENCYCLOPEDIA_VISUAL_PUBLICATION_REPORT;
if(!reportPath || !fs.existsSync(reportPath)){
  throw new Error('Set ENCYCLOPEDIA_VISUAL_PUBLICATION_REPORT to an existing publisher report.');
}
const publication=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const records=publication.updated;
if(!Array.isArray(records) || records.length===0) throw new Error('No published visual rows: live parity cannot be claimed.');
const results=[],errors=[],seen=new Set();
const allowLocal=process.env.ENCYCLOPEDIA_VISUAL_ALLOW_LOCALHOST==='1';
const isLocal=url=>allowLocal && url.protocol==='http:' && ['127.0.0.1','localhost'].includes(url.hostname);
const isWordPress=url=>url.origin==='https://dtfseeds.com' && url.pathname.startsWith('/wp-content/uploads/');
const isCanonical=url=>url.origin==='https://raw.githubusercontent.com' && url.pathname.startsWith('/dtfgenetics/Thc/main/site/wordpress/assets/infographics/');
const parseUrl=(urlString,label)=>{
  const url=new URL(urlString);
  if(url.username||url.password||url.hash||url.search) throw new Error(`${label}: unexpected URL credentials, query, or fragment`);
  if(!isWordPress(url)&&!isCanonical(url)&&!isLocal(url)) throw new Error(`${label}: URL outside authorized public media origins`);
  return url;
};
const fetchBytes=async(url,maxBytes=20*1024*1024)=>{
  const response=await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache, no-store, max-age=0',Accept:'image/png, image/jpeg, image/webp, text/html;q=0.2'},signal:AbortSignal.timeout(20000)});
  if(response.status!==200) throw new Error(`HTTP ${response.status}; redirects are not accepted`);
  const length=Number(response.headers.get('content-length')||0);
  if(length>maxBytes) throw new Error('Content-Length exceeds audit limit');
  const chunks=[]; let size=0;
  for await(const chunk of response.body){
    size+=chunk.length;
    if(size>maxBytes) {await response.body.cancel().catch(()=>{});throw new Error('Response exceeds audit limit');}
    chunks.push(chunk);
  }
  return {body:Buffer.concat(chunks),type:(response.headers.get('content-type')||'').toLowerCase()};
};
const contentTypeFor=name=>{
  const ext=path.extname(name).toLowerCase();
  return ext==='.png'?'image/png':ext==='.webp'?'image/webp':(['.jpg','.jpeg'].includes(ext)?'image/jpeg':null);
};
const hasSignature=(bytes,type)=>type==='image/png'
  ? bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'
  : type==='image/jpeg' ? bytes.subarray(0,3).toString('hex')==='ffd8ff'
  : bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP';
const safeFile=name=>typeof name==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(name) && !name.includes('..');
const verifyRow=async(row)=>{
  const id=String(row.id||'');
  if(!/^THC-ENC-\d{3,}$/.test(id)) throw new Error('Invalid lesson ID');
  if(seen.has(id)) throw new Error(`${id}: duplicate lesson in publication report`);
  seen.add(id);
  const filename=row.assetPath;
  if(!safeFile(filename) || !filename.startsWith(id+'_')) throw new Error(`${id}: unsafe or mismatched local asset filename`);
  const localFile=path.join(root,'site/wordpress/assets/infographics',filename);
  if(!fs.existsSync(localFile)) throw new Error(`${id}: canonical raster missing`);
  const source=fs.readFileSync(localFile);
  const expected=crypto.createHash('sha256').update(source).digest('hex');
  if(!/^[a-f0-9]{64}$/.test(row.assetSha256||'') || expected!==row.assetSha256) throw new Error(`${id}: publication report hash differs from repository image`);
  const imageUrl=parseUrl(row.mediaSourceUrl,id);
  const pageUrl=new URL(row.link);
  if(!isLocal(pageUrl) && !(pageUrl.origin==='https://dtfseeds.com' && pageUrl.pathname===`/learn/encyclopedia/${id.toLowerCase()}/`)){
    throw new Error(`${id}: page URL is not the expected canonical lesson route`);
  }
  if(pageUrl.search||pageUrl.hash||pageUrl.username||pageUrl.password) throw new Error(`${id}: unexpected canonical page URL parameters`);
  const mime=contentTypeFor(filename);
  const [image,page]=await Promise.all([fetchBytes(imageUrl),fetchBytes(pageUrl,5*1024*1024)]);
  if(!image.type.startsWith(mime)) throw new Error(`${id}: public image MIME mismatch: ${image.type}`);
  if(!hasSignature(image.body,mime)) throw new Error(`${id}: public image signature invalid`);
  const actual=crypto.createHash('sha256').update(image.body).digest('hex');
  if(actual!==expected || image.body.length!==source.length) throw new Error(`${id}: public image bytes differ from canonical publisher SHA-256`);
  if(!page.type.startsWith('text/html')) throw new Error(`${id}: lesson response is not HTML`);
  const html=page.body.toString('utf8');
  const marker=`data-thc-lesson-visual-id="${id}"`;
  if(html.split(marker).length-1!==1) throw new Error(`${id}: lesson visual marker must occur exactly once`);
  const start=html.indexOf(marker),end=html.indexOf('</figure>',start);
  if(end<0) throw new Error(`${id}: lesson figure is not closed`);
  const figure=html.slice(start,end);
  const src=imageUrl.toString();
  const htmlSrc=src.replaceAll('&','&amp;');
  if(!figure.includes(src) && !figure.includes(htmlSrc)) throw new Error(`${id}: verified image URL missing from lesson figure`);
  if(!/<img\b[^>]*\bsrc=["']/i.test(figure)) throw new Error(`${id}: image tag missing from lesson figure`);
  return {id,mediaSourceUrl:src,lessonUrl:pageUrl.toString(),sha256:actual,bytes:image.body.length,matched:true};
};
let next=0;
const concurrency=Math.min(8,records.length);
async function worker(){
  while(next<records.length){
    const index=next++,row=records[index];
    try{results.push(await verifyRow(row));}
    catch(error){errors.push({id:row?.id||null,error:String(error?.message||error)});}
  }
}
await Promise.all(Array.from({length:concurrency},()=>worker()));
const summary={expected:records.length,verified:results.length,failures:errors.length,passed:errors.length===0&&results.length===records.length};
const out={schemaVersion:'1.0.0',artifactId:'thc-encyclopedia-wordpress-visual-live-parity',scope:'published-lesson-figure-and-media-bytes',sourceReport:reportPath,summary,errors,items:results};
const outPath=process.env.ENCYCLOPEDIA_VISUAL_LIVE_AUDIT_REPORT||path.join(root,'data/encyclopedia-wordpress-visual-live-parity.json');
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(summary));
if(!summary.passed) process.exitCode=1;
