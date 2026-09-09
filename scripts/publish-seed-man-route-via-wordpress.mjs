import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WordPress credentials are required.');

const root=path.resolve('site/public-route-patch/games/seed-man-platformer');
const releaseFiles=[
  '.htaccess','index.html','app.js','canvas-compat-v1.js','campaign-v1.js','campaign-v20-runtime.js','campaign-ui-v20.js',
  'approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','gameplay-v2.js',
  'v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','enemy-attacks.js','three-world-v1.js',
  'input-guard-v1.js','seed-man.css','physics.mjs',
  'assets/approved/seed-man-character-atlas-v2.webp',
  'assets/approved/seed-man-enemy-boss-atlas-v1.webp',
  'assets/approved/seed-man-platform-atlas-v1.webp',
  'data/campaign.json','data/level-01.json','data/levels-20-v1.json','data/seed-man-art-manifest-v1.json',
  'data/enemy-catalog-v1.json','data/boss-catalog-v1.json'
];
for(const rel of releaseFiles){const p=path.join(root,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)throw new Error(`Missing release file: ${rel}`);}

const campaign=JSON.parse(fs.readFileSync(path.join(root,'data/campaign.json'),'utf8'));
const levels=JSON.parse(fs.readFileSync(path.join(root,'data/levels-20-v1.json'),'utf8'));
if(campaign.levelCount!==20||campaign.finalBoss!=='blight-king'||levels.levels?.length!==20)throw new Error('Seed Man v20 campaign contract is not ready to publish.');

const indexText=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const legacy of ['campaign-ui-v15.js','world-five-v1.js','levels-12-15.json','combat-browser-v1.js','enemy-attacks-browser-v1.js'])if(indexText.includes(legacy))throw new Error(`Legacy Seed Man runtime cannot be published: ${legacy}`);
for(const required of ['campaign-v20-runtime.js','campaign-ui-v20.js','v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js'])if(!indexText.includes(required))throw new Error(`Seed Man public index missing v20 runtime: ${required}`);
const campaignRuntimeText=fs.readFileSync(path.join(root,'campaign-v20-runtime.js'),'utf8');
for(const retiredPower of ["'speed'", "'shield'", "'magnet'", "'jump'"])if(campaignRuntimeText.includes(retiredPower))throw new Error(`Retired prototype power remains in v20 campaign runtime: ${retiredPower}`);
for(const requiredForm of ["'plant'","'fire'","'electric'","'ice'"])if(!campaignRuntimeText.includes(requiredForm))throw new Error(`Missing canonical phenotype form in v20 campaign runtime: ${requiredForm}`);

const release=indexText.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1]||'20260909-combat-v2';
const files=releaseFiles.map((rel)=>{const data=fs.readFileSync(path.join(root,rel));return{rel,size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),content_b64:data.toString('base64')}});
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token=crypto.randomBytes(32).toString('hex');
const namespace=`dtf-seed-man-publish/v20-${crypto.randomBytes(8).toString('hex')}`;
const allowedPhp=releaseFiles.map((rel)=>`'${rel.replaceAll("'","\\'")}'`).join(',');
const purgePhp=['/games/seed-man-platformer/',...releaseFiles.map((r)=>`/games/seed-man-platformer/${r}`)].map((u)=>`'${u.replaceAll("'","\\'")}'`).join(',');

async function wp(route,{method='GET',json,allow=[]}={}){
  const res=await fetch(`${siteUrl}${route}`,{method,headers:{Authorization:auth,Accept:'application/json',...(json!==undefined?{'Content-Type':'application/json'}:{})},body:json!==undefined?JSON.stringify(json):undefined,signal:AbortSignal.timeout(45000)});
  const text=await res.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
  if(!res.ok&&!allow.includes(res.status))throw new Error(`${method} ${route} failed ${res.status}: ${typeof body==='string'?body.slice(0,1200):JSON.stringify(body).slice(0,1200)}`);
  return{ok:res.ok,status:res.status,body};
}

