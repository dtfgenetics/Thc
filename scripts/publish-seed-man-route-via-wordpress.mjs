import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password)throw new Error('WordPress credentials are required.');

const root=path.resolve('site/public-route-patch/games/seed-man-platformer');
const worldFiles=['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'].map((world)=>`assets/worlds/${world}-bg-v1.webp`);
const releaseFiles=[
  '.htaccess','index.html','app.js','canvas-compat-v1.js','release-truth-v1.js','player-state-v20.js','campaign-v20-runtime.js','campaign-ui-v20.js',
  'approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','three-world-v1.js','three-world-adapter-v1.js',
  'v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','enemy-attacks.js','input-guard-v1.js','seed-man.css',
  'assets/approved/seed-man-character-atlas-v2.webp','assets/approved/seed-man-enemy-boss-atlas-v1.webp','assets/approved/seed-man-platform-atlas-v1.webp',
  ...worldFiles,
  'data/campaign.json','data/levels-20-v1.json','data/seed-man-art-manifest-v1.json','data/enemy-catalog-v1.json','data/boss-catalog-v1.json'
];
const retiredFiles=[
  'data/level-01.json','data/levels-12-15.json','campaign-v1.js','gameplay-v2.js','physics.mjs','campaign-combat-v20.js','campaign-progress-v20.js','campaign-runtime-v20.js',
  'campaign-ui-v15.js','world-five-v1.js','combat-browser-v1.js','enemy-attacks-browser-v1.js','seed-man-ui-v3.js',
  'assets/approved/seed-man-approved-master-atlas-v1.webp','assets/approved/seed-man-cover-banner-approved-v1.webp'
];
for(const rel of releaseFiles){const p=path.join(root,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)throw new Error(`Missing release file: ${rel}`);}
for(const rel of retiredFiles)if(fs.existsSync(path.join(root,rel)))throw new Error(`Retired release file still present: ${rel}`);

const campaign=JSON.parse(fs.readFileSync(path.join(root,'data/campaign.json'),'utf8'));
const levels=JSON.parse(fs.readFileSync(path.join(root,'data/levels-20-v1.json'),'utf8'));
const artManifest=JSON.parse(fs.readFileSync(path.join(root,'data/seed-man-art-manifest-v1.json'),'utf8'));
if(campaign.levelCount!==20||campaign.worlds?.length!==5||campaign.finalBoss!=='blight-king'||levels.levels?.length!==20)throw new Error('Seed Man v20 campaign contract is not ready to publish.');
if(artManifest.schemaVersion!==4||artManifest.id!=='seed-man-art-manifest-v3'||artManifest.sourceOfTruth!=='classic-seed-man-oval-v1'||artManifest.masterAtlas)throw new Error('Seed Man repaired art contract is not ready to publish.');
if(artManifest.policy?.characterReference!=='classic-seed-man-oval-v1'||artManifest.policy?.currentCharacterAtlasStatus!=='temporary-green-armored-replacement-pending')throw new Error('Seed Man character transition contract is not ready to publish.');
if(artManifest.policy?.worldRendererTarget!=='seed-man-three-world-v2'||artManifest.policy?.worldFallbackRenderer!=='seed-man-authored-flat-background-v1'||artManifest.policy?.finalWorldLayerCount!==7)throw new Error('Seed Man world transition contract is not ready to publish.');
for(const world of ['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']){
  const asset=artManifest.assets?.[`world.${world}.background`];
  if(!asset?.src||asset.renderer!=='seed-man-authored-flat-background-v1'||asset.temporaryFlattened!==true)throw new Error(`Seed Man authored world background is not ready: ${world}`);
}

const indexText=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const legacy of ['id="seed-man-level"','Seed Man: Sprout Run','Greenhouse Gauntlet','campaign-v1.js','gameplay-v2.js','campaign-ui-v15.js','world-five-v1.js','levels-12-15.json','combat-browser-v1.js','enemy-attacks-browser-v1.js','APPROVED ART · THREE.JS WORLDS','approved green-armored character art'])if(indexText.includes(legacy))throw new Error(`Legacy or misleading Seed Man runtime cannot be published: ${legacy}`);
for(const required of ['20260913-v20-runtime-repair-v2','AUTHORED WORLD ART','release-truth-v1.js','three-world-v1.js','campaign-v20-runtime.js','campaign-ui-v20.js','v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','player-state-v20.js'])if(!indexText.includes(required))throw new Error(`Seed Man public index missing repaired runtime: ${required}`);

