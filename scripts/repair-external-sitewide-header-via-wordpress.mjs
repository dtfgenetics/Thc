import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const configPath=process.env.EXTERNAL_HEADER_SOURCE_CONFIG||'site/deployment/external-header-sources.json';
const surfaceName=process.env.EXTERNAL_HEADER_SURFACE||'kushKingsChess';
if(!username||!password) throw new Error('WordPress credentials are required.');

const config=JSON.parse(await readFile(configPath,'utf8'));
if(config?.schemaVersion!==1) throw new Error('Unsupported external-header source schema.');
const surface=config?.surfaces?.[surfaceName];
if(!surface) throw new Error(`Unknown external header surface: ${surfaceName}`);
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(surface.repository||'')) throw new Error('Invalid source repository.');
if(!/^[a-f0-9]{40}$/.test(surface.commit||'')) throw new Error('External source must be pinned to a full Git commit SHA.');
if(!Array.isArray(surface.files)||surface.files.length<1||surface.files.length>12) throw new Error('External source file list is invalid.');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const token=crypto.randomBytes(32).toString('hex');
const deploymentId=crypto.randomBytes(10).toString('hex');
const stateKey=`dtf_external_header_${deploymentId}`;
const backupPrefix=`dtf_external_header_backup_${deploymentId}_`;
let snippetId=null;
let pluginRestId='code-snippets/code-snippets';
let pluginInitiallyActive=false;
let pluginActivated=false;
let wrote=false;
let rollbackFailed=false;

async function wpRequest(path,{method='GET',json,headers={},allow=[]}={}){
  let lastError;
  for(let attempt=1;attempt<=7;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{method,headers:{Authorization:auth,Accept:'application/json',...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:json!==undefined?JSON.stringify(json):undefined,redirect:'follow',signal:AbortSignal.timeout(45_000)});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
      if(!response.ok&&!allow.includes(response.status)) throw new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,650):JSON.stringify(body).slice(0,650)}`);
      return {ok:response.ok,status:response.status,body};
    }catch(error){lastError=error;if(attempt<7) await sleep(Math.min(12_000,1200*attempt));}
  }
  throw lastError;
}

function pluginEndpoint(id){return `/wp-json/wp/v2/plugins/${String(id).split('/').map(encodeURIComponent).join('/')}`;}
async function queryPlugin(){
  const result=await wpRequest('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100',{allow:[401,403,404]});
  if(!result.ok||!Array.isArray(result.body)) return null;
  return result.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null;
}
async function snippetApiReady(){
  const result=await wpRequest('/wp-json/code-snippets/v1/snippets/schema',{allow:[404]});
  return result.ok;
}

function joinRel(root,file){return `${String(root||'').replace(/^\/+|\/+$/g,'')}/${String(file||'').replace(/^\/+/, '')}`;}
function sourceUrl(file){
  return `https://raw.githubusercontent.com/${surface.repository}/${surface.commit}/${joinRel(surface.sourceRoot,file)}`;
}
async function sourceFile(file){
  const response=await fetch(sourceUrl(file),{headers:{'User-Agent':'DTFSeeds-External-Header-Repair/1.0','Cache-Control':'no-cache'},signal:AbortSignal.timeout(45_000)});
  if(!response.ok) throw new Error(`Pinned source fetch failed for ${file}: HTTP ${response.status}`);
  const raw=Buffer.from(await response.arrayBuffer());
  if(raw.length<1||raw.length>260_000) throw new Error(`Pinned source file size rejected: ${file} (${raw.length})`);
  return raw;
}

const payload=[];
for(const file of surface.files){
  if(typeof file!=='string'||!file||file.includes('..')||file.startsWith('/')||file.includes('\\')) throw new Error(`Unsafe source file: ${file}`);
  const raw=await sourceFile(file);
  const rel=joinRel(surface.publicRoot,file);
  if((file==='index.html'||file==='play.php')&&!raw.toString('utf8').includes('data-dtf-shell="header-v5"')) throw new Error(`Pinned source ${file} does not contain the approved V5 header marker.`);
  payload.push({rel,sha256:crypto.createHash('sha256').update(raw).digest('hex'),content_b64:raw.toString('base64'),bytes:raw.length});
}
const totalBytes=payload.reduce((n,x)=>n+x.bytes,0);
if(totalBytes>700_000) throw new Error(`External header payload too large: ${totalBytes}`);
console.log(`Prepared ${payload.length} pinned files from ${surface.repository}@${surface.commit} (${totalBytes} bytes).`);

