import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const outputRoot=process.env.AIOSEO_AUDIT_ROOT||'/tmp/aioseo-social-audit';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-AIOSEO-Audit/1.3'};
await mkdir(outputRoot,{recursive:true});

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchJson(path,options={}){
  let lastError;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(45_000)});
      const text=await response.text();
      let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
      if(response.status>=500&&attempt<5){await sleep(attempt*2500);continue;}
      return {status:response.status,ok:response.ok,allow:response.headers.get('allow'),body};
    }catch(error){
      lastError=error;
      if(attempt<5){await sleep(attempt*2500);continue;}
    }
  }
  throw lastError||new Error(`Request failed: ${path}`);
}

function clean(value,depth=0){
  if(depth>7) return '[depth-limit]';
  if(value===null||['string','number','boolean'].includes(typeof value)) return value;
  if(Array.isArray(value)) return value.slice(0,50).map(v=>clean(v,depth+1));
  if(!value||typeof value!=='object') return String(value??'');
  return Object.fromEntries(Object.entries(value)
    .filter(([key])=>!/license|token|secret|password|auth|api.?key/i.test(key))
    .map(([key,val])=>[key,clean(val,depth+1)]));
}

const indexResult=await fetchJson('/wp-json/');
if(!indexResult.ok||!indexResult.body?.routes) throw new Error(`WordPress REST index unavailable (${indexResult.status})`);
const optionsGet=await fetchJson('/wp-json/aioseo/v1/options');
if(!optionsGet.ok||!optionsGet.body?.success) throw new Error(`Unable to read AIOSEO options (${optionsGet.status})`);

const homepageId=743;
const homeGet=await fetchJson(`/wp-json/aioseo/v1/post?postId=${homepageId}`);
if(!homeGet.ok||!homeGet.body?.success) throw new Error(`Unable to read homepage AIOSEO data (${homeGet.status})`);
const attached=await fetchJson(`/wp-json/aioseo/v1/post/${homepageId}/first-attached-image`);
const aioOptions=optionsGet.body?.options||{};
const currentPost=homeGet.body?.data?.currentPost||{};

const report={
  generatedAt:new Date().toISOString(),
  siteUrl,
  homepageId,
  aioseoNamespacePresent:Array.isArray(indexResult.body.namespaces)&&indexResult.body.namespaces.includes('aioseo/v1'),
  postRouteMethods:indexResult.body.routes?.['/aioseo/v1/post']?.methods||[],
  optionsRouteMethods:indexResult.body.routes?.['/aioseo/v1/options']?.methods||[],
  activeSocialSettings:{
    facebook:clean(aioOptions?.social?.facebook?.general??null),
    twitter:clean(aioOptions?.social?.twitter?.general??null)
  },
  homepageSocial:{
    id:currentPost.id??null,
    title:currentPost.title??null,
    description:currentPost.description??null,
    og_object_type:currentPost.og_object_type??null,
    og_title:currentPost.og_title??null,
    og_description:currentPost.og_description??null,
    og_image_type:currentPost.og_image_type??null,
    og_image_custom_url:currentPost.og_image_custom_url??null,
    og_image_custom_fields:currentPost.og_image_custom_fields??null,
    twitter_use_og:currentPost.twitter_use_og??null,
    twitter_card:currentPost.twitter_card??null,
    twitter_image_type:currentPost.twitter_image_type??null,
    twitter_image_custom_url:currentPost.twitter_image_custom_url??null
  },
  firstAttachedImage:{status:attached.status,ok:attached.ok,body:clean(attached.body)}
};

await writeFile(join(outputRoot,'aioseo-social-route-audit.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