const php=String.raw`
add_action('rest_api_init', function () {
  $token = ${JSON.stringify(token)};
  $ns = ${JSON.stringify(namespace)};
  $allowed = [${allowedPhp}];
  $purge = [${purgePhp}];
  $remove = static function($dir) use (&$remove) {
    if (!is_dir($dir)) return;
    foreach ((array) scandir($dir) as $item) {
      if ($item === '.' || $item === '..') continue;
      $p = $dir . DIRECTORY_SEPARATOR . $item;
      if (is_dir($p) && !is_link($p)) $remove($p); else @unlink($p);
    }
    @rmdir($dir);
  };
  register_rest_route($ns, '/publish', [
    'methods' => 'POST',
    'permission_callback' => '__return_true',
    'callback' => static function(WP_REST_Request $r) use ($token,$allowed,$purge,$remove) {
      $body = $r->get_json_params();
      if (!is_array($body) || !isset($body['token']) || !hash_equals($token,(string)$body['token'])) return new WP_Error('dtf_seed_auth','Invalid publish token.',['status'=>403]);
      $incoming = isset($body['files']) && is_array($body['files']) ? $body['files'] : [];
      if (count($incoming) !== count($allowed)) return new WP_Error('dtf_seed_count','File count mismatch.',['status'=>400]);
      $by=[];
      foreach($incoming as $file){$rel=(string)($file['rel']??'');if(!in_array($rel,$allowed,true)||isset($by[$rel]))return new WP_Error('dtf_seed_file','Unexpected file.',['status'=>400,'rel'=>$rel]);$by[$rel]=$file;}
      foreach($allowed as $rel) if(!isset($by[$rel])) return new WP_Error('dtf_seed_missing','Missing file.',['status'=>400,'rel'=>$rel]);
      $root=trailingslashit(wp_normalize_path(ABSPATH));
      $games=wp_normalize_path(ABSPATH.'games');
      $target=wp_normalize_path(ABSPATH.'games/seed-man-platformer');
      if(strpos($target,$root)!==0)return new WP_Error('dtf_seed_path','Unsafe target.',['status'=>500]);
      if(!is_dir($games)&&!wp_mkdir_p($games))return new WP_Error('dtf_seed_games','Cannot create games directory.',['status'=>500]);
      $nonce=wp_generate_uuid4();$stage=wp_normalize_path($games.'/.seed-man-stage-'.$nonce);$backup=wp_normalize_path($games.'/.seed-man-backup-'.$nonce);
      if(!wp_mkdir_p($stage))return new WP_Error('dtf_seed_stage','Cannot create stage.',['status'=>500]);
      $written=[];
      foreach($allowed as $rel){$f=$by[$rel];$raw=base64_decode((string)($f['content_b64']??''),true);$sha=strtolower((string)($f['sha256']??''));$size=(int)($f['size']??-1);
        if($raw===false||strlen($raw)!==$size||!preg_match('/^[a-f0-9]{64}$/',$sha)||!hash_equals($sha,hash('sha256',$raw))){$remove($stage);return new WP_Error('dtf_seed_payload','Payload integrity failed.',['status'=>400,'rel'=>$rel]);}
        $dest=wp_normalize_path($stage.'/'.$rel);$dir=dirname($dest);if(strpos($dest,trailingslashit($stage))!==0||(!is_dir($dir)&&!wp_mkdir_p($dir))){$remove($stage);return new WP_Error('dtf_seed_stage_path','Unsafe stage path.',['status'=>500]);}
        if(file_put_contents($dest,$raw,LOCK_EX)!==strlen($raw)||!hash_equals($sha,(string)hash_file('sha256',$dest))){$remove($stage);return new WP_Error('dtf_seed_write','Write failed.',['status'=>500,'rel'=>$rel]);}$written[$rel]=$sha;
      }
      $campaign=@file_get_contents($stage.'/data/campaign.json');$levels=@file_get_contents($stage.'/data/levels-20-v1.json');$art=@file_get_contents($stage.'/seed-man-production-art.js');$runtime=@file_get_contents($stage.'/campaign-v20-runtime.js');$combat=@file_get_contents($stage.'/combat-browser-v2.js');$enemyRuntime=@file_get_contents($stage.'/v20-enemy-runtime.js');
      if(!is_string($campaign)||strpos($campaign,'"levelCount": 20')===false||strpos($campaign,'"blight-king"')===false||!is_string($levels)||substr_count($levels,'"order":')<20||!is_string($art)||strpos($art,'approved-showcase-2026-09-08')===false||!is_string($runtime)||strpos($runtime,'levelCount:20')===false||!is_string($combat)||strpos($combat,'seed-man-combat-browser-v2')===false||!is_string($enemyRuntime)||strpos($enemyRuntime,'seed-man-v20-enemy-runtime-v2')===false){$remove($stage);return new WP_Error('dtf_seed_contract','Staged v20 contract failed.',['status'=>409]);}
      $had=is_dir($target);if($had&&!@rename($target,$backup)){$remove($stage);return new WP_Error('dtf_seed_backup','Backup failed.',['status'=>500]);}
      if(!@rename($stage,$target)){if($had)@rename($backup,$target);$remove($stage);return new WP_Error('dtf_seed_commit','Atomic publish failed.',['status'=>500]);}
      $verified=true;foreach($written as $rel=>$sha){$live=$target.'/'.$rel;if(!is_file($live)||!hash_equals($sha,(string)hash_file('sha256',$live))){$verified=false;break;}}
      if(!$verified){$remove($target);if($had)@rename($backup,$target);return new WP_Error('dtf_seed_verify','Server SHA verification failed; rolled back.',['status'=>500]);}
      if($had)$remove($backup);foreach($purge as $url)do_action('litespeed_purge_url',$url);do_action('litespeed_purge_all');if(function_exists('wp_cache_flush'))wp_cache_flush();
      return rest_ensure_response(['ok'=>true,'route'=>'/games/seed-man-platformer/','files'=>$written,'server_verified'=>true,'campaign_levels'=>20,'final_boss'=>'blight-king','approved_art'=>true,'combat_runtime'=>'v2','published_at'=>gmdate('c')]);
    }
  ]);
});
`.trim();

let snippetId=null;
try{
  const schema=await wp('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});
  if(!schema.ok)throw new Error('Code Snippets REST API unavailable; cannot create authenticated atomic publisher.');
  const created=await wp('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Seed Man v20 Publisher ${process.env.GITHUB_RUN_ID||Date.now()}`,desc:'Temporary atomic publisher for Seed Man 20-level approved-art release.',code:php,tags:['seed-man','temporary','v20'],scope:'global',priority:10,active:true}});
  snippetId=created.body?.id;
  if(!snippetId)throw new Error('Publisher snippet did not return an id.');
  const published=await wp(`/wp-json/${namespace}/publish`,{method:'POST',json:{token,files}});
  if(!published.body?.server_verified)throw new Error('Server verification did not pass.');
  console.log(JSON.stringify({...published.body,release},null,2));
}finally{
  if(snippetId){try{await wp(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`,{method:'POST',allow:[400,404,500]})}catch{}try{await wp(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404,500]})}catch{}}
}