const allowed=payload.map(x=>x.rel);
const snippetCode=String.raw`
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    $state_key = ${JSON.stringify(stateKey)};
    $backup_prefix = ${JSON.stringify(backupPrefix)};
    $allowed = ${JSON.stringify(allowed)};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-external-header-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };
    $is_allowed = static function ($rel) use ($allowed) { return is_string($rel) && in_array($rel, $allowed, true); };
    $safe_path = static function ($rel) {
        $root = trailingslashit(wp_normalize_path(ABSPATH));
        $path = wp_normalize_path(ABSPATH . $rel);
        return strpos($path, $root) === 0 ? $path : false;
    };
    $backup_key = static function ($rel) use ($backup_prefix) { return $backup_prefix . md5($rel); };
    $rollback = static function () use ($state_key, $backup_key, $safe_path) {
        $state = get_option($state_key, []);
        $written = is_array($state['written'] ?? null) ? array_reverse($state['written']) : [];
        $restored = [];
        foreach ($written as $rel) {
            $backup = get_option($backup_key($rel));
            $path = $safe_path($rel);
            if (!$path || !is_array($backup)) continue;
            if (!empty($backup['existed'])) {
                $raw = base64_decode((string) ($backup['content_b64'] ?? ''), true);
                if ($raw === false) return new WP_Error('dtf_restore_decode', 'Backup decode failed.', ['status'=>500,'path'=>$rel]);
                if (!is_dir(dirname($path)) && !wp_mkdir_p(dirname($path))) return new WP_Error('dtf_restore_mkdir', 'Restore directory creation failed.', ['status'=>500,'path'=>$rel]);
                if (file_put_contents($path, $raw, LOCK_EX) === false) return new WP_Error('dtf_restore_write', 'Restore write failed.', ['status'=>500,'path'=>$rel]);
                if (!hash_equals((string)($backup['sha256']??''), hash_file('sha256',$path))) return new WP_Error('dtf_restore_hash', 'Restore hash mismatch.', ['status'=>500,'path'=>$rel]);
            } elseif (is_file($path) && !unlink($path)) return new WP_Error('dtf_restore_remove', 'Could not remove new file.', ['status'=>500,'path'=>$rel]);
            $restored[]=$rel;
        }
        update_option($state_key,['status'=>'rolled-back','written'=>[],'restored'=>$restored,'updated_at'=>gmdate('c')],false);
        if(function_exists('wp_cache_flush')) wp_cache_flush();
        return ['ok'=>true,'restored'=>$restored];
    };
    register_rest_route('dtf-external-header/v1','/write',[
        'methods'=>'POST','permission_callback'=>$permission,
        'callback'=>static function(WP_REST_Request $request) use($is_allowed,$safe_path,$backup_key,$state_key,$rollback){
            $body=$request->get_json_params(); $files=is_array($body['files']??null)?$body['files']:[];
            if(!$files||count($files)>12) return new WP_Error('dtf_bad_batch','Invalid file batch.',['status'=>400]);
            $state=get_option($state_key,[]); if(!is_array($state))$state=[]; $written=is_array($state['written']??null)?$state['written']:[]; $changed=[]; $unchanged=[];
            foreach($files as $item){
                $rel=(string)($item['rel']??''); $sha=strtolower((string)($item['sha256']??'')); $encoded=(string)($item['content_b64']??'');
                if(!$is_allowed($rel)||!preg_match('/^[a-f0-9]{64}$/',$sha)) return new WP_Error('dtf_bad_file','Path/hash rejected.',['status'=>400,'path'=>$rel]);
                $raw=base64_decode($encoded,true); if($raw===false||strlen($raw)>260000) return new WP_Error('dtf_bad_payload','Payload rejected.',['status'=>400,'path'=>$rel]);
                if(!hash_equals($sha,hash('sha256',$raw))) return new WP_Error('dtf_payload_hash','Payload hash mismatch.',['status'=>400,'path'=>$rel]);
                $path=$safe_path($rel); if(!$path) return new WP_Error('dtf_bad_path','Unsafe target path.',['status'=>400,'path'=>$rel]);
                if(is_file($path)&&hash_equals($sha,hash_file('sha256',$path))){$unchanged[]=$rel;continue;}
                $key=$backup_key($rel);
                if(get_option($key,null)===null){
                    $existed=is_file($path); $old=$existed?file_get_contents($path):'';
                    if($existed&&$old===false){$rollback();return new WP_Error('dtf_backup_read','Could not read existing file.',['status'=>500,'path'=>$rel]);}
                    $backup=['existed'=>$existed,'sha256'=>$existed?hash('sha256',$old):'','content_b64'=>$existed?base64_encode($old):''];
                    update_option($key,$backup,false); $stored=get_option($key);
                    if(!is_array($stored)||(bool)($stored['existed']??false)!==$existed){$rollback();return new WP_Error('dtf_backup_verify','Backup verification failed.',['status'=>500,'path'=>$rel]);}
                }
                if(!is_dir(dirname($path))&&!wp_mkdir_p(dirname($path))){$rollback();return new WP_Error('dtf_mkdir','Could not create target directory.',['status'=>500,'path'=>$rel]);}
                $tmp=$path.'.dtf-external-header.tmp';
                if(file_put_contents($tmp,$raw,LOCK_EX)===false){@unlink($tmp);$rollback();return new WP_Error('dtf_write','Temporary write failed.',['status'=>500,'path'=>$rel]);}
                if(!hash_equals($sha,hash_file('sha256',$tmp))||!@rename($tmp,$path)||!hash_equals($sha,hash_file('sha256',$path))){@unlink($tmp);$rollback();return new WP_Error('dtf_publish','Atomic publish verification failed.',['status'=>500,'path'=>$rel]);}
                if(!in_array($rel,$written,true))$written[]=$rel; $changed[]=$rel;
                update_option($state_key,['status'=>'writing','written'=>$written,'updated_at'=>gmdate('c')],false);
            }
            update_option($state_key,['status'=>'written','written'=>$written,'updated_at'=>gmdate('c')],false);
            if(function_exists('wp_cache_flush')) wp_cache_flush();
            return rest_ensure_response(['ok'=>true,'changed'=>$changed,'unchanged'=>$unchanged]);
        }
    ]);
    register_rest_route('dtf-external-header/v1','/rollback',['methods'=>'POST','permission_callback'=>$permission,'callback'=>static function() use($rollback){$r=$rollback();return is_wp_error($r)?$r:rest_ensure_response($r);}]);
    register_rest_route('dtf-external-header/v1','/finalize',['methods'=>'POST','permission_callback'=>$permission,'callback'=>static function() use($state_key,$backup_key){$state=get_option($state_key,[]);$written=is_array($state['written']??null)?$state['written']:[];foreach($written as $rel)delete_option($backup_key($rel));delete_option($state_key);return rest_ensure_response(['ok'=>true]);}]);
});
`.trim();

