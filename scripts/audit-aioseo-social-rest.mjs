import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const outputRoot=process.env.AIOSEO_AUDIT_ROOT||'/tmp/aioseo-social-audit';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-AIOSEO-Audit/1.2'};
await mkdir(outputRoot,{recursive:true});

async function fetchJson(path,options={}){
  const response=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(45_000)});
  const text=await response.text();
  let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
  return {status:response.status,ok:response.ok,allow:response.headers.get('allow'),body};
}

function safeMetadata(value,depth=0){
  if(depth>5) return '[depth-limit]';
  if(value===null||['string','number','boolean'].includes(typeof value)) return value;
  if(Array.isArray(value)) return value.slice(0,20).map(item=>safeMetadata(item,depth+1));
  if(typeof value!=='object') return String(value);
  const out={};
  for(const [key,val] of Object.entries(value)){
    if(/license|key|token|secret|password|auth/i.test(key)) continue;
    if(depth===0 || /facebook|twitter|social|image|og|title|description|post|id|type|url|canonical|schema/i.test(key)) out[key]=safeMetadata(val,depth+1);
  }
  return out;
}

function cleanObject(value){
  if(value===null||['string','number','boolean'].includes(typeof value)) return value;
  if(Array.isArray(value)) return value.slice(0,50).map(cleanObject);
  if(!value||typeof value!=='object') return String(value??'');
  return Object.fromEntries(Object.entries(value)
    .filter(([key])=>!/license|token|secret|password|auth|api.?key/i.test(key))
    .map(([key,val])=>[key,cleanObject(val)]));
}

const indexResult=await fetchJson('/wp-json/');
if(!indexResult.ok||!indexResult.body?.routes) throw new Error(`WordPress REST index unavailable (${indexResult.status})`);
const routes=indexResult.body.routes;
const wanted=[
  '/aioseo/v1/post',
  '/aioseo/v1/options',
  '/aioseo/v1/post/(?P<postId>[\\d]+)/first-attached-image',
  '/aioseo/v1/posts-list/load-details-column',
  '/aioseo/v1/posts-list/update-details-column'
];
const selected={};
for(const key of wanted){if(routes[key]) selected[key]=routes[key];}

const optionProbes={};
for(const path of ['/wp-json/aioseo/v1/post','/wp-json/aioseo/v1/options']){
  const probe=await fetchJson(path,{method:'OPTIONS'});
  optionProbes[path]={status:probe.status,ok:probe.ok,allow:probe.allow,body:safeMetadata(probe.body)};
}

const optionsGet=await fetchJson('/wp-json/aioseo/v1/options');
if(!optionsGet.ok||!optionsGet.body?.success) throw new Error(`Unable to read AIOSEO options (${optionsGet.status})`);
const aioOptions=optionsGet.body?.options||{};
const activeSocialSettings={
  facebook:cleanObject(aioOptions?.social?.facebook?.general??null),
  twitter:cleanObject(aioOptions?.social?.twitter?.general??null),
  profiles:cleanObject(aioOptions?.social?.profiles??null)
};

const homepageId=743;
const postProbes={};
for(const query of [
  `postId=${homepageId}`,
  `post_id=${homepageId}`,
  `id=${homepageId}`,
  `postId=${homepageId}&postType=page`,
  `post_id=${homepageId}&post_type=page`
]){
  const path=`/wp-json/aioseo/v1/post?${query}`;
  const probe=await fetchJson(path);
  postProbes[query]={status:probe.status,ok:probe.ok,body:safeMetadata(probe.body)};
}
const attached=await fetchJson(`/wp-json/aioseo/v1/post/${homepageId}/first-attached-image`);

function endpointSummary(route){
  if(!route) return [];
  const endpoints=Array.isArray(route.endpoints)?route.endpoints:[];
  return endpoints.map(endpoint=>({
    methods:endpoint.methods,
    args:endpoint.args?Object.fromEntries(Object.entries(endpoint.args).map(([name,arg])=>[name,{
      required:Boolean(arg?.required),
      type:arg?.type||null,
      default:arg?.default??null,
      enum:arg?.enum||null,
      description:arg?.description||null
    }])):{},
  }));
}

const report={
  generatedAt:new Date().toISOString(),
  siteUrl,
  homepageId,
  aioseoNamespacePresent:Array.isArray(indexResult.body.namespaces)&&indexResult.body.namespaces.includes('aioseo/v1'),
  selectedRoutes:Object.fromEntries(Object.entries(selected).map(([key,value])=>[key,{namespace:value.namespace,methods:value.methods,endpoints:endpointSummary(value)}])),
  optionProbes,
  activeSocialSettings,
  postProbes,
  firstAttachedImage:{status:attached.status,ok:attached.ok,body:safeMetadata(attached.body)}
};

await writeFile(join(outputRoot,'aioseo-social-route-audit.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
