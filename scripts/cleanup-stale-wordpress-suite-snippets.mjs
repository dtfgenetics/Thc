import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const prefix='DTF Public Suite Deploy V2 ';
const currentRunId=String(process.env.GITHUB_RUN_ID||'').trim();
if(!username||!password)throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function request(path,{method='GET',json,allow=[]}={}){
  let last;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{method,headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Stale-Suite-Bridge-Cleanup/1.2',...(json!==undefined?{'Content-Type':'application/json'}:{})},body:json!==undefined?JSON.stringify(json):undefined,redirect:'follow',signal:AbortSignal.timeout(45000)});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
      if((response.status>=500||response.status===429)&&attempt<5){await sleep(attempt*1800);continue}
      if(!response.ok&&!allow.includes(response.status))throw new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return{ok:response.ok,status:response.status,body};
    }catch(error){last=error;if(attempt<5)await sleep(attempt*1800)}
  }
  throw last||new Error(`${method} ${path} failed.`);
}
function collection(body){if(Array.isArray(body))return body;for(const k of ['snippets','data','items','results'])if(Array.isArray(body?.[k]))return body[k];return[]}
function item(body){if(body&&typeof body==='object'&&!Array.isArray(body)){for(const k of ['snippet','data','item'])if(body[k]&&typeof body[k]==='object'&&!Array.isArray(body[k]))return body[k];return body}return null}
async function list(safe=false){const q=safe?'snippets-safe-mode=1&':'';const r=await request(`/wp-json/code-snippets/v1/snippets?${q}per_page=100`,{allow:[400,403,404,500]});return{available:r.ok,safe,status:r.status,snippets:r.ok?collection(r.body):[]}}
async function removeSnippet(id,safe=false){const q=safe?'?snippets-safe-mode=1':'';await request(`/wp-json/code-snippets/v1/snippets/${id}/deactivate${q}`,{method:'POST',allow:[400,404,500]});await request(`/wp-json/code-snippets/v1/snippets/${id}${q}`,{method:'DELETE',allow:[404,500]});await request(`/wp-json/code-snippets/v1/snippets/${id}${q}`,{method:'DELETE',allow:[400,404,500]});}
function pluginEndpoint(pluginId){return `/wp-json/wp/v2/plugins/${String(pluginId).split('/').map(encodeURIComponent).join('/')}`;}
async function queryPlugin(){const r=await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100',{allow:[401,403,404]});if(!r.ok||!Array.isArray(r.body))return null;return r.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null;}
async function setPluginStatus(pluginId,status){return request(pluginEndpoint(pluginId),{method:'POST',json:{status}});}
async function waitForApi(){for(let attempt=1;attempt<=12;attempt++){const r=await request('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});if(r.ok)return true;await sleep(900+attempt*500)}return false;}

// The Code Snippets REST namespace disappears when the plugin is inactive. The
// previous cleanup treated that as an unsupported API and then tried POST on a
// route that could not exist. Resolve plugin state first, activate only when the
// already-installed plugin is inactive, clean exact DTF bridge names, then
// restore the original inactive state. We intentionally do not install a missing
// plugin here: that remains the transactional deployer's responsibility.
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

let mode='collection';let safe=false;let candidates=[];let markerId=null;let scannedIds=[];let listing={available:false,status:null,safe:false,snippets:[]};let removed=[];
try{
  listing=await list(false);if(!listing.available)listing=await list(true);
  if(listing.available){
    safe=listing.safe;
    candidates=listing.snippets.filter(s=>String(s?.name||'').startsWith(prefix)&&(!currentRunId||String(s?.name)!==`${prefix}${currentRunId}`));
  }else{
    // Some Code Snippets builds expose item/create routes without collection GET.
    // Create one inactive marker to learn the current numeric ID, inspect only a
    // bounded recent window, and select only exact DTF deployment-prefix names.
    mode='recent-id-scan';
    const marker=await request('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Suite Cleanup Marker ${currentRunId||Date.now()}`,desc:'Inactive temporary marker used only to discover recent Code Snippets IDs for stale DTF deployment cleanup.',code:'// DTF cleanup marker. Intentionally inactive.',tags:['dtf-deploy-cleanup','temporary'],scope:'global',priority:1,active:false,network:false}});
    markerId=Number(item(marker.body)?.id||0);if(!Number.isInteger(markerId)||markerId<=0)throw new Error('Cleanup marker was created without a numeric snippet ID.');
    try{
      const floor=Math.max(1,markerId-80);
      for(let id=markerId-1;id>=floor;id--){
        const r=await request(`/wp-json/code-snippets/v1/snippets/${id}`,{allow:[404]});
        scannedIds.push(id);if(!r.ok)continue;
        const s=item(r.body);if(!s)continue;
        const name=String(s.name||'');
        if(name.startsWith(prefix)&&(!currentRunId||name!==`${prefix}${currentRunId}`))candidates.push({...s,id:Number(s.id||id)});
      }
    }finally{
      await removeSnippet(markerId,false).catch(async()=>removeSnippet(markerId,true));
    }
  }

  const unique=[...new Map(candidates.map(s=>[Number(s?.id||0),s])).values()];
  removed=[];
  for(const s of unique){const id=Number(s?.id||0);const name=String(s?.name||'');if(!Number.isInteger(id)||id<=0||!name.startsWith(prefix))throw new Error(`Refusing unsafe stale-snippet candidate: ${JSON.stringify({id,name})}`);await removeSnippet(id,safe).catch(async()=>removeSnippet(id,true));removed.push({id,name});console.log(`Removed stale temporary Public Suite bridge snippet id=${id}.`)}
  if(removed.length)await sleep(1200);

  if(mode==='collection'){
    let after=await list(false);if(!after.available)after=await list(true);if(!after.available)throw new Error('Collection listing disappeared before cleanup verification.');const remaining=after.snippets.filter(s=>String(s?.name||'').startsWith(prefix));if(remaining.length)throw new Error(`Stale Public Suite bridge snippets remain: ${JSON.stringify(remaining.map(s=>({id:s?.id??null,name:s?.name??null})))}`);
  }else{
    for(const {id} of removed){const r=await request(`/wp-json/code-snippets/v1/snippets/${id}`,{allow:[404]});if(r.ok){const s=item(r.body);if(String(s?.name||'').startsWith(prefix))throw new Error(`Stale Public Suite bridge snippet ${id} still exists after cleanup.`)}}
  }
  console.log(JSON.stringify({ok:true,mode,pluginId,pluginWasActive,activatedForCleanup,collectionStatus:listing.status,markerId,scanned:scannedIds.length,candidates:[...new Set(candidates.map(s=>Number(s?.id||0)))].filter(Boolean).length,removed,remaining:0}));
}finally{
  if(activatedForCleanup){
    await setPluginStatus(pluginId,'inactive');
    console.log('Restored Code Snippets to its original inactive state after stale-bridge cleanup.');
  }
}
