import './wordpress-ipv4-fetch-bootstrap.mjs';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const sourcePath='site/wordpress/mu-plugins/dtf-canonical-sitemap.php';
const snippetName='DTF Canonical Sitemap Routes — source controlled';
if(!username||!password) throw new Error('WordPress credentials are required.');

const source=await readFile(sourcePath,'utf8');
const sourceSha256=crypto.createHash('sha256').update(source).digest('hex');
const auth='Basic '+Buffer.from(username+':'+password).toString('base64');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function request(path,{method='GET',json,allow=[]}={},attempts=6){
  let last;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const res=await fetch(siteUrl+path,{
        method,redirect:'follow',signal:AbortSignal.timeout(60000),
        headers:{Authorization:auth,Accept:'application/json,text/xml,text/plain,*/*','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTF-Canonical-Sitemap-Installer/1.0',...(json!==undefined?{'Content-Type':'application/json'}:{})},
        body:json!==undefined?JSON.stringify(json):undefined
      });
      const text=await res.text(); let body=text; try{body=text?JSON.parse(text):null}catch{}
      if((res.status===429||res.status>=500)&&attempt<attempts){await sleep(attempt*1200);continue}
      if(!res.ok&&!allow.includes(res.status)) throw new Error(method+' '+path+' failed ('+res.status+'): '+String(text).slice(0,800));
      return {ok:res.ok,status:res.status,body,text};
    }catch(error){last=error;if(attempt<attempts) await sleep(attempt*1200)}
  }
  throw last;
}

function collection(body){
  if(Array.isArray(body)) return body;
  for(const key of ['snippets','data','items','results']) if(Array.isArray(body?.[key])) return body[key];
  return [];
}
function item(body){
  if(!body||typeof body!=='object'||Array.isArray(body)) return null;
  for(const key of ['snippet','data','item']) if(body[key]&&typeof body[key]==='object'&&!Array.isArray(body[key])) return body[key];
  return body;
}
function active(row){return [true,1,'1','true'].includes(row?.active)}

async function ensureSnippetApi(){
  for(let attempt=1;attempt<=8;attempt++){
    const probe=await request('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]},2).catch(()=>null);
    if(probe?.ok) return;
    await sleep(attempt*700);
  }
  throw new Error('Code Snippets REST API is unavailable.');
}
function buildCode(input){
  const code=String(input)
    .replace(/^\s*<\?php\s*/i,'')
    .replace(/if\s*\(\s*!defined\(\s*['"]ABSPATH['"]\s*\)\s*\)\s*\{\s*exit;\s*\}\s*/i,'')
    .trim();
  for(const token of ['DTF_Canonical_Static_Sitemap_Provider','wp_sitemaps_init','/courses/','/tools/','robots_txt']){
    if(!code.includes(token)) throw new Error('Canonical sitemap source missing token: '+token);
  }
  return "if (!function_exists('dtf_canonical_sitemap_static_routes')) {\n"+code+"\n}";
}
async function list(){return collection((await request('/wp-json/code-snippets/v1/snippets?per_page=100')).body)}
async function get(id){const r=await request('/wp-json/code-snippets/v1/snippets/'+id,{allow:[404]});return r.ok?item(r.body):null}
async function activate(id){return request('/wp-json/code-snippets/v1/snippets/'+id+'/activate',{method:'POST'})}
async function deactivate(id){return request('/wp-json/code-snippets/v1/snippets/'+id+'/deactivate',{method:'POST',allow:[400,404]})}
async function remove(id){return request('/wp-json/code-snippets/v1/snippets/'+id,{method:'DELETE',allow:[404]})}

async function verifyLive(){
  const robots=await request('/robots.txt',{allow:[404]},4);
  if(!robots.ok||!robots.text.includes('Sitemap: '+siteUrl+'/wp-sitemap.xml')) throw new Error('robots.txt does not advertise canonical native sitemap');

  const index=await request('/wp-sitemap.xml',{},4);
  if(!index.ok) throw new Error('wp-sitemap.xml unavailable');
  const child=[...index.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>m[1]).find(url=>url.includes('wp-sitemap-dtf-static-'));
  if(!child) throw new Error('native sitemap index is missing DTF static provider');
  const childPath=new URL(child).pathname;
  const staticMap=await request(childPath,{},4);
  for(const route of ['/courses/','/tools/']){
    if(!staticMap.text.includes('<loc>'+siteUrl+route+'</loc>')) throw new Error('DTF static sitemap missing '+route);
  }
  return {robots:robots.status,index:index.status,child:childPath};
}

await ensureSnippetApi();
const desiredCode=buildCode(source);
const desiredCodeSha256=crypto.createHash('sha256').update(desiredCode).digest('hex');
const rows=(await list()).filter(row=>String(row?.name||'')===snippetName);
const full=[];
for(const row of rows){const id=Number(row?.id||0);if(id){const value=await get(id);if(value)full.push(value)}}
const exact=full.find(row=>String(row?.code||'')===desiredCode);
if(exact){
  if(!active(exact)) await activate(Number(exact.id));
  for(const row of full){if(Number(row.id)!==Number(exact.id)){await deactivate(Number(row.id)).catch(()=>{});await remove(Number(row.id)).catch(()=>{})}}
  const verified=await verifyLive();
  console.log(JSON.stringify({ok:true,changed:false,snippetId:Number(exact.id),sourceSha256,desiredCodeSha256,verified}));
  process.exit(0);
}

const created=item((await request('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{
  name:snippetName,
  desc:'Source-controlled canonical sitemap extension for static DTF routes. Source SHA256: '+sourceSha256,
  code:desiredCode,tags:['dtf','sitemap','seo','source-controlled'],scope:'global',priority:1,active:false,network:false
}})).body);
const newId=Number(created?.id||0);
if(!newId) throw new Error('Canonical sitemap snippet created without ID.');
const previouslyActive=full.filter(active).map(row=>Number(row.id)).filter(Boolean);
try{
  for(const row of full) await deactivate(Number(row.id));
  await activate(newId);
  const current=await get(newId);
  if(!current||!active(current)||String(current.code||'')!==desiredCode) throw new Error('New sitemap snippet failed active-code verification.');
  const verified=await verifyLive();
  for(const row of full) await remove(Number(row.id)).catch(()=>{});
  console.log(JSON.stringify({ok:true,changed:true,snippetId:newId,sourceSha256,desiredCodeSha256,verified}));
}catch(error){
  await deactivate(newId).catch(()=>{});
  await remove(newId).catch(()=>{});
  for(const id of previouslyActive) await activate(id).catch(()=>{});
  throw error;
}
