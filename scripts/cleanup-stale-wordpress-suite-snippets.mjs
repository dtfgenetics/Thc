import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const prefix='DTF Public Suite Deploy V2 ';
const currentRunId=String(process.env.GITHUB_RUN_ID||'').trim();
if(!username||!password)throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function request(path,{method='GET',json,allow=[],retryServer=true}={}){
  let last;
  const attempts=retryServer?5:1;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{method,headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Stale-Suite-Bridge-Cleanup/1.4',...(json!==undefined?{'Content-Type':'application/json'}:{})},body:json!==undefined?JSON.stringify(json):undefined,redirect:'follow',signal:AbortSignal.timeout(45000)});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
      if(retryServer&&(response.status>=500||response.status===429)&&attempt<attempts){await sleep(attempt*1200);continue}
      if(!response.ok&&!allow.includes(response.status))throw new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return{ok:response.ok,status:response.status,body};
    }catch(error){last=error;if(attempt<attempts)await sleep(attempt*1200)}
  }
  throw last||new Error(`${method} ${path} failed.`);
}
function collection(body){if(Array.isArray(body))return body;for(const k of ['snippets','data','items','results'])if(Array.isArray(body?.[k]))return body[k];return[]}
function item(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  // Code Snippets item responses can include a top-level snippet plus a nested
  // `data` object containing REST metadata. Prefer the top-level object whenever
  // it already carries snippet identity/state so `active` and `trashed` are not
  // accidentally discarded in favor of HTTP metadata.
  if(['id','name','active','trashed','status','code','scope'].some(k=>Object.prototype.hasOwnProperty.call(body,k)))return body;
  for(const k of ['snippet','data','item']){
    const nested=body[k];
    if(nested&&typeof nested==='object'&&!Array.isArray(nested))return nested;
  }
  return body;
}
function isActive(s){return s?.active===true||s?.active===1||s?.active==='1'||s?.active==='true'}
function isTrashed(s){return s?.trashed===true||s?.trashed===1||s?.trashed==='1'||s?.trashed==='true'||String(s?.status||'').toLowerCase()==='trash'||String(s?.status||'').toLowerCase()==='trashed'}
async function list(safe=false){const q=safe?'snippets-safe-mode=1&':'';const r=await request(`/wp-json/code-snippets/v1/snippets?${q}per_page=100`,{allow:[400,403,404,500]});return{available:r.ok,safe,status:r.status,snippets:r.ok?collection(r.body):[]}}
async function getSnippet(id,safe=false){const q=safe?'?snippets-safe-mode=1':'';const r=await request(`/wp-json/code-snippets/v1/snippets/${id}${q}`,{allow:[404]});return r.ok?item(r.body):null;}
async function neutralizeSnippet(id,safe=false){
  const q=safe?'?snippets-safe-mode=1':'';
  let s=await getSnippet(id,safe);if(!s)return{state:'absent'};
  if(isActive(s)){
    await request(`/wp-json/code-snippets/v1/snippets/${id}/deactivate${q}`,{method:'POST',allow:[404]});
    s=await getSnippet(id,safe);if(!s)return{state:'absent'};
    if(isActive(s))throw new Error(`Snippet ${id} remained active after deactivation.`);
  }
  if(!isTrashed(s)){
    // Code Snippets 3.9+ DELETE is intentionally a two-stage operation: the
    // first DELETE moves the row to Trash and only a later DELETE permanently
    // removes an already-trashed row. A trashed + inactive deployment bridge is
    // non-executable and is the safety condition we require before publication.
    await request(`/wp-json/code-snippets/v1/snippets/${id}${q}`,{method:'DELETE',allow:[404],retryServer:false});
    await sleep(120);
    s=await getSnippet(id,safe);if(!s)return{state:'absent'};
  }
  // Older multisite builds had a trash/activation edge case. Re-check after the
  // trash transition and force deactivation if necessary before accepting it.
  if(isActive(s)){
    await request(`/wp-json/code-snippets/v1/snippets/${id}/deactivate${q}`,{method:'POST',allow:[404]});
    s=await getSnippet(id,safe);if(!s)return{state:'absent'};
  }
  if(isActive(s)||!isTrashed(s))throw new Error(`Snippet ${id} is not safely neutralized: ${JSON.stringify({active:s?.active??null,trashed:s?.trashed??null,status:s?.status??null})}`);
  return{state:'trashed-inactive'};
}
function pluginEndpoint(pluginId){return `/wp-json/wp/v2/plugins/${String(pluginId).split('/').map(encodeURIComponent).join('/')}`;}
async function queryPlugin(){const r=await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100',{allow:[401,403,404]});if(!r.ok||!Array.isArray(r.body))return null;return r.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null;}
async function setPluginStatus(pluginId,status){return request(pluginEndpoint(pluginId),{method:'POST',json:{status}});}
async function waitForApi(){for(let attempt=1;attempt<=12;attempt++){const r=await request('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});if(r.ok)return true;await sleep(900+attempt*350)}return false;}

const plugin=await queryPlugin();
if(!plugin)throw new Error('Code Snippets is not installed; refusing to infer stale-snippet state before production publication.');
const pluginId=String(plugin.plugin||'');
const pluginWasActive=plugin.status==='active';
let activatedForCleanup=false;
if(!pluginWasActive){
  await setPluginStatus(pluginId,'active');
  activatedForCleanup=true;
  if(!(await waitForApi()))throw new Error('Code Snippets was activated for cleanup but its REST API did not become available.');
}

let mode='collection';let safe=false;let candidates=[];let markerId=null;let scannedIds=[];let listing={available:false,status:null,safe:false,snippets:[]};let neutralized=[];
try{
  listing=await list(false);if(!listing.available)listing=await list(true);
  if(listing.available){
    safe=listing.safe;
    candidates=listing.snippets.filter(s=>String(s?.name||'').startsWith(prefix)&&(!currentRunId||String(s?.name)!==`${prefix}${currentRunId}`));
  }else{
    mode='recent-id-scan';
    const marker=await request('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Suite Cleanup Marker ${currentRunId||Date.now()}`,desc:'Inactive temporary marker used only to discover recent Code Snippets IDs for stale DTF deployment cleanup.',code:'// DTF cleanup marker. Intentionally inactive.',tags:['dtf-deploy-cleanup','temporary'],scope:'global',priority:1,active:false,network:false}});
    markerId=Number(item(marker.body)?.id||0);if(!Number.isInteger(markerId)||markerId<=0)throw new Error('Cleanup marker was created without a numeric snippet ID.');
    try{
      const floor=Math.max(1,markerId-80);
      for(let id=markerId-1;id>=floor;id--){const s=await getSnippet(id,false);scannedIds.push(id);if(!s)continue;const name=String(s.name||'');if(name.startsWith(prefix)&&(!currentRunId||name!==`${prefix}${currentRunId}`))candidates.push({...s,id:Number(s.id||id)});}
    }finally{await neutralizeSnippet(markerId,false).catch(async()=>neutralizeSnippet(markerId,true));}
  }

  const unique=[...new Map(candidates.map(s=>[Number(s?.id||0),s])).values()];
  for(const s of unique){
    const id=Number(s?.id||0),name=String(s?.name||'');
    if(!Number.isInteger(id)||id<=0||!name.startsWith(prefix))throw new Error(`Refusing unsafe stale-snippet candidate: ${JSON.stringify({id,name})}`);
    const result=await neutralizeSnippet(id,safe).catch(async()=>neutralizeSnippet(id,true));
    neutralized.push({id,name,state:result.state});
    console.log(`Neutralized stale temporary Public Suite bridge snippet id=${id} state=${result.state}.`);
  }

  if(mode==='collection'){
    let after=await list(false);if(!after.available)after=await list(true);if(!after.available)throw new Error('Collection listing disappeared before cleanup verification.');
    const stale=after.snippets.filter(s=>String(s?.name||'').startsWith(prefix)&&(!currentRunId||String(s?.name)!==`${prefix}${currentRunId}`));
    const unsafe=stale.filter(s=>isActive(s)||!isTrashed(s));
    if(unsafe.length)throw new Error(`Executable or untrashed Public Suite bridge snippets remain: ${JSON.stringify(unsafe.map(s=>({id:s?.id??null,name:s?.name??null,active:s?.active??null,trashed:s?.trashed??null,status:s?.status??null})))}`);
  }else{
    for(const {id} of neutralized){const s=await getSnippet(id,false);if(s&&(isActive(s)||!isTrashed(s)))throw new Error(`Public Suite bridge snippet ${id} is not safely neutralized after cleanup.`);}
  }
  console.log(JSON.stringify({ok:true,mode,pluginId,pluginWasActive,activatedForCleanup,collectionStatus:listing.status,markerId,scanned:scannedIds.length,candidates:neutralized.length,neutralized,remainingExecutable:0}));
}finally{
  if(activatedForCleanup){await setPluginStatus(pluginId,'inactive');console.log('Restored Code Snippets to its original inactive state after stale-bridge cleanup.');}
}
