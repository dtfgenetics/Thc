import process from 'node:process';
import crypto from 'node:crypto';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const prefix='DTF Public Suite Deploy V2 ';
const currentRunId=String(process.env.GITHUB_RUN_ID||'').trim();
const repository=String(process.env.GITHUB_REPOSITORY||'').trim();
const ghToken=String(process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'').trim();
if(!username||!password)throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function request(path,{method='GET',json,allow=[],retryServer=true,headers={}}={}){
  let last;
  const attempts=retryServer?8:1;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{method,headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Stale-Suite-Bridge-Cleanup/1.9',...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:json!==undefined?JSON.stringify(json):undefined,redirect:'follow',signal:AbortSignal.timeout(45000)});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
      if(retryServer&&!allow.includes(response.status)&&(response.status>=500||response.status===429)&&attempt<attempts){
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
async function discardSnippetBestEffort(id){
  await neutralizeSnippet(id,false).catch(async()=>neutralizeSnippet(id,true));
  for(const safe of [false,true]){
    const q=safe?'?snippets-safe-mode=1':'';
    try{await request(`/wp-json/code-snippets/v1/snippets/${id}${q}`,{method:'DELETE',allow:[400,404,500]});}catch{}
    try{await request(`/wp-json/code-snippets/v1/snippets/${id}${q}`,{method:'DELETE',allow:[400,404,500]});}catch{}
  }
}
function pluginEndpoint(pluginId){return `/wp-json/wp/v2/plugins/${String(pluginId).split('/').map(encodeURIComponent).join('/')}`;}
async function queryPlugin(){const r=await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100',{allow:[401,403,404]});if(!r.ok||!Array.isArray(r.body))return null;return r.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null;}
async function setPluginStatus(pluginId,status){return request(pluginEndpoint(pluginId),{method:'POST',json:{status}});}
async function waitForApi(){for(let attempt=1;attempt<=12;attempt++){const r=await request('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});if(r.ok)return true;await sleep(900+attempt*350)}return false;}

async function assertNoOtherActivePublisher(){
  if(!currentRunId||!repository||!ghToken)throw new Error('Recent lock recovery requires GITHUB_RUN_ID, GITHUB_REPOSITORY, and GH_TOKEN.');
  const response=await fetch(`https://api.github.com/repos/${repository}/actions/runs?status=in_progress&per_page=100`,{
    headers:{Authorization:`Bearer ${ghToken}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'DTFSeeds-Public-Suite-Lock-Recovery/1.0'},
    signal:AbortSignal.timeout(30000)
  });
  const text=await response.text();let body=null;try{body=JSON.parse(text)}catch{}
  if(!response.ok||!body||!Array.isArray(body.workflow_runs))throw new Error(`Could not verify active Public Suite publishers through GitHub (${response.status}): ${text.slice(0,400)}`);
  const others=body.workflow_runs.filter(run=>String(run?.id)!==currentRunId&&String(run?.path||'')==='.github/workflows/deploy-public-suite-wordpress-v2.yml');
  if(others.length)throw new Error(`Refusing recent lock recovery while another Public Suite publisher is active: ${JSON.stringify(others.map(run=>({id:run.id,status:run.status,created_at:run.created_at,head_sha:run.head_sha})))}`);
  return true;
}

async function inspectCurrentLock(){
  const token=crypto.randomBytes(32).toString('hex');
  const suffix=crypto.randomBytes(6).toString('hex');
  const namespace=`dtf-suite-lock-inspector-${suffix}/v1`;
  const tokenLiteral=JSON.stringify(token);
  const namespaceLiteral=JSON.stringify(namespace);
  const code=String.raw`add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $namespace = ${namespaceLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-recovery-token');
        if ($supplied === '') $supplied = (string) $request->get_param('_dtf_recovery_token');
        return $supplied !== '' && hash_equals($token, $supplied);
    };
    register_rest_route($namespace, '/status', [
        'methods' => 'GET',
        'permission_callback' => $permission,
        'callback' => static function () {
            $lock = get_option('dtf_suite_deploy_lock', []);
            $id = is_array($lock) ? (string) ($lock['id'] ?? '') : '';
            $ts = is_array($lock) ? (int) ($lock['ts'] ?? 0) : 0;
            $state = preg_match('/^[a-f0-9]{24}$/', $id) ? get_option('dtf_suite_state_' . $id, []) : [];
            return rest_ensure_response([
                'ok' => true,
                'lock' => [
                    'id' => $id,
                    'ts' => $ts,
                    'age_seconds' => $ts > 0 ? max(0, time() - $ts) : null,
                ],
                'state' => is_array($state) ? [
                    'id' => (string) ($state['id'] ?? ''),
                    'status' => (string) ($state['status'] ?? ''),
                    'current_present' => !empty($state['current']),
                    'applied_count' => is_array($state['applied'] ?? null) ? count($state['applied']) : 0,
                    'uploaded_bytes' => (int) ($state['uploaded_bytes'] ?? 0),
                    'archive_bytes' => (int) ($state['archive_bytes'] ?? 0),
                    'started_at' => (string) ($state['started_at'] ?? ''),
                ] : [],
            ]);
        },
    ]);
});`;
  const created=await request('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Suite Lock Inspector ${currentRunId||suffix}`,desc:'Temporary read-only inspector for safely identifying an orphaned DTF Public Suite transaction lock.',code,tags:['dtf-deploy-cleanup','temporary','read-only'],scope:'global',priority:1,active:false,network:false}});
  const id=Number(item(created.body)?.id||0);
  if(!Number.isInteger(id)||id<=0)throw new Error('Lock inspector was created without a numeric snippet ID.');
  try{
    const activated=await request(`/wp-json/code-snippets/v1/snippets/${id}/activate`,{method:'POST',allow:[400]});
    if(!activated.ok&&activated.status!==400)throw new Error(`Could not activate lock inspector snippet ${id}.`);
    const path=`/wp-json/${namespace}/status?_dtf_recovery_token=${encodeURIComponent(token)}`;
    for(let attempt=1;attempt<=15;attempt++){
      const r=await request(path,{allow:[404],headers:{'X-DTF-Recovery-Token':token}}).catch(()=>null);
      if(r?.ok&&r.body?.ok===true)return{...r.body,inspectorId:id};
      await sleep(700+attempt*300);
    }
    throw new Error(`Lock inspector ${id} did not expose its protected read-only status route.`);
  }finally{
    await discardSnippetBestEffort(id);
  }
}

let activeSuiteNamespace='dtf-suite/v2';
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
    const namespaceMatch=code.match(/dtf-suite\/v2-[a-f0-9]{24}/i);
    activeSuiteNamespace=namespaceMatch?.[0]||'dtf-suite/v2';
    console.log(`Using trusted recovery bridge namespace ${activeSuiteNamespace} from snippet ${id}.`);
    return{id,name,token:tokenMatch[1],namespace:activeSuiteNamespace};
  }
  return null;
}
async function suiteRequest(token,path,{method='GET',json,allow=[]}={}){
  return request(`/wp-json/${activeSuiteNamespace}${path}`,{method,json,allow,headers:{'X-DTF-Suite-Token':token}});
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
    if(!(await waitForRecoveryBridge(bridge.token,probeId)))throw new Error(`Trusted recovery bridge ${bridge.id} did not expose its protected REST routes at ${activeSuiteNamespace}.`);
    let init=await suiteRequest(bridge.token,'/init',{method:'POST',allow:[409],json:{deployment_id:probeId,archive_bytes:1,archive_sha256:'0'.repeat(64)}});
    let recovered=null;
    if(!init.ok){
      const code=String(init.body?.code||'');
      let staleId=String(init.body?.data?.deployment_id||'');
      let inspected=null;
      if(init.status===409&&code==='dtf_locked'&&!/^[a-f0-9]{24}$/.test(staleId)){
        await assertNoOtherActivePublisher();
        inspected=await inspectCurrentLock();
        staleId=String(inspected?.lock?.id||'');
        const age=Number(inspected?.lock?.age_seconds);
        if(!/^[a-f0-9]{24}$/.test(staleId))throw new Error(`Read-only lock inspector returned an invalid deployment ID: ${staleId||'(missing)'}.`);
        if(!Number.isFinite(age)||age<120)throw new Error(`Refusing to recover a lock only ${Number.isFinite(age)?age:'unknown'} seconds old.`);
        if(!inspected?.state?.status)throw new Error(`Lock ${staleId} has no persisted transaction state; refusing destructive inference.`);
        if(inspected.state.id&&String(inspected.state.id)!==staleId)throw new Error(`Lock/state ID mismatch: lock=${staleId} state=${inspected.state.id}.`);
        console.log(`Identified serialized orphan lock ${staleId}: age=${age}s status=${inspected.state.status} current=${Boolean(inspected.state.current_present)} applied=${Number(inspected.state.applied_count||0)} uploaded=${Number(inspected.state.uploaded_bytes||0)}/${Number(inspected.state.archive_bytes||0)}.`);
      }
      if(init.status!==409||!['dtf_stale_touched_lock','dtf_locked'].includes(code)||!/^[a-f0-9]{24}$/.test(staleId)){
        throw new Error(`Deployment lock is not safely recoverable: HTTP ${init.status} ${code||'unknown'}.`);
      }
      if(code==='dtf_locked')await assertNoOtherActivePublisher();
      const state=await readTransactionState(bridge.token,staleId);
      if(!state||!state.status)throw new Error(`Transaction ${staleId} could not be read through the trusted rollback bridge ${activeSuiteNamespace}.`);
      const recoveredStatus=await clearTransaction(bridge.token,staleId,state);
      recovered={deploymentId:staleId,priorStatus:String(state?.status||''),recoveryStatus:recoveredStatus,legacyLockInspected:Boolean(inspected)};
      console.log(`Recovered stale Public Suite transaction ${staleId} from status=${state?.status||'unknown'} via ${recoveredStatus}.`);
      init=await suiteRequest(bridge.token,'/init',{method:'POST',json:{deployment_id:probeId,archive_bytes:1,archive_sha256:'0'.repeat(64)}});
    }
    if(init.body?.ok!==true)throw new Error(`Post-recovery lock probe did not acquire a clean transaction: ${JSON.stringify(init.body).slice(0,500)}`);
    const aborted=await suiteRequest(bridge.token,'/abort',{method:'POST',json:{deployment_id:probeId}});
    if(aborted.body?.ok!==true)throw new Error('Could not remove the clean lock-probe transaction.');
    const probeAfter=await readTransactionState(bridge.token,probeId);
    if(probeAfter&&probeAfter.status)throw new Error('Lock-probe transaction still has persisted state after abort.');
    return{checked:true,recovered,bridgeId:bridge.id,bridgeNamespace:activeSuiteNamespace,probeCleaned:true};
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
