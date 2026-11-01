import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME;
const password=process.env.WP_API_PASSWORD;
if(!username||!password) throw new Error('Protected WordPress credentials are required.');
const source=await readFile('site/wordpress/mu-plugins/dtf-seed-sales-hold.php','utf8');
if(!source.includes('woocommerce_is_purchasable')||!source.includes('woocommerce_store_api_checkout_update_order_from_request')) throw new Error('Transaction guard hooks missing.');
const code=source.replace(/^<\?php\s*/,'').replace(/\?>\s*$/,'').trim();
const sha=createHash('sha256').update(code).digest('hex');
const name='DTF Seed Sales Hold — source controlled';
const auth='Basic '+Buffer.from(username+':'+password).toString('base64');
async function api(path,method='GET',data){
  const res=await fetch(site+path,{method,headers:{Authorization:auth,Accept:'application/json',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(45000)});
  const text=await res.text();let json;try{json=JSON.parse(text)}catch{json=text}
  if(!res.ok)throw new Error(method+' '+path+' HTTP '+res.status+': '+String(typeof json==='string'?json:JSON.stringify(json)).slice(0,350));
  return json;
}
function records(data){return Array.isArray(data)?data:Array.isArray(data?.snippets)?data.snippets:Array.isArray(data?.data)?data.data:[]}
function item(data){return data?.snippet||data?.data||data}
function active(x){return x?.active===true||x?.active===1||x?.active==='1'||x?.active==='true'}
const list=records(await api('/wp-json/code-snippets/v1/snippets?per_page=100'));
const matched=list.filter(x=>x?.name===name);
async function detail(id){return item(await api('/wp-json/code-snippets/v1/snippets/'+id))}
const old=[];
for(const row of matched){if(Number(row.id)>0)old.push(await detail(Number(row.id)))}
const exact=old.find(x=>x?.code===code);
if(exact){
  if(!active(exact)) await api('/wp-json/code-snippets/v1/snippets/'+exact.id+'/activate','POST');
  const now=await detail(exact.id);
  if(!active(now)||now.code!==code)throw new Error('Existing hold snippet failed activation verification');
  console.log(JSON.stringify({ok:true,active:true,changed:false,snippetId:exact.id,sourceSha256:sha}));
  process.exit(0);
}
const created=item(await api('/wp-json/code-snippets/v1/snippets','POST',{name,desc:'Fail-closed seed sales suspension. SHA256 '+sha,code,tags:['dtf','seed-sales-hold'],scope:'global',priority:1,active:false,network:false}));
const id=Number(created?.id||0);if(!id)throw new Error('Snippet created without ID.');
try{
  await api('/wp-json/code-snippets/v1/snippets/'+id+'/activate','POST');
  const now=await detail(id);
  if(!active(now)||now.code!==code)throw new Error('New hold snippet activation failed verification');
  // Only deactivate old copies AFTER the new guard is confirmed active.
  for(const row of old){await api('/wp-json/code-snippets/v1/snippets/'+row.id+'/deactivate','POST')}
  console.log(JSON.stringify({ok:true,active:true,changed:true,snippetId:id,sourceSha256:sha,priorCopiesDeactivated:old.length}));
}catch(error){
  // Keep any existing hold active; do not disable working protection on failure.
  throw error;
}