const appText=fs.readFileSync(path.join(root,'app.js'),'utf8');
for(const marker of ['seed-man-base-runtime-v20',"campaignAuthority:'campaign-v20-runtime.js'",'level.boss && !level.boss.defeated'])if(!appText.includes(marker))throw new Error(`Seed Man base runtime missing marker: ${marker}`);
for(const stale of ['readEmbeddedLevel','worldWidth !== 7800','pickups.length !== 24'])if(appText.includes(stale))throw new Error(`Retired Sprout Run bootstrap remains: ${stale}`);

const compatText=fs.readFileSync(path.join(root,'canvas-compat-v1.js'),'utf8');
for(const marker of ['seed-man-runtime-health-v21','seed-man-authored-flat-background-v1','seed-man-runtime-mechanics-v1','legacyDynamicLoader: false','legacyCanvasMonkeyPatch: false'])if(!compatText.includes(marker))throw new Error(`Seed Man repaired runtime bridge missing marker: ${marker}`);
const truthText=fs.readFileSync(path.join(root,'release-truth-v1.js'),'utf8');
for(const marker of ['seed-man-release-truth-v1','classic-seed-man-oval-v1','AUTHORED WORLD ART'])if(!truthText.includes(marker))throw new Error(`Seed Man release truth guard missing marker: ${marker}`);
const threeText=fs.readFileSync(path.join(root,'three-world-v1.js'),'utf8');
if(!threeText.includes('SeedManThreeWorld')||!threeText.includes('seed-man-three-public-v3')||!threeText.includes('seed-man-three-world-v2')||Buffer.byteLength(threeText)<250000)throw new Error('Generated Seed Man Three.js world bundle is missing or still a compatibility stub.');
const playerStateText=fs.readFileSync(path.join(root,'player-state-v20.js'),'utf8');
if(!playerStateText.includes('seed-man-player-state-v20'))throw new Error('Seed Man v20 player-state marker is missing.');
const combatText=fs.readFileSync(path.join(root,'combat-browser-v2.js'),'utf8');
for(const marker of ['seed-man-combat-browser-v2','syncBossState','seedman:boss-defeated','pierceRemaining','chainTargets:3','freezeSeconds:1.8','resolveStomp'])if(!combatText.includes(marker))throw new Error(`Seed Man combat repair marker missing: ${marker}`);
const approvedCoreText=fs.readFileSync(path.join(root,'approved-art-core-v1.js'),'utf8');
for(const marker of ['seed-man-art-core-v5','classic-seed-man-oval-v1','temporary-green-armored-replacement-pending','seed-man-authored-flat-background-v1','finalWorldLayerTarget:7'])if(!approvedCoreText.includes(marker))throw new Error(`Seed Man art transition core missing marker: ${marker}`);
if(approvedCoreText.includes('seed-man-approved-master-atlas-v1.webp'))throw new Error('Corrupt master atlas cannot be published.');

for(const rel of ['assets/approved/seed-man-character-atlas-v2.webp','assets/approved/seed-man-enemy-boss-atlas-v1.webp','assets/approved/seed-man-platform-atlas-v1.webp',...worldFiles]){
  const data=fs.readFileSync(path.join(root,rel));
  if(data.subarray(0,4).toString('ascii')!=='RIFF'||data.subarray(8,12).toString('ascii')!=='WEBP')throw new Error(`Invalid WebP: ${rel}`);
}

