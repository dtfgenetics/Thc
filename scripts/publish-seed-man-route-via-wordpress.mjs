import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const sourceRoot = path.resolve('site/public-route-patch/games/seed-man-platformer');
const releaseFiles = ['.htaccess','index.html','app.js','canvas-compat-v1.js','seed-man-production-art.js','input-guard-v1.js','seed-man.css','physics.mjs','data/level-01.json'];
const indexText = fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');
for (const marker of ['Seed Man · Greenhouse Gauntlet','0 / 24','JUMP ×2','20260830-r4']) if (!indexText.includes(marker)) throw new Error(`Missing canonical marker: ${marker}`);
for (const stale of ['Original browser vertical slice','0 / 8','collect all eight sprouts']) if (indexText.includes(stale)) throw new Error(`Retired marker remains: ${stale}`);

const files = releaseFiles.map((rel) => {
  const data = fs.readFileSync(path.join(sourceRoot, rel));
  return { rel, size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), content_b64: data.toString('base64') };
});

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token = crypto.randomBytes(32).toString('hex');
const namespace = `dtf-seed-man-publish/v1-${crypto.randomBytes(8).toString('hex')}`;
const tokenLiteral = JSON.stringify(token);
const namespaceLiteral = JSON.stringify(namespace);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let snippetId = null;
let pluginId = 'code-snippets/code-snippets';
let pluginWasActive = false;
let installedByRun = false;
let activatedByRun = false;

