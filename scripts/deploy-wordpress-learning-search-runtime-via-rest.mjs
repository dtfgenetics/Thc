import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const sources=[
  ['dtf-learning-search.php','site/wordpress/mu-plugins/dtf-learning-search.php'],
  ['dtf-learning-search/search-v1.js','site/wordpress/mu-plugins/dtf-learning-search/search-v1.js'],
  ['dtf-learning-search/encyclopedia-v1.js','site/wordpress/mu-plugins/dtf-learning-search/encyclopedia-v1.js'],
  ['dtf-learning-search/thc-search-explain-v1.js','site/wordpress/mu-plugins/dtf-learning-search/thc-search-explain-v1.js'],
  ['dtf-learning-search/fuse-7.1.0.min.js','site/wordpress/mu-plugins/dtf-learning-search/fuse-7.1.0.min.js']
];

const payloads=[];
for(const [rel,sourcePath] of sources){
  const bytes=await readFile(sourcePath);
  payloads.push({
    rel,
    sourcePath,
    sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    contentB64:bytes.toString('base64')
  });
}

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token=crypto.randomBytes(32).toString('hex');
const namespace=`dtf-learning-search-deploy/v1-${crypto.randomBytes(8).toString('hex')}`;
const stateKey=`dtf_learning_search_deploy_${crypto.randomBytes(8).toString('hex')}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

let plugin=null;
let pluginId='code-snippets/code-snippets';
let pluginWasInstalled=false;
let pluginWasActive=false;
let installedByRun=false;
let activatedByRun=false;
let snippetId=0;
let bridgeFinalized=false;

async function request(path,{method='GET',json,headers={},allow=[],authenticated=true}={},attempts=method==='GET'?6:2){
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{
        method,
        redirect:'follow',
        signal:AbortSignal.timeout(60_000),
        headers:{
          Accept:'application/json, text/plain;q=0.9, */*;q=0.8',
          ...(authenticated?{Authorization:auth}:{}),
          ...(json!==undefined?{'Content-Type':'application/json'}:{}),
          ...headers
        },
        body:json!==undefined?JSON.stringify(json):undefined
      });
      const text=await response.text();
      let body=text;
      try{body=text?JSON.parse(text):null}catch{}
      if(!response.ok&&!allow.includes(response.status)){
        const detail=typeof body==='string'?body.slice(0,1200):JSON.stringify(body).slice(0,1200);
        throw new Error(`${method} ${path} failed (${response.status}): ${detail}`);
      }
      return {ok:response.ok,status:response.status,body,text};
    }catch(error){
      lastError=error;
      if(attempt<attempts) await sleep(Math.min(7000,900*attempt));
    }
  }
  throw lastError;
}

function pluginEndpoint(id){
  return `/wp-json/wp/v2/plugins/${String(id||pluginId).split('/').map(encodeURIComponent).join('/')}`;
}

async function queryCodeSnippets(){
  const response=await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100',{allow:[401,403,404]});
  if(!response.ok||!Array.isArray(response.body)) return null;
  return response.body.find(row=>String(row?.plugin||'').startsWith('code-snippets/'))||null;
}

async function snippetApiReady(){
  const result=await request('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]},2).catch(()=>null);
  return Boolean(result?.ok);
}

async function ensureSnippetApi(){
  plugin=await queryCodeSnippets();
  pluginWasInstalled=Boolean(plugin);
  pluginWasActive=plugin?.status==='active';
  if(plugin?.plugin) pluginId=plugin.plugin;
  if(await snippetApiReady()) return;

  if(!plugin){
    const created=await request('/wp-json/wp/v2/plugins',{
      method:'POST',
      json:{slug:'code-snippets',status:'active'}
    });
    plugin=created.body;
    installedByRun=true;
    activatedByRun=true;
    if(plugin?.plugin) pluginId=plugin.plugin;
  }else if(plugin.status!=='active'){
    const activated=await request(pluginEndpoint(pluginId),{
      method:'POST',
      json:{status:'active'}
    });
    plugin=activated.body;
    activatedByRun=true;
    if(plugin?.plugin) pluginId=plugin.plugin;
  }

  for(let attempt=1;attempt<=12;attempt+=1){
    if(await snippetApiReady()) return;
    await sleep(800+attempt*400);
  }
  throw new Error('Code Snippets REST API did not become available.');
}

const allowed=payloads.map(row=>row.rel);
const payloadJson=JSON.stringify(payloads.map(({rel,sha256,contentB64})=>({rel,sha256,contentB64})));
const bridgeCode=String.raw`
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    $namespace = ${JSON.stringify(namespace)};
    $state_key = ${JSON.stringify(stateKey)};
    $allowed = json_decode(${JSON.stringify(JSON.stringify(allowed))}, true);
    $payloads = json_decode(${JSON.stringify(payloadJson)}, true);

    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string)$request->get_header('x-dtf-learning-search-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };

    $root = trailingslashit(wp_normalize_path(WPMU_PLUGIN_DIR));

    $rollback = static function ($state) use ($root, $state_key) {
        $records = is_array($state['records'] ?? null) ? $state['records'] : [];
        for ($i = count($records) - 1; $i >= 0; $i--) {
            $record = $records[$i];
            if (empty($record['changed'])) { continue; }
            $target = wp_normalize_path($root . $record['rel']);
            if (strpos($target, $root) !== 0) { return false; }
            $backup = $target . '.dtf-learning-search-backup';
            if (is_file($target)) { @unlink($target); }
            if (!empty($record['had_existing'])) {
                if (!is_file($backup) || !@rename($backup, $target)) { return false; }
            } else {
                @unlink($backup);
            }
        }
        delete_option($state_key);
        if (function_exists('wp_cache_flush')) { wp_cache_flush(); }
        do_action('litespeed_purge_all');
        return true;
    };

    register_rest_route($namespace, '/apply', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($payloads, $allowed, $root, $state_key, $rollback) {
            if (!is_dir($root) && !wp_mkdir_p($root)) {
                return new WP_Error('dtf_learning_search_dir', 'Unable to create MU-plugin directory.', ['status' => 500]);
            }
            $state = ['records' => [], 'started_at' => gmdate('c')];

            foreach ($payloads as $payload) {
                $rel = (string)($payload['rel'] ?? '');
                if (!in_array($rel, $allowed, true)) {
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_scope', 'Unexpected deployment target.', ['status' => 409]);
                }
                if (!preg_match('#^(dtf-learning-search\\.php|dtf-learning-search/[a-z0-9.-]+\\.js)$#', $rel)) {
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_path', 'Unsafe deployment path.', ['status' => 409]);
                }

                $expected = strtolower((string)($payload['sha256'] ?? ''));
                $desired = base64_decode((string)($payload['contentB64'] ?? ''), true);
                if (!preg_match('/^[a-f0-9]{64}$/', $expected) || $desired === false || !hash_equals($expected, hash('sha256', $desired))) {
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_payload', 'Source payload failed SHA verification.', ['status' => 400]);
                }

                if ($rel === 'dtf-learning-search.php' &&
                    (strpos($desired, 'DTF Learning Search Runtime') === false ||
                     strpos($desired, "DTF_LEARNING_SEARCH_VERSION = '1.0.0'") === false)) {
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_marker', 'Main MU-plugin marker validation failed.', ['status' => 400]);
                }

                $target = wp_normalize_path($root . $rel);
                if (strpos($target, $root) !== 0) {
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_target', 'Unsafe MU-plugin destination.', ['status' => 409]);
                }
                $dir = dirname($target);
                if (!is_dir($dir) && !wp_mkdir_p($dir)) {
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_mkdir', 'Unable to create runtime asset directory.', ['status' => 500]);
                }

                if (is_file($target) && hash_equals($expected, (string)hash_file('sha256', $target))) {
                    $state['records'][] = ['rel' => $rel, 'sha256' => $expected, 'changed' => false, 'had_existing' => true];
                    update_option($state_key, $state, false);
                    continue;
                }

                $backup = $target . '.dtf-learning-search-backup';
                $stage = $target . '.dtf-learning-search-stage';
                if (is_file($backup) || is_file($stage)) {
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_collision', 'Existing backup/stage file blocks safe deployment.', ['status' => 409, 'path' => $rel]);
                }

                $had_existing = is_file($target);
                if ($had_existing && !@rename($target, $backup)) {
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_backup', 'Unable to back up current runtime file.', ['status' => 500, 'path' => $rel]);
                }

                $state['records'][] = ['rel' => $rel, 'sha256' => $expected, 'changed' => true, 'had_existing' => $had_existing];
                update_option($state_key, $state, false);

                $written = @file_put_contents($stage, $desired, LOCK_EX);
                if ($written !== strlen($desired) ||
                    !is_file($stage) ||
                    !hash_equals($expected, (string)hash_file('sha256', $stage)) ||
                    !@rename($stage, $target) ||
                    !is_file($target) ||
                    !hash_equals($expected, (string)hash_file('sha256', $target))) {
                    @unlink($stage);
                    $rollback($state);
                    return new WP_Error('dtf_learning_search_commit', 'Runtime write verification failed and was rolled back.', ['status' => 500, 'path' => $rel]);
                }
                @chmod($target, 0644);
            }

            update_option($state_key, $state, false);
            if (function_exists('wp_cache_flush')) { wp_cache_flush(); }
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'records' => $state['records']]);
        }
    ]);

    register_rest_route($namespace, '/rollback', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($state_key, $rollback) {
            $state = get_option($state_key, []);
            if (!is_array($state) || !$state) {
                return rest_ensure_response(['ok' => true, 'rolledBack' => false, 'reason' => 'no-state']);
            }
            if (!$rollback($state)) {
                return new WP_Error('dtf_learning_search_rollback', 'Unable to restore one or more runtime backups.', ['status' => 500]);
            }
            return rest_ensure_response(['ok' => true, 'rolledBack' => true]);
        }
    ]);

    register_rest_route($namespace, '/finalize', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($root, $state_key) {
            $state = get_option($state_key, []);
            if (!is_array($state) || !is_array($state['records'] ?? null)) {
                return new WP_Error('dtf_learning_search_state', 'Deployment state is missing.', ['status' => 409]);
            }
            foreach ($state['records'] as $record) {
                $target = wp_normalize_path($root . $record['rel']);
                if (strpos($target, $root) !== 0 ||
                    !is_file($target) ||
                    !hash_equals((string)$record['sha256'], (string)hash_file('sha256', $target))) {
                    return new WP_Error('dtf_learning_search_final_hash', 'Live runtime file no longer matches reviewed source.', ['status' => 409, 'path' => $record['rel']]);
                }
                $backup = $target . '.dtf-learning-search-backup';
                if (is_file($backup) && !@unlink($backup)) {
                    return new WP_Error('dtf_learning_search_final_backup', 'Unable to remove runtime rollback backup.', ['status' => 500, 'path' => $record['rel']]);
                }
            }
            delete_option($state_key);
            return rest_ensure_response(['ok' => true, 'finalized' => true]);
        }
    ]);
});
`.trim();

async function cleanup(){
  if(snippetId){
    try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`,{method:'POST',allow:[400,404,500]},2)}catch{}
    try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404,500]},2)}catch{}
  }
  if(installedByRun&&!pluginWasInstalled){
    try{await request(pluginEndpoint(pluginId),{method:'POST',json:{status:'inactive'},allow:[400,404]},2)}catch{}
  }else if(activatedByRun&&!pluginWasActive){
    try{await request(pluginEndpoint(pluginId),{method:'POST',json:{status:'inactive'},allow:[400,404]},2)}catch{}
  }
}

