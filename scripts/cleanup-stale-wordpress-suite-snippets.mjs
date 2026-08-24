import process from 'node:process';
import crypto from 'node:crypto';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const prefix='DTF Public Suite Deploy V2 ';
const currentRunId=String(process.env.GITHUB_RUN_ID||'').trim();
if(!username||!password)throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function request(path,{method='GET',json,allow=[],retryServer=true,headers={}}={}){
  let last;
  const attempts=retryServer?8:1;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{method,headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Stale-Suite-Bridge-Cleanup/1.7',...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:json!==undefined?JSON.stringify(json):undefined,redirect:'follow',signal:AbortSignal.timeout(45000)});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
      if(retryServer&&(response.status>=500||response.status===429)&&attempt<attempts){
        const delay=Math.min(15000,2000*attempt+Math.floor(Math.random()*750));
        console.warn(`Cleanup request ${method} ${path} returned HTTP ${response.status}; retrying ${attempt}/${attempts} after ${delay}ms.`);
        await sleep(delay);continue;
      }
      if(!response.ok&&!allow.includes(response.status))throw new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return{ok:response.ok,status:response.status,body};
    }catch(error){
      last=error;
      if(attempt<attempts){
        const delay=Math.min(15000,2000*attempt+Math.floor(Math.random()*750));
        console.warn(`Cleanup request ${method} ${path} transport failure on attempt ${attempt}/${attempts}: ${error?.cause?.code||error?.code||error?.message||'unknown'}; retrying after ${delay}ms.`);
        await sleep(delay);
      }
    }
  }
  throw last||new Error(`${method} ${path} failed.`);
}
function collection(body){if(Array.isArray(body))return body;for(const k of ['snippets','data','items','results'])if(Array.isArray(body?.[k]))return body[k];return[]}
function item(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
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
  }
  if(isActive(s))throw new Error(`Snippet ${id} remained executable after deactivation.`);
  return{state:isTrashed(s)?'trashed-inactive':'inactive'};
}
function pluginEndpoint(pluginId){return `/wp-json/wp/v2/plugins/${String(pluginId).split('/').map(encodeURIComponent).join('/')}`;}
async function queryPlugin(){const r=await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100',{allow:[401,403,404]});if(!r.ok||!Array.isArray(r.body))return null;return r.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null;}
async function setPluginStatus(pluginId,status){return request(pluginEndpoint(pluginId),{method:'POST',json:{status}});}
async function waitForApi(){for(let attempt=1;attempt<=12;attempt++){const r=await request('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});if(r.ok)return true;await sleep(900+attempt*350)}return false;}

async function findTrustedRecoveryBridge(candidates){
  const ordered=[...candidates].sort((a,b)=>Number(b?.id||0)-Number(a?.id||0));
  for(const candidate of ordered){
    const id=Number(candidate?.id||0);if(!Number.isInteger(id)||id<=0)continue;
    let snippet=await getSnippet(id,false).catch(()=>null);if(!snippet)snippet=await getSnippet(id,true).catch(()=>null);if(!snippet)continue;
    const name=String(snippet?.name||'');const code=String(snippet?.code||'');
    if(!name.startsWith(prefix))continue;
    const required=['dtf-suite/v2','dtf_suite_deploy_lock','dtf_stale_touched_lock','dtf_rollback_current',"'/abort'","'/finalize'"];
    if(required.some(marker=>!code.includes(marker)))continue;
    const tokenMatch=code.match(/\$token\s*=\s*["']([a-f0-9]{64})["']\s*;/i);
    if(!tokenMatch)continue;
    return{id,name,token:tokenMatch[1]};
  }
  return null;
}
async function suiteRequest(token,path,{method='GET',json,allow=[]}={}){
  return request(`/wp-json/dtf-suite/v2${path}`,{method,json,allow,headers:{'X-DTF-Suite-Token':token}});
}
async function waitForRecoveryBridge(token,probeId){
  for(let attempt=1;attempt<=12;attempt++){
    const r=await suiteRequest(token,`/state/${probeId}`,{allow:[404]}).catch(()=>null);
    if(r?.ok)return true;
    await sleep(700+attempt*350);
  }
  return false;
}
async function readTransactionState(token,id){
  const r=await suiteRequest(token,`/state/${id}`,{allow:[404]});
  return r.ok&&r.body&&typeof r.body==='object'?r.body:null;
}
async function clearTransaction(token,id,state){
  if(!/^[a-f0-9]{24}$/.test(id))throw new Error(`Refusing invalid stale transaction id: ${id}`);
  if(!state||!state.status)throw new Error(`Stale transaction ${id} has no recoverable state.`);
  let r;
  if(['deployed','rolled_back'].includes(String(state.status))){
    r=await suiteRequest(token,'/finalize',{method:'POST',json:{deployment_id:id}});
  }else{
    // Abort is intentionally transaction-aware: when production targets were
    // touched it invokes the bridge's persisted rollback routine first, then
    // removes the old workspace and lock. Untouched uploads are simply cleaned.
    r=await suiteRequest(token,'/abort',{method:'POST',json:{deployment_id:id}});
  }
  if(r.body?.ok!==true)throw new Error(`Recovery for transaction ${id} was not confirmed: ${JSON.stringify(r.body).slice(0,500)}`);
  const after=await readTransactionState(token,id);
  if(after&&after.status)throw new Error(`Transaction ${id} still has persisted state after recovery: ${after.status}`);
  return String(r.body?.status||'cleaned');
}
async function recoverStaleTransactionIfPresent(candidates){
  const bridge=await findTrustedRecoveryBridge(candidates);
  if(!bridge)return{checked:false,recovered:null,reason:'no-trusted-recovery-bridge'};
  const probeId=crypto.randomBytes(12).toString('hex');
  const activate=await request(`/wp-json/code-snippets/v1/snippets/${bridge.id}/activate`,{method:'POST',allow:[400]});
  if(!activate.ok&&activate.status!==400)throw new Error(`Could not activate trusted recovery bridge ${bridge.id}.`);
  try{
    if(!(await waitForRecoveryBridge(bridge.token,probeId)))throw new Error(`Trusted recovery bridge ${bridge.id} did not expose its protected REST routes.`);
    let init=await suiteRequest(bridge.token,'/init',{method:'POST',allow:[409],json:{deployment_id:probeId,archive_bytes:1,archive_sha256:'0'.repeat(64)}});
    let recovered=null;
    if(!init.ok){
      const code=String(init.body?.code||'');
      const staleId=String(init.body?.data?.deployment_id||'');
      if(init.status!==409||code!=='dtf_stale_touched_lock'||!/^[a-f0-9]{24}$/.test(staleId)){
        throw new Error(`Deployment lock is not safely recoverable: HTTP ${init.status} ${code||'unknown'}.`);
      }
      const state=await readTransactionState(bridge.token,staleId);
      const recoveredStatus=await clearTransaction(bridge.token,staleId,state);
      recovered={deploymentId:staleId,priorStatus:String(state?.status||''),recoveryStatus:recoveredStatus};
      console.log(`Recovered stale Public Suite transaction ${staleId} from status=${state?.status||'unknown'} via ${recoveredStatus}.`);
      init=await suiteRequest(bridge.token,'/init',{method:'POST',json:{deployment_id:probeId,archive_bytes:1,archive_sha256:'0'.repeat(64)}});
    }
    if(init.body?.ok!==true)throw new Error(`Post-recovery lock probe did not acquire a clean transaction: ${JSON.stringify(init.body).slice(0,500)}`);
    const aborted=await suiteRequest(bridge.token,'/abort',{method:'POST',json:{deployment_id:probeId}});
    if(aborted.body?.ok!==true)throw new Error('Could not remove the clean lock-probe transaction.');
    const probeAfter=await readTransactionState(bridge.token,probeId);
    if(probeAfter&&probeAfter.status)throw new Error('Lock-probe transaction still has persisted state after abort.');
    return{checked:true,recovered,bridgeId:bridge.id,probeCleaned:true};
  }finally{
    const result=await neutralizeSnippet(bridge.id,false).catch(async()=>neutralizeSnippet(bridge.id,true));
    if(result.state!=='absent'&&result.state!=='inactive'&&result.state!=='trashed-inactive')throw new Error(`Trusted recovery bridge ${bridge.id} was not neutralized after recovery.`);
  }
}

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

let mode='collection';let safe=false;let candidates=[];let markerId=null;let scannedIds=[];let listing={available:false,status:null,safe:false,snippets:[]};let neutralized=[];let transactionRecovery={checked:false,recovered:null};
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
    const executable=stale.filter(isActive);
    if(executable.length)throw new Error(`Executable Public Suite bridge snippets remain: ${JSON.stringify(executable.map(s=>({id:s?.id??null,name:s?.name??null,active:s?.active??null,status:s?.status??null})))}`);
  }else{
    for(const {id} of neutralized){const s=await getSnippet(id,false);if(s&&isActive(s))throw new Error(`Public Suite bridge snippet ${id} remains executable after cleanup.`);}
  }

  transactionRecovery=await recoverStaleTransactionIfPresent(unique);
  console.log(JSON.stringify({ok:true,mode,pluginId,pluginWasActive,activatedForCleanup,collectionStatus:listing.status,markerId,scanned:scannedIds.length,candidates:neutralized.length,neutralized,remainingExecutable:0,transactionRecovery}));
}finally{
  if(activatedForCleanup){await setPluginStatus(pluginId,'inactive');console.log('Restored Code Snippets to its original inactive state after stale-bridge cleanup.');}
}
