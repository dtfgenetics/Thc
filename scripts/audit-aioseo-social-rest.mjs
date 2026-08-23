import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const outputRoot=process.env.AIOSEO_AUDIT_ROOT||'/tmp/aioseo-social-audit';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-AIOSEO-Audit/1.0'};
await mkdir(outputRoot,{recursive:true});

async function fetchJson(path,options={}){
  const response=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(45_000)});
  const text=await response.text();
  let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
  return {status:response.status,ok:response.ok,allow:response.headers.get('allow'),body};
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
  optionProbes[path]=await fetchJson(path,{method:'OPTIONS'});
}

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
  aioseoNamespacePresent:Array.isArray(indexResult.body.namespaces)&&indexResult.body.namespaces.includes('aioseo/v1'),
  selectedRoutes:Object.fromEntries(Object.entries(selected).map(([key,value])=>[key,{namespace:value.namespace,methods:value.methods,endpoints:endpointSummary(value)}])),
  optionProbes:Object.fromEntries(Object.entries(optionProbes).map(([path,result])=>[path,{status:result.status,ok:result.ok,allow:result.allow,body:result.body}])),
};

await writeFile(join(outputRoot,'aioseo-social-route-audit.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
