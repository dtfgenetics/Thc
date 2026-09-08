import crypto from 'node:crypto';
import fs from 'node:fs';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WordPress credentials are required.');

const rel='approved-art-core-v1.js';
const source='site/public-route-patch/games/seed-man-platformer/'+rel;
const data=fs.readFileSync(source);
const sha256=crypto.createHash('sha256').update(data).digest('hex');
const auth='Basic '+Buffer.from(`${username}:${password}`).toString('base64');
const token=crypto.randomBytes(32).toString('hex');
const namespace=`dtf-seed-art/${crypto.randomBytes(8).toString('hex')}`;
let snippetId=null;
let pluginId='code-snippets/code-snippets';
let activatedByRun=false;
let installedByRun=false;
let pluginWasActive=false;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

async function wp(route,{method='GET',json,allow=[]}={}){
  const res=await fetch(site+route,{method,headers:{Authorization:auth,Accept:'application/json',...(json!==undefined?{'Content-Type':'application/json'}:{})},body:json!==undefined?JSON.stringify(json):undefined,signal:AbortSignal.timeout(45000)});
  const text=await res.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
  if(!res.ok&&!allow.includes(res.status)) throw new Error(`${method} ${route} failed ${res.status}: ${typeof body==='string'?body.slice(0,800):JSON.stringify(body).slice(0,800)}`);
  return {ok:res.ok,status:res.status,body};
}
async function queryPlugin(){const r=await wp('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100',{allow:[401,403,404]});return r.ok&&Array.isArray(r.body)?r.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null:null;}
function pluginEndpoint(id){return '/wp-json/wp/v2/plugins/'+String(id||pluginId).split('/').map(encodeURIComponent).join('/');}
async function setPlugin(id,status){return wp(pluginEndpoint(id),{method:'POST',json:{status}});}
async function waitApi(){for(let i=0;i<12;i++){const r=await wp('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});if(r.ok)return true;await sleep(500+i*250);}return false;}
async function ensureApi(){let p=await queryPlugin();pluginWasActive=p?.status==='active';if(p?.plugin)pluginId=p.plugin;const direct=await wp('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});if(direct.ok)return;if(!p){p=(await wp('/wp-json/wp/v2/plugins',{method:'POST',json:{slug:'code-snippets',status:'active'}})).body;installedByRun=true;}if(p?.plugin)pluginId=p.plugin;if(p?.status!=='active'){await setPlugin(pluginId,'active');activatedByRun=true;}if(!(await waitApi()))throw new Error('Code Snippets REST API unavailable.');}
async function cleanup(){if(snippetId){try{await wp(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`,{method:'POST',allow:[400,404,500]});}catch{}try{await wp(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404,500]});}catch{}}if(activatedByRun&&!pluginWasActive&&!installedByRun){try{await setPlugin(pluginId,'inactive');}catch{}}if(installedByRun){try{await wp(pluginEndpoint(pluginId),{method:'DELETE',allow:[400,404]});}catch{}}}

const code=String.raw`
add_action('rest_api_init', function () {
  $token = ${JSON.stringify(token)};
  register_rest_route(${JSON.stringify(namespace)}, '/publish', [
    'methods' => 'POST',
    'permission_callback' => static function (WP_REST_Request $r) use ($token) {
      $v=(string)$r->get_header('x-dtf-seed-art-token');
      return $v!=='' && hash_equals($token,$v);
    },
    'callback' => static function (WP_REST_Request $r) {
      $body=$r->get_json_params();
      $raw=base64_decode((string)($body['content_b64']??''),true);
      $sha=strtolower((string)($body['sha256']??''));
      if($raw===false||!preg_match('/^[a-f0-9]{64}$/',$sha)||!hash_equals($sha,hash('sha256',$raw))) return new WP_Error('dtf_seed_art_integrity','Integrity check failed.',['status'=>400]);
      $root=trailingslashit(wp_normalize_path(ABSPATH));
      $dest=wp_normalize_path(ABSPATH.'games/seed-man-platformer/approved-art-core-v1.js');
      if(strpos($dest,$root)!==0) return new WP_Error('dtf_seed_art_path','Unsafe path.',['status'=>500]);
      $dir=dirname($dest);if(!is_dir($dir)&&!wp_mkdir_p($dir)) return new WP_Error('dtf_seed_art_dir','Cannot create destination.',['status'=>500]);
      $tmp=$dest.'.tmp-'.wp_generate_uuid4();
      if(file_put_contents($tmp,$raw,LOCK_EX)!==strlen($raw)||!hash_equals($sha,(string)hash_file('sha256',$tmp))){@unlink($tmp);return new WP_Error('dtf_seed_art_write','Write failed.',['status'=>500]);}
      if(!@rename($tmp,$dest)){@unlink($tmp);return new WP_Error('dtf_seed_art_commit','Atomic replace failed.',['status'=>500]);}
      clearstatcache(true,$dest);
      if(!is_file($dest)||!hash_equals($sha,(string)hash_file('sha256',$dest))) return new WP_Error('dtf_seed_art_verify','Server verification failed.',['status'=>500]);
      do_action('litespeed_purge_url','/games/seed-man-platformer/approved-art-core-v1.js');
      do_action('litespeed_purge_url','/games/seed-man-platformer/');
      if(function_exists('wp_cache_flush')) wp_cache_flush();
      return rest_ensure_response(['ok'=>true,'file'=>'approved-art-core-v1.js','sha256'=>$sha,'server_verified'=>true]);
    }
  ]);
});`.trim();

try{
  await ensureApi();
  const created=await wp('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Seed Man Approved Art Publisher ${Date.now()}`,desc:'Temporary publisher for approved Seed Man art core.',code,tags:['seed-man','temporary'],scope:'global',priority:10,active:true}});
  snippetId=created.body?.id;
  if(!snippetId) throw new Error('Temporary publisher snippet was not created.');
  const result=await wp(`/wp-json/${namespace}/publish`,{method:'POST',json:{sha256,content_b64:data.toString('base64')}});
  if(result.body?.server_verified!==true||result.body?.sha256!==sha256) throw new Error('Approved art publish did not verify.');
  console.log(JSON.stringify(result.body,null,2));
}finally{await cleanup();}
