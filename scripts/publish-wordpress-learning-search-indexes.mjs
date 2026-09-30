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

async function request(path,options={}){
  const r=await fetch(site+path,{...options,headers:{...headers,...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60000)});
  const text=await r.text();
  let body=text;try{body=text?JSON.parse(text):null}catch{}
  if(!r.ok)throw new Error((options.method||'GET')+' '+path+' failed ('+r.status+'): '+String(typeof body==='string'?body:JSON.stringify(body)).slice(0,800));
  return body;
}
const healthBefore=await request('/wp-json/dtf-learning/v1/health',{headers:{Authorization:auth,Accept:'application/json'}});
if(!healthBefore?.ok) throw new Error('DTF Learning Search runtime health endpoint is unavailable.');

const searchResult=await request('/wp-json/dtf-learning/v1/index/search',{method:'POST',body:JSON.stringify(search)});
const encyclopediaResult=await request('/wp-json/dtf-learning/v1/index/encyclopedia',{method:'POST',body:JSON.stringify(encyclopedia)});
const health=await request('/wp-json/dtf-learning/v1/health',{headers:{Authorization:auth,Accept:'application/json'}});
if(!health?.ok||!health?.searchReady||!health?.encyclopediaReady)throw new Error('Search indexes did not become ready.');
if(Number(health.searchDocuments)<20||Number(health.encyclopediaLessons)<420)throw new Error('Published search index counts are incomplete.');
console.log(JSON.stringify({ok:true,search:searchResult,encyclopedia:encyclopediaResult,health},null,2));
