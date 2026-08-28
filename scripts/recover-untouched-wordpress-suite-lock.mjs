import crypto from 'node:crypto';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password)throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token=crypto.randomBytes(32).toString('hex');
const tokenLiteral=JSON.stringify(token);
const runId=String(process.env.GITHUB_RUN_ID||Date.now());
const snippetName=`DTF Untouched Suite Lock Recovery ${runId}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(path,{method='GET',json,allow=[],headers={}}={}){
  const response=await fetch(`${siteUrl}${path}`,{
    method,
    headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Untouched-Lock-Recovery/1.0',...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},
    body:json!==undefined?JSON.stringify(json):undefined,
    redirect:'follow',
    signal:AbortSignal.timeout(45000),
  });
  const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
  if(!response.ok&&!allow.includes(response.status))throw new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,800):JSON.stringify(body).slice(0,800)}`);
  return{ok:response.ok,status:response.status,body};
}

function pluginEndpoint(pluginId){return `/wp-json/wp/v2/plugins/${String(pluginId).split('/').map(encodeURIComponent).join('/')}`;}
async function queryPlugin(){const r=await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100',{allow:[401,403,404]});if(!r.ok||!Array.isArray(r.body))return null;return r.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null;}
async function setPluginStatus(pluginId,status){return request(pluginEndpoint(pluginId),{method:'POST',json:{status}});}
async function waitForSnippetApi(){for(let attempt=1;attempt<=12;attempt++){const r=await request('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});if(r.ok)return true;await sleep(700+attempt*350)}return false;}
async function waitForRecoveryRoute(){for(let attempt=1;attempt<=12;attempt++){const r=await request('/wp-json/dtf-suite-lock-recovery/v1/inspect',{headers:{'X-DTF-Lock-Recovery-Token':token},allow:[404]});if(r.ok)return r;await sleep(650+attempt*300)}return null;}

const snippetCode=String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-lock-recovery-token');
        return get_current_user_id() > 0 && $supplied !== '' && hash_equals($token, $supplied);
    };
    $lock_key = 'dtf_suite_deploy_lock';
    $state_key = static fn($id) => 'dtf_suite_state_' . $id;
    $work_root = wp_normalize_path(ABSPATH . '.dtf-suite-work');
    $remove_tree = null;
    $remove_tree = static function ($path) use (&$remove_tree) {
        if (!file_exists($path) && !is_link($path)) return true;
        if (is_link($path) || is_file($path)) return @unlink($path);
        if (!is_dir($path)) return false;
        $items = scandir($path); if ($items === false) return false;
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            if (!$remove_tree($path . DIRECTORY_SEPARATOR . $item)) return false;
        }
        return @rmdir($path);
    };
    $inspect = static function () use ($lock_key, $state_key) {
        $lock = get_option($lock_key, []);
        if (!is_array($lock) || empty($lock['id'])) return ['ok'=>true,'locked'=>false];
        $id = (string) ($lock['id'] ?? '');
        $age = max(0, time() - (int) ($lock['ts'] ?? time()));
        if (!preg_match('/^[a-f0-9]{24}$/', $id)) return new WP_Error('dtf_recovery_bad_lock', 'Deployment lock ID is invalid; refusing recovery.', ['status'=>409]);
        $state = get_option($state_key($id), []);
        if (!is_array($state) || empty($state)) return new WP_Error('dtf_recovery_missing_state', 'Deployment lock has no state record; refusing recovery.', ['status'=>409,'deployment_id'=>$id,'age'=>$age]);
        $current = $state['current'] ?? null;
        $applied = is_array($state['applied'] ?? null) ? $state['applied'] : [];
        $status = (string) ($state['status'] ?? '');
        $untouched = empty($current) && count($applied) === 0 && in_array($status, ['uploading','staged'], true);
        return ['ok'=>true,'locked'=>true,'deployment_id'=>$id,'age'=>$age,'status'=>$status,'untouched'=>$untouched,'applied_count'=>count($applied),'has_current'=>!empty($current)];
    };

    register_rest_route('dtf-suite-lock-recovery/v1', '/inspect', [
        'methods'=>'GET','permission_callback'=>$permission,
        'callback'=>static function () use ($inspect) { $result=$inspect(); return is_wp_error($result)?$result:rest_ensure_response($result); },
    ]);

    register_rest_route('dtf-suite-lock-recovery/v1', '/recover', [
        'methods'=>'POST','permission_callback'=>$permission,
        'callback'=>static function () use ($inspect,$lock_key,$state_key,$work_root,$remove_tree) {
            $info=$inspect(); if (is_wp_error($info)) return $info;
            if (empty($info['locked'])) return rest_ensure_response(['ok'=>true,'recovered'=>false,'status'=>'no-lock']);
            if (empty($info['untouched'])) return new WP_Error('dtf_recovery_touched', 'Deployment has mutation state or a non-recoverable status; refusing automatic recovery.', ['status'=>409]+$info);
            $id=(string)$info['deployment_id'];
            $state=get_option($state_key($id), []);
            $work=wp_normalize_path((string)($state['work_dir'] ?? ''));
            $expected=wp_normalize_path(trailingslashit($work_root) . $id);
            if ($work === '' || $work !== $expected || strpos($work, trailingslashit($work_root)) !== 0) return new WP_Error('dtf_recovery_bad_workspace','Deployment workspace is outside the protected work root; refusing recovery.',['status'=>409,'deployment_id'=>$id]);
            if ((file_exists($work) || is_link($work)) && !$remove_tree($work)) return new WP_Error('dtf_recovery_workspace','Could not remove untouched deployment workspace.',['status'=>500,'deployment_id'=>$id]);
            delete_option($state_key($id));
            $lock=get_option($lock_key, []);
            if (!is_array($lock) || ($lock['id'] ?? '') !== $id) return new WP_Error('dtf_recovery_lock_changed','Deployment lock changed during recovery; refusing to delete it.',['status'=>409,'deployment_id'=>$id]);
            delete_option($lock_key);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            return rest_ensure_response(['ok'=>true,'recovered'=>true,'status'=>'untouched-lock-cleared','deployment_id'=>$id]);
        },
    ]);
});
`.trim();

const plugin=await queryPlugin();
if(!plugin)throw new Error('Code Snippets is not installed; cannot create guarded lock recovery route.');
const pluginId=String(plugin.plugin||'');
const pluginWasActive=plugin.status==='active';
let activated=false;
let snippetId=0;
try{
  if(!pluginWasActive){await setPluginStatus(pluginId,'active');activated=true;if(!(await waitForSnippetApi()))throw new Error('Code Snippets API did not become available for lock recovery.');}
  const created=await request('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:snippetName,desc:'Temporary one-time route that can clear only a DTF suite lock whose transaction state proves no production target was touched.',code:snippetCode,tags:['dtf-deploy-recovery','temporary'],scope:'global',priority:1,active:false,network:false}});
  snippetId=Number(created.body?.id||created.body?.data?.id||created.body?.snippet?.id||0);
  if(!snippetId)throw new Error('Lock recovery snippet was created without a numeric ID.');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`,{method:'POST'});
  const inspect=await waitForRecoveryRoute();
  if(!inspect)throw new Error('Guarded lock recovery route did not become available.');
  if(inspect.body?.locked===false){console.log(JSON.stringify({ok:true,recovered:false,status:'no-lock',snippetId}));}
  else{
    if(inspect.body?.untouched!==true)throw new Error(`Existing deployment lock is not untouched; refusing recovery: ${JSON.stringify(inspect.body).slice(0,600)}`);
    const recovered=await request('/wp-json/dtf-suite-lock-recovery/v1/recover',{method:'POST',headers:{'X-DTF-Lock-Recovery-Token':token}});
    if(recovered.body?.ok!==true)throw new Error(`Untouched lock recovery was not confirmed: ${JSON.stringify(recovered.body).slice(0,600)}`);
    console.log(JSON.stringify({ok:true,recovered:Boolean(recovered.body?.recovered),status:recovered.body?.status||'unknown',deploymentId:recovered.body?.deployment_id||null,snippetId}));
  }
}finally{
  if(snippetId){
    try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`,{method:'POST',allow:[400,404]});}catch{}
    try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404]});}catch{}
    try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404]});}catch{}
  }
  if(activated){try{await setPluginStatus(pluginId,'inactive');}catch{}}
}