async function verifyPublic(){
  let health=null;
  for(let attempt=1;attempt<=12;attempt+=1){
    const response=await request(`/wp-json/dtf-learning/v1/health?dtf_rest_deploy=${Date.now()}-${attempt}`,{
      authenticated:false,
      headers:{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache'},
      allow:[404]
    },2);
    if(response.ok&&response.body?.ok===true&&response.body?.version==='1.0.0'){
      health=response.body;
      break;
    }
    await sleep(1000+attempt*500);
  }
  if(!health) throw new Error('Learning Search health endpoint did not become active after REST deployment.');

  for(const payload of payloads.filter(row=>row.rel.startsWith('dtf-learning-search/'))){
    const name=payload.rel.split('/').pop();
    const response=await fetch(`${site}/wp-content/mu-plugins/dtf-learning-search/${encodeURIComponent(name)}?dtf_rest_deploy=${Date.now()}`,{
      redirect:'follow',
      signal:AbortSignal.timeout(60_000),
      headers:{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache'}
    });
    if(!response.ok) throw new Error(`Live runtime asset ${name} returned ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    const sha=crypto.createHash('sha256').update(bytes).digest('hex');
    if(sha!==payload.sha256) throw new Error(`Live runtime asset hash mismatch: ${name}`);
  }
  return health;
}

async function ensureBridge(){
  await ensureSnippetApi();
  const created=await request('/wp-json/code-snippets/v1/snippets',{
    method:'POST',
    json:{
      name:`DTF Learning Search Runtime Deploy ${process.env.GITHUB_RUN_ID||Date.now()}`,
      desc:'Temporary token-protected bridge for atomically installing the source-controlled THC Learning Search MU-plugin runtime.',
      code:bridgeCode,
      tags:['dtf-learning-search','deployment','temporary'],
      scope:'global',
      priority:1,
      active:false,
      network:false
    }
  });
  snippetId=Number(created.body?.id||created.body?.data?.id||created.body?.snippet?.id||0);
  if(!snippetId) throw new Error('Temporary Learning Search deployment bridge did not return a numeric ID.');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`,{method:'POST'});

  for(let attempt=1;attempt<=10;attempt+=1){
    const probe=await request(`/wp-json/${namespace}/apply`,{
      method:'POST',
      headers:{'X-DTF-Learning-Search-Token':token},
      allow:[404]
    },1).catch(()=>null);
    if(probe?.ok) return probe.body;
    await sleep(700+attempt*350);
  }
  throw new Error('Temporary Learning Search deployment bridge did not become available.');
}

let applied=false;
try{
  const result=await ensureBridge();
  if(result?.ok!==true||!Array.isArray(result.records)||result.records.length!==payloads.length){
    throw new Error('Learning Search deployment bridge did not confirm all protected runtime files.');
  }
  applied=true;

  let health;
  try{
    health=await verifyPublic();
  }catch(error){
    await request(`/wp-json/${namespace}/rollback`,{
      method:'POST',
      headers:{'X-DTF-Learning-Search-Token':token}
    },2).catch(()=>null);
    applied=false;
    throw error;
  }

  const finalized=await request(`/wp-json/${namespace}/finalize`,{
    method:'POST',
    headers:{'X-DTF-Learning-Search-Token':token}
  });
  if(finalized.body?.finalized!==true) throw new Error('Learning Search runtime finalization failed.');
  bridgeFinalized=true;

  console.log(JSON.stringify({
    ok:true,
    mode:'wordpress-rest-bridge',
    site,
    runtimeVersion:health.version,
    files:payloads.map(({rel,sourcePath,sha256})=>({rel,sourcePath,sha256})),
    serverVerified:true
  },null,2));
}finally{
  if(applied&&!bridgeFinalized){
    try{
      await request(`/wp-json/${namespace}/rollback`,{
        method:'POST',
        headers:{'X-DTF-Learning-Search-Token':token}
      },2);
    }catch{}
  }
  await cleanup();
}
