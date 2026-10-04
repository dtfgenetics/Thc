#!/usr/bin/env node
import fs from 'node:fs';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const manifestPath=process.env.ENCYCLOPEDIA_FULL_BATCH_FILE||'site/wordpress/education/encyclopedia/full-420-production-batch.generated.json';
const concurrency=Math.max(1,Number(process.env.ENCYCLOPEDIA_VERIFY_CONCURRENCY||8));
const attempts=Math.max(1,Number(process.env.ENCYCLOPEDIA_VERIFY_ATTEMPTS||4));
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const ids=(manifest.lessonFiles||[]).map(file=>{
  const match=String(file).match(/thc-enc-(\d{3})\.json$/i);
  if(!match) throw new Error(`Invalid encyclopedia lesson path in manifest: ${file}`);
  return `THC-ENC-${match[1]}`;
});
if(!ids.length) throw new Error('Publication manifest contains no lesson IDs.');
const queue=[...ids], failures=[];
let verified=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function verify(id){
  const slug=id.toLowerCase();
  let last='';
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const res=await fetch(`${site}/learn/encyclopedia/${slug}/?dtf_full_verify=${Date.now()}-${attempt}`,{headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(30_000)});
      const html=await res.text();
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      if(!html.includes(`data-thc-encyclopedia-id="${id}"`)) throw new Error('missing canonical lesson marker');
      if(!html.includes('<h2>Terms to know</h2>')) throw new Error('missing terms section');
      verified+=1; return;
    }catch(error){last=String(error?.message||error); if(attempt<attempts) await sleep(1200*attempt);}
  }
  failures.push({id,error:last});
}
async function worker(){while(queue.length){const id=queue.shift();if(id)await verify(id);}}
await Promise.all(Array.from({length:concurrency},()=>worker()));
if(failures.length){console.error(`Authorized encyclopedia live verification failed: ${failures.length}/${ids.length} route(s).`);for(const row of failures.slice(0,80))console.error(` - ${row.id}: ${row.error}`);process.exit(1);}
console.log(`Authorized encyclopedia live verification PASS: ${verified}/${ids.length} canonical lesson routes.`);