async function wpRequest(route, { method='GET', json, headers={}, allow=[] }={}) {
  const response = await fetch(`${siteUrl}${route}`, {
    method,
    headers: { Authorization: auth, Accept: 'application/json', ...(json !== undefined ? {'Content-Type':'application/json'} : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) throw new Error(`WordPress ${method} ${route} failed (${response.status}): ${typeof body === 'string' ? body.slice(0,1200) : JSON.stringify(body).slice(0,1200)}`);
  return { ok: response.ok, status: response.status, body };
}

async function queryPlugin() {
  const r = await wpRequest('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', {allow:[401,403,404]});
  return r.ok && Array.isArray(r.body) ? r.body.find((p) => String(p?.plugin || '').startsWith('code-snippets/')) || null : null;
}
function pluginEndpoint(id) { return `/wp-json/wp/v2/plugins/${String(id || pluginId).split('/').map(encodeURIComponent).join('/')}`; }
async function setPluginStatus(id,status) { return wpRequest(pluginEndpoint(id), {method:'POST',json:{status}}); }
async function waitForSnippetApi(safe=false) {
  const suffix = safe ? '?snippets-safe-mode=1' : '';
  for (let i=1;i<=12;i++) { try { const r=await wpRequest(`/wp-json/code-snippets/v1/snippets/schema${suffix}`,{allow:[404,500]}); if(r.ok)return true; } catch {} await sleep(700+i*350); }
  return false;
}
async function ensureSnippetApi() {
  let plugin=await queryPlugin();
  pluginWasActive=plugin?.status==='active';
  if(plugin?.plugin)pluginId=plugin.plugin;
  const direct=await wpRequest('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});
  if(direct.ok)return;
  if(!plugin){plugin=(await wpRequest('/wp-json/wp/v2/plugins',{method:'POST',json:{slug:'code-snippets',status:'active'}})).body;installedByRun=true;}
  if(plugin?.plugin)pluginId=plugin.plugin;
  if(plugin?.status!=='active'){const a=await setPluginStatus(pluginId,'active');activatedByRun=true;if(a.body?.plugin)pluginId=a.body.plugin;}
  if(!(await waitForSnippetApi()))throw new Error('Code Snippets REST API unavailable.');
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $namespace = ${namespaceLiteral};
    $allowed = ['.htaccess','index.html','app.js','canvas-compat-v1.js','seed-man-production-art.js','input-guard-v1.js','seed-man.css','physics.mjs','data/level-01.json'];
    $remove_tree = static function ($dir) use (&$remove_tree) {
        if (!is_dir($dir)) return;
        $items = scandir($dir); if ($items === false) return;
        foreach ($items as $item) { if ($item === '.' || $item === '..') continue; $p=$dir.DIRECTORY_SEPARATOR.$item; if (is_dir($p) && !is_link($p)) $remove_tree($p); else @unlink($p); }
        @rmdir($dir);
    };
    register_rest_route($namespace, '/publish', [
        'methods'=>'POST',
        'permission_callback'=>static function(WP_REST_Request $r) use($token){ $s=(string)$r->get_header('x-dtf-seed-man-token'); if($s==='')$s=(string)$r->get_param('_dtf_seed_man_token'); return $s!=='' && hash_equals($token,$s); },
        'callback'=>static function(WP_REST_Request $r) use($allowed,$remove_tree){
            $body=$r->get_json_params(); $incoming=isset($body['files'])&&is_array($body['files'])?$body['files']:[];
            if(count($incoming)!==count($allowed))return new WP_Error('dtf_seed_file_count','Seed Man file count mismatch.',['status'=>400]);
            $by=[]; foreach($incoming as $f){$rel=(string)($f['rel']??'');if(!in_array($rel,$allowed,true)||isset($by[$rel]))return new WP_Error('dtf_seed_file_name','Unexpected or duplicate file.',['status'=>400,'rel'=>$rel]);$by[$rel]=$f;}
            foreach($allowed as $rel)if(!isset($by[$rel]))return new WP_Error('dtf_seed_missing','Missing file.',['status'=>400,'rel'=>$rel]);
            $root=trailingslashit(wp_normalize_path(ABSPATH)); $games=wp_normalize_path(ABSPATH.'games'); $target=wp_normalize_path(ABSPATH.'games/seed-man-platformer');
            if(strpos($target,$root)!==0)return new WP_Error('dtf_seed_path','Unsafe destination.',['status'=>500]);
            if(!is_dir($games)&&!wp_mkdir_p($games))return new WP_Error('dtf_seed_games','Cannot create games directory.',['status'=>500]);
            $nonce=wp_generate_uuid4(); $stage=wp_normalize_path(ABSPATH.'games/.seed-man-stage-'.$nonce); $backup=wp_normalize_path(ABSPATH.'games/.seed-man-backup-'.$nonce);
            if(!wp_mkdir_p($stage))return new WP_Error('dtf_seed_stage','Cannot create stage.',['status'=>500]);
            $written=[];
            foreach($allowed as $rel){$f=$by[$rel];$raw=base64_decode((string)($f['content_b64']??''),true);$sha=strtolower((string)($f['sha256']??''));$size=(int)($f['size']??-1);
                if($raw===false||!preg_match('/^[a-f0-9]{64}$/',$sha)||strlen($raw)!==$size||!hash_equals($sha,hash('sha256',$raw))){$remove_tree($stage);return new WP_Error('dtf_seed_payload','Payload integrity failed.',['status'=>400,'rel'=>$rel]);}
                $dest=wp_normalize_path($stage.'/'.$rel);$dir=dirname($dest);if(strpos($dest,trailingslashit($stage))!==0||(!is_dir($dir)&&!wp_mkdir_p($dir))){$remove_tree($stage);return new WP_Error('dtf_seed_stage_path','Unsafe stage path.',['status'=>500,'rel'=>$rel]);}
                if(file_put_contents($dest,$raw,LOCK_EX)!==strlen($raw)||!hash_equals($sha,(string)hash_file('sha256',$dest))){$remove_tree($stage);return new WP_Error('dtf_seed_write','Stage write failed.',['status'=>500,'rel'=>$rel]);}
                $written[$rel]=$sha;
            }
            $idx=@file_get_contents($stage.'/index.html');
            if(!is_string($idx)||strpos($idx,'Seed Man · Greenhouse Gauntlet')===false||strpos($idx,'0 / 24')===false||strpos($idx,'20260830-r4')===false||strpos($idx,'Original browser vertical slice')!==false||strpos($idx,'0 / 8')!==false){$remove_tree($stage);return new WP_Error('dtf_seed_markers','Invalid staged markers.',['status'=>409]);}
            $had=is_dir($target); if($had&&!@rename($target,$backup)){$remove_tree($stage);return new WP_Error('dtf_seed_backup','Cannot backup current route.',['status'=>500]);}
            if(!@rename($stage,$target)){if($had)@rename($backup,$target);$remove_tree($stage);return new WP_Error('dtf_seed_commit','Atomic publish failed.',['status'=>500]);}
            clearstatcache(true,$target);$verified=true;foreach($written as $rel=>$sha){$live=$target.'/'.$rel;if(!is_file($live)||!hash_equals($sha,(string)hash_file('sha256',$live))){$verified=false;break;}}
            $idx=@file_get_contents($target.'/index.html');$verified=$verified&&is_string($idx)&&strpos($idx,'Seed Man · Greenhouse Gauntlet')!==false&&strpos($idx,'0 / 24')!==false&&strpos($idx,'20260830-r4')!==false&&strpos($idx,'Original browser vertical slice')===false&&strpos($idx,'0 / 8')===false;
            if(!$verified){$remove_tree($target);if($had)@rename($backup,$target);return new WP_Error('dtf_seed_verify','Server verification failed; rolled back.',['status'=>500]);}
            if($had)$remove_tree($backup);
            foreach(['/games/seed-man-platformer/','/games/seed-man-platformer/index.html','/games/seed-man-platformer/app.js','/games/seed-man-platformer/canvas-compat-v1.js','/games/seed-man-platformer/seed-man-production-art.js','/games/seed-man-platformer/input-guard-v1.js','/games/seed-man-platformer/seed-man.css','/games/seed-man-platformer/physics.mjs','/games/seed-man-platformer/data/level-01.json'] as $url)do_action('litespeed_purge_url',$url);
            do_action('litespeed_purge_all'); if(!headers_sent())header('X-LiteSpeed-Purge: *'); if(function_exists('wp_cache_flush'))wp_cache_flush(); clearstatcache();
            return rest_ensure_response(['ok'=>true,'route'=>'/games/seed-man-platformer/','release'=>'20260830-r4','files'=>$written,'server_verified'=>true,'cache_purge_fired'=>true,'published_at'=>gmdate('c')]);
        }
    ]);
});
`.trim();

async function cleanup(){
  if(snippetId){let suffix='';if(!(await waitForSnippetApi())&&await waitForSnippetApi(true))suffix='?snippets-safe-mode=1';try{await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate${suffix}`,{method:'POST',allow:[400,404,500]});}catch{}try{await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}${suffix}`,{method:'DELETE',allow:[404,500]});}catch{}}
  if(activatedByRun&&!pluginWasActive&&!installedByRun){try{await setPluginStatus(pluginId,'inactive');}catch{}}
  if(installedByRun){try{await wpRequest(pluginEndpoint(pluginId),{method:'DELETE',allow:[400,404]});}catch{}}
}

try{
  await ensureSnippetApi();
  const created=await wpRequest('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Seed Man Atomic Publisher ${process.env.GITHUB_RUN_ID||Date.now()}`,desc:'Temporary authenticated publisher for canonical Seed Man only.',code:snippetCode,tags:['dtf-release','temporary','seed-man'],scope:'global',priority:1,active:false,network:false}});
  snippetId=Number(created.body?.id||0);if(!snippetId)throw new Error('Temporary publisher snippet missing ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`,{method:'POST'});
  const result=await wpRequest(`/wp-json/${namespace}/publish`,{method:'POST',headers:{'X-DTF-Seed-Man-Token':token},json:{_dtf_seed_man_token:token,files}});
  if(result.body?.ok!==true||result.body?.server_verified!==true||result.body?.release!=='20260830-r4')throw new Error(`Publish did not verify: ${JSON.stringify(result.body).slice(0,1400)}`);
  console.log(JSON.stringify(result.body,null,2));
}finally{await cleanup();}
