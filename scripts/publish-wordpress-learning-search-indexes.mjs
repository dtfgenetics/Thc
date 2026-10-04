import fs from 'node:fs';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth='Basic '+Buffer.from(user+':'+pass).toString('base64');
const headers={Authorization:auth,Accept:'application/json','Content-Type':'application/json','User-Agent':'DTF-Learning-Search-Index-Publisher/1.0'};

const search=JSON.parse(fs.readFileSync('site/public-route-patch/learn/search/search-index.json','utf8'));
const encyclopedia=JSON.parse(fs.readFileSync('site/public-route-patch/learn/encyclopedia/encyclopedia-index.json','utf8'));

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transientStatuses=new Set([429,500,502,503,504]);
async function request(path,options={}){
  const method=options.method||'GET';
  const retrySafe=method==='GET'||(method==='POST'&&path.startsWith('/wp-json/dtf-learning/v1/index/'));
  const maxAttempts=retrySafe?7:1;
  let lastError=null;
  for(let attempt=1;attempt<=maxAttempts;attempt+=1){
    try{
      const r=await fetch(site+path,{...options,headers:{...headers,...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60000)});
      const text=await r.text();
      let body=text;try{body=text?JSON.parse(text):null}catch{}
      if(r.ok) return body;
      const message=method+' '+path+' failed ('+r.status+'): '+String(typeof body==='string'?body:JSON.stringify(body)).slice(0,800);
      if(!retrySafe||!transientStatuses.has(r.status)||attempt===maxAttempts) throw new Error(message);
      const retryAfter=Number(r.headers.get('retry-after')||0);
      const delay=retryAfter>0?retryAfter*1000:Math.min(15_000,750*(2**(attempt-1)));
      console.warn(message+` · retrying attempt ${attempt+1}/${maxAttempts} after ${delay}ms`);
      await sleep(delay);
    }catch(error){
      lastError=error;
      const retryableNetwork=retrySafe&&(error?.name==='TimeoutError'||error?.name==='AbortError'||/fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(String(error?.message||error)));
      if(!retryableNetwork||attempt===maxAttempts) throw error;
      const delay=Math.min(15_000,750*(2**(attempt-1)));
      console.warn(`${method} ${path} network error: ${String(error?.message||error)} · retrying attempt ${attempt+1}/${maxAttempts} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastError||new Error(`${method} ${path} exhausted retries`);
}
const healthBefore=await request('/wp-json/dtf-learning/v1/health',{headers:{Authorization:auth,Accept:'application/json'}});
if(!healthBefore?.ok) throw new Error('DTF Learning Search runtime health endpoint is unavailable.');

const searchResult=await request('/wp-json/dtf-learning/v1/index/search',{method:'POST',body:JSON.stringify(search)});
const encyclopediaResult=await request('/wp-json/dtf-learning/v1/index/encyclopedia',{method:'POST',body:JSON.stringify(encyclopedia)});
const health=await request('/wp-json/dtf-learning/v1/health',{headers:{Authorization:auth,Accept:'application/json'}});
if(!health?.ok||!health?.searchReady||!health?.encyclopediaReady)throw new Error('Search indexes did not become ready.');
if(Number(health.searchDocuments)<20||Number(health.encyclopediaLessons)<420)throw new Error('Published search index counts are incomplete.');
console.log(JSON.stringify({ok:true,search:searchResult,encyclopedia:encyclopediaResult,health},null,2));
