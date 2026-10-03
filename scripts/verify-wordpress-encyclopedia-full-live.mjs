#!/usr/bin/env node
const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const concurrency=Math.max(1,Number(process.env.ENCYCLOPEDIA_VERIFY_CONCURRENCY||8));
const attempts=Math.max(1,Number(process.env.ENCYCLOPEDIA_VERIFY_ATTEMPTS||4));
const ids=Array.from({length:420},(_,i)=>`THC-ENC-${String(i+1).padStart(3,'0')}`);
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
if(failures.length){console.error(`Full encyclopedia live verification failed: ${failures.length}/420 route(s).`);for(const row of failures.slice(0,80))console.error(` - ${row.id}: ${row.error}`);process.exit(1);}
console.log(`Full encyclopedia live verification PASS: ${verified}/420 canonical lesson routes.`);