async function cleanTools(){
  if(snippetId&&!rollbackFailed){
    try{await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`,{method:'POST',allow:[400,404]});}catch{}
    try{await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404]});}catch{}
  }
  if(pluginActivated&&!pluginInitiallyActive&&!rollbackFailed){try{await wpRequest(pluginEndpoint(pluginRestId),{method:'POST',json:{status:'inactive'}});}catch{}}
}
async function callBridge(path,json={}){return wpRequest(`/wp-json/dtf-external-header/v1/${path}`,{method:'POST',headers:{'X-DTF-External-Header-Token':token},json});}
async function verifyLive(){
  for(const route of surface.verifyRoutes||[]){
    let ok=false;
    for(let attempt=1;attempt<=10;attempt++){
      try{
        const response=await fetch(`${siteUrl}${route}?dtf_external_header=${deploymentId}-${attempt}`,{headers:{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache'},redirect:'follow',signal:AbortSignal.timeout(45_000)});
        const text=await response.text();
        if(response.ok&&(surface.requiredMarkers||[]).every(marker=>text.includes(marker))){ok=true;break;}
      }catch{}
      await sleep(2500+attempt*700);
    }
    if(!ok) throw new Error(`Visitor-facing V5 header verification failed: ${route}`);
    console.log(`Verified ${route}`);
  }
}

try{
  let plugin=await queryPlugin();
  if(!plugin) throw new Error('Code Snippets is not installed; refusing to install production plugins from this targeted repair lane.');
  pluginRestId=plugin.plugin||pluginRestId; pluginInitiallyActive=plugin.status==='active';
  if(!pluginInitiallyActive){await wpRequest(pluginEndpoint(pluginRestId),{method:'POST',json:{status:'active'}});pluginActivated=true;}
  for(let i=0;i<10&&!(await snippetApiReady());i++) await sleep(1500+i*500);
  if(!(await snippetApiReady())) throw new Error('Code Snippets REST API did not become available.');
  const created=await wpRequest('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF External Header Repair ${deploymentId}`,desc:`Temporary protected V5 header repair for ${surfaceName}`,code:snippetCode,tags:['dtf-repair','temporary','sitewide-header-v5'],scope:'global',priority:1,active:false,network:false}});
  snippetId=Number(created.body?.id||0); if(!snippetId) throw new Error('Temporary repair snippet was created without an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`,{method:'POST'});
  const write=await callBridge('write',{files:payload});
  if(write.body?.ok!==true) throw new Error(`Repair endpoint did not report success: ${JSON.stringify(write.body).slice(0,700)}`);
  wrote=true;
  await verifyLive();
  const finalized=await callBridge('finalize'); if(finalized.body?.ok!==true) throw new Error('Repair finalization failed.');
  console.log(JSON.stringify({ok:true,surface:surfaceName,repository:surface.repository,commit:surface.commit,changed:write.body.changed||[],unchanged:write.body.unchanged||[],verifiedRoutes:surface.verifyRoutes||[]},null,2));
}catch(error){
  if(wrote&&snippetId){
    try{const rolled=await callBridge('rollback');if(rolled.body?.ok!==true)throw new Error('Rollback endpoint did not report success.');console.error('Live verification failed; previous external route files were restored.');}
    catch(rollbackError){rollbackFailed=true;console.error(`AUTOMATIC ROLLBACK FAILED: ${rollbackError.message}`);}
  }
  throw error;
}finally{await cleanTools();}