const release=indexText.match(/data-seed-man-release="([^"]+)"/)?.[1]||'20260913-v20-runtime-repair-v2';
const files=releaseFiles.map((rel)=>{const data=fs.readFileSync(path.join(root,rel));return{rel,size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),content_b64:data.toString('base64')}});
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token=crypto.randomBytes(32).toString('hex');
const namespace=`dtf-seed-man-publish/v20-${crypto.randomBytes(8).toString('hex')}`;
const allowedPhp=releaseFiles.map((rel)=>`'${rel.replaceAll("'","\\'")}'`).join(',');
const purgePhp=['/games/seed-man-platformer/',...releaseFiles.map((r)=>`/games/seed-man-platformer/${r}`),...retiredFiles.map((r)=>`/games/seed-man-platformer/${r}`)].map((u)=>`'${u.replaceAll("'","\\'")}'`).join(',');
const retiredPhp=retiredFiles.map((rel)=>`'${rel.replaceAll("'","\\'")}'`).join(',');

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
  $retired = [${retiredPhp}];
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
    'callback' => static function(WP_REST_Request $r) use ($token,$allowed,$retired,$purge,$remove) {
      $body=$r->get_json_params();
      if(!is_array($body)||!isset($body['token'])||!hash_equals($token,(string)$body['token']))return new WP_Error('dtf_seed_auth','Invalid publish token.',['status'=>403]);
      $incoming=isset($body['files'])&&is_array($body['files'])?$body['files']:[];
      if(count($incoming)!==count($allowed))return new WP_Error('dtf_seed_count','File count mismatch.',['status'=>400]);
      $by=[];foreach($incoming as $file){$rel=(string)($file['rel']??'');if(!in_array($rel,$allowed,true)||isset($by[$rel]))return new WP_Error('dtf_seed_file','Unexpected file.',['status'=>400,'rel'=>$rel]);$by[$rel]=$file;}
      foreach($allowed as $rel)if(!isset($by[$rel]))return new WP_Error('dtf_seed_missing','Missing file.',['status'=>400,'rel'=>$rel]);
      $root=trailingslashit(wp_normalize_path(ABSPATH));$games=wp_normalize_path(ABSPATH.'games');$target=wp_normalize_path(ABSPATH.'games/seed-man-platformer');
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
      $campaign=@file_get_contents($stage.'/data/campaign.json');$levels=@file_get_contents($stage.'/data/levels-20-v1.json');$manifest=@file_get_contents($stage.'/data/seed-man-art-manifest-v1.json');$index=@file_get_contents($stage.'/index.html');$app=@file_get_contents($stage.'/app.js');$art=@file_get_contents($stage.'/seed-man-production-art.js');$artCore=@file_get_contents($stage.'/approved-art-core-v1.js');$truth=@file_get_contents($stage.'/release-truth-v1.js');$compat=@file_get_contents($stage.'/canvas-compat-v1.js');$three=@file_get_contents($stage.'/three-world-v1.js');$runtime=@file_get_contents($stage.'/campaign-v20-runtime.js');$combat=@file_get_contents($stage.'/combat-browser-v2.js');$enemyRuntime=@file_get_contents($stage.'/v20-enemy-runtime.js');$playerState=@file_get_contents($stage.'/player-state-v20.js');
      $validWebp=static function($file){if(!is_file($file)||filesize($file)<16)return false;$h=@file_get_contents($file,false,null,0,12);return is_string($h)&&substr($h,0,4)==='RIFF'&&substr($h,8,4)==='WEBP';};
      $worlds=['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'];$worldsOk=true;foreach($worlds as $world){if(!$validWebp($stage.'/assets/worlds/'.$world.'-bg-v1.webp')){$worldsOk=false;break;}}
      if(!is_string($campaign)||strpos($campaign,'"levelCount": 20')===false||strpos($campaign,'"blight-king"')===false||!is_string($levels)||substr_count($levels,'"order":')<20||!is_string($manifest)||strpos($manifest,'"schemaVersion": 4')===false||strpos($manifest,'seed-man-art-manifest-v3')===false||strpos($manifest,'classic-seed-man-oval-v1')===false||strpos($manifest,'temporary-green-armored-replacement-pending')===false||strpos($manifest,'seed-man-approved-master-atlas-v1.webp')!==false||!is_string($index)||strpos($index,'20260913-v20-runtime-repair-v2')===false||strpos($index,'AUTHORED WORLD ART')===false||strpos($index,'id="seed-man-level"')!==false||!is_string($app)||strpos($app,'seed-man-base-runtime-v20')===false||strpos($app,'readEmbeddedLevel')!==false||!is_string($art)||strpos($art,'classic-seed-man-transition-v1')===false||strpos($art,'classic-seed-man-oval-v1')===false||!is_string($artCore)||strpos($artCore,'seed-man-art-core-v5')===false||strpos($artCore,'seed-man-authored-flat-background-v1')===false||strpos($artCore,'seed-man-approved-master-atlas-v1.webp')!==false||!is_string($truth)||strpos($truth,'seed-man-release-truth-v1')===false||!is_string($compat)||strpos($compat,'seed-man-runtime-health-v21')===false||strpos($compat,'seed-man-runtime-mechanics-v1')===false||!is_string($three)||strlen($three)<250000||strpos($three,'seed-man-three-public-v3')===false||!is_string($runtime)||strpos($runtime,'seed-man-campaign-v20-runtime-v3')===false||!is_string($combat)||strpos($combat,'seed-man-combat-browser-v2')===false||strpos($combat,'syncBossState')===false||strpos($combat,'pierceRemaining')===false||strpos($combat,'chainTargets:3')===false||strpos($combat,'freezeSeconds:1.8')===false||strpos($combat,'resolveStomp')===false||!is_string($enemyRuntime)||strpos($enemyRuntime,'seed-man-v20-enemy-runtime-v2')===false||!is_string($playerState)||strpos($playerState,'seed-man-player-state-v20')===false||!$validWebp($stage.'/assets/approved/seed-man-character-atlas-v2.webp')||!$validWebp($stage.'/assets/approved/seed-man-enemy-boss-atlas-v1.webp')||!$validWebp($stage.'/assets/approved/seed-man-platform-atlas-v1.webp')||!$worldsOk){$remove($stage);return new WP_Error('dtf_seed_contract','Staged repaired v20 contract failed.',['status'=>409]);}
      foreach($retired as $rel)if(file_exists($stage.'/'.$rel)){$remove($stage);return new WP_Error('dtf_seed_retired','Retired file staged.',['status'=>409,'rel'=>$rel]);}
      $had=is_dir($target);if($had&&!@rename($target,$backup)){$remove($stage);return new WP_Error('dtf_seed_backup','Backup failed.',['status'=>500]);}
      if(!@rename($stage,$target)){if($had)@rename($backup,$target);$remove($stage);return new WP_Error('dtf_seed_commit','Atomic publish failed.',['status'=>500]);}
      $verified=true;foreach($written as $rel=>$sha){$live=$target.'/'.$rel;if(!is_file($live)||!hash_equals($sha,(string)hash_file('sha256',$live))){$verified=false;break;}}
      foreach($retired as $rel)if(file_exists($target.'/'.$rel)){$verified=false;break;}
      if(!$verified){$remove($target);if($had)@rename($backup,$target);return new WP_Error('dtf_seed_verify','Server verification failed; rolled back.',['status'=>500]);}
      if($had)$remove($backup);foreach($purge as $url)do_action('litespeed_purge_url',$url);do_action('litespeed_purge_all');if(function_exists('wp_cache_flush'))wp_cache_flush();
      return rest_ensure_response(['ok'=>true,'route'=>'/games/seed-man-platformer/','release'=>'20260913-v20-runtime-repair-v2','files'=>$written,'server_verified'=>true,'campaign_levels'=>20,'worlds'=>5,'final_boss'=>'blight-king','character_target'=>'classic-seed-man-oval-v1','current_character_status'=>'temporary-legacy-replacement-pending','world_presentation'=>'authored-flat-transition','world_renderer_target'=>'seed-man-three-world-v2','legacy_sprout_run'=>false,'corrupt_master_atlas'=>false,'player_state'=>'v20','combat_runtime'=>'v2-repaired','published_at'=>gmdate('c')]);
    }
  ]);
});
`.trim();

let snippetId=null;
try{
  const schema=await wp('/wp-json/code-snippets/v1/snippets/schema',{allow:[404,500]});
  if(!schema.ok)throw new Error('Code Snippets REST API unavailable; cannot create authenticated atomic publisher.');
  const created=await wp('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Seed Man v20 Publisher ${process.env.GITHUB_RUN_ID||Date.now()}`,desc:'Temporary atomic publisher for the repaired Seed Man canonical 20-level release.',code:php,tags:['seed-man','temporary','v20'],scope:'global',priority:10,active:true}});
  snippetId=created.body?.id;
  if(!snippetId)throw new Error('Publisher snippet did not return an id.');
  const published=await wp(`/wp-json/${namespace}/publish`,{method:'POST',json:{token,files}});
  if(!published.body?.server_verified)throw new Error('Server verification did not pass.');
  console.log(JSON.stringify({...published.body,release},null,2));
}finally{
  if(snippetId){try{await wp(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`,{method:'POST',allow:[400,404,500]})}catch{}try{await wp(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404,500]})}catch{}}
}
