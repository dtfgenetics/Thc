import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const outputRoot=process.env.AIOSEO_PROBE_ROOT||'/tmp/aioseo-write-probe';
const postId=Number(process.env.AIOSEO_HOME_POST_ID||743);
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const baseHeaders={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-AIOSEO-Write-Probe/1.2'};
await mkdir(outputRoot,{recursive:true});

async function request(path,{method='GET'}={}){
  const response=await fetch(`${siteUrl}${path}`,{method,headers:baseHeaders,redirect:'follow',signal:AbortSignal.timeout(45_000)});
  const text=await response.text();let parsed=null;try{parsed=text?JSON.parse(text):null;}catch{parsed=text;}
  return {status:response.status,ok:response.ok,body:parsed};
}
const socialKeys=['og_object_type','og_title','og_description','og_image_custom_url','og_image_custom_fields','og_image_type','og_video','og_article_section','og_article_tags','twitter_use_og','twitter_card','twitter_image_custom_url','twitter_image_custom_fields','twitter_image_type','twitter_title','twitter_description'];
const selectSocial=post=>Object.fromEntries(socialKeys.map(k=>[k,post?.[k]??null]));
const getCurrent=async()=>{
  const r=await request(`/wp-json/aioseo/v1/post?postId=${postId}`);
  if(!r.ok||!r.body?.success||!r.body?.data?.currentPost) throw new Error(`Unable to read AIOSEO post ${postId}: ${r.status} ${JSON.stringify(r.body).slice(0,500)}`);
  return r.body.data.currentPost;
};

const before=await getCurrent();
await writeFile(join(outputRoot,'home-aioseo-before.json'),`${JSON.stringify(before,null,2)}\n`);
const beforeSocial=selectSocial(before);

// Contract probe: put the known required postId in the request URL and supply no update payload.
const probe=await request(`/wp-json/aioseo/v1/post?postId=${postId}`,{method:'POST'});
const after=await getCurrent();
const afterSocial=selectSocial(after);
const unchanged=JSON.stringify(beforeSocial)===JSON.stringify(afterSocial);
const report={generatedAt:new Date().toISOString(),siteUrl,postId,payloadEncoding:'none; postId in query string',probeStatus:probe.status,probeOk:probe.ok,probeResponse:probe.body&&typeof probe.body==='object'?{success:probe.body.success??null,message:probe.body.message??null,dataKeys:probe.body.data&&typeof probe.body.data==='object'?Object.keys(probe.body.data):[]}:String(probe.body||'').slice(0,300),beforeSocial,afterSocial,unchanged};
await writeFile(join(outputRoot,'aioseo-write-contract-probe.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
if(!unchanged) throw new Error('AIOSEO query-only contract probe changed social metadata unexpectedly.');
// A 4xx is acceptable here if it reveals the next required parameter; the state-preservation proof is the safety gate.
if(!probe.ok && probe.status>=500) throw new Error(`AIOSEO query-only POST probe failed unexpectedly (${probe.status}): ${JSON.stringify(probe.body).slice(0,500)}`);
