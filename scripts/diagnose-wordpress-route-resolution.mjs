import crypto from 'node:crypto';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WordPress credentials required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function request(path,{method='GET',json,headers={},allow=[]}={}){
  let last;
  const attempts=method==='GET'?8:1;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetch(`${site}${path}`,{method,headers:{Authorization:auth,Accept:'application/json',...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:json!==undefined?JSON.stringify(json):undefined,redirect:'follow'});
      const text=await response.text(); let body=text; try{body=text?JSON.parse(text):null}catch{}
      if(!response.ok&&!allow.includes(response.status)) throw new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return {ok:response.ok,status:response.status,body};
    }catch(error){last=error;if(attempt<attempts)await sleep(1200+attempt*900);}
  }
  throw last;
}

function markerFlags(content){
  const lower=String(content||'').toLowerCase();
  const has=x=>lower.includes(x.toLowerCase());
  return {
    currentHome:has('Genetics. Plant science. Tools. Games. Community.'),
    oldHome:has('THC Grow Doc, genetics, cultivation education, and games in one home.'),
    currentLearn:has('Explore by subject'),
    oldLearn:has('Grow education belongs in a clean, readable library.'),
    oldLearn2:has('MOPS, cultivation notes, THC basics'),
    currentInfographics:has('Visual plant science and cultivation library.'),
  };
}

function pageSummary(p){
  if(!p)return null;
  const content=String(p.content?.raw||p.content?.rendered||'');
  return {id:p.id,slug:p.slug,status:p.status,parent:p.parent,link:String(p.link||'').replace(site,''),title:p.title?.raw||p.title?.rendered||'',contentLength:content.length,markers:markerFlags(content)};
}

const [homeQuery,learnQuery,home743,learn869,inf877]=await Promise.all([
  request('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=100'),
  request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=100'),
  request('/wp-json/wp/v2/pages/743?context=edit',{allow:[404]}),
  request('/wp-json/wp/v2/pages/869?context=edit',{allow:[404]}),
  request('/wp-json/wp/v2/pages/877?context=edit',{allow:[404]}),
]);

const token=crypto.randomBytes(32).toString('hex');
function pluginPath(id){return `/wp-json/wp/v2/plugins/${String(id).split('/').map(encodeURIComponent).join('/')}`}
async function queryPlugin(){const r=await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100');return Array.isArray(r.body)?r.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null:null;}
let plugin=await queryPlugin();
const pluginOriginal={installed:Boolean(plugin),active:plugin?.status==='active'};
let pluginInstalled=false,pluginActivated=false,pluginId=plugin?.plugin||'code-snippets/code-snippets';
if(!plugin){const r=await request('/wp-json/wp/v2/plugins',{method:'POST',json:{slug:'code-snippets',status:'active'}});plugin=r.body;pluginId=plugin?.plugin||pluginId;pluginInstalled=true;pluginActivated=true;}
else if(plugin.status!=='active'){const r=await request(pluginPath(pluginId),{method:'POST',json:{status:'active'}});plugin=r.body;pluginActivated=true;}
let ready=false;for(let i=1;i<=12;i++){const r=await request('/wp-json/code-snippets/v1/snippets/schema',{allow:[404]});if(r.ok){ready=true;break}await sleep(900+i*500)}
if(!ready)throw new Error('Code Snippets REST API unavailable.');

const php=`
add_action('rest_api_init', function () {
    $token=${JSON.stringify(token)};
    register_rest_route('dtf-diagnostic/v1','/route-resolution',[
      'methods'=>'GET',
      'permission_callback'=>static function(WP_REST_Request $r) use($token){$v=(string)$r->get_header('x-dtf-route-token');return current_user_can('manage_options')&&$v!==''&&hash_equals($token,$v);},
      'callback'=>static function(){
        global $wp_rewrite;
        $flags=static function($content){
          $content=strtolower((string)$content);
          $has=static fn($x)=>strpos($content,strtolower($x))!==false;
          return [
            'current_home'=>$has('Genetics. Plant science. Tools. Games. Community.'),
            'old_home'=>$has('THC Grow Doc, genetics, cultivation education, and games in one home.'),
            'current_learn'=>$has('Explore by subject'),
            'old_learn'=>$has('Grow education belongs in a clean, readable library.'),
            'old_learn_2'=>$has('MOPS, cultivation notes, THC basics'),
          ];
        };
        $describe=static function($path,$rel) use($flags){
          $row=['rel'=>$rel,'exists'=>is_file($path),'is_dir'=>is_dir($path)];
          if(is_file($path)){
            $row['size']=filesize($path);
            $row['sha12']=substr(hash_file('sha256',$path),0,12);
            $row['readable']=is_readable($path);
            $row['writable']=is_writable($path);
            $ext=strtolower(pathinfo($path,PATHINFO_EXTENSION));
            if(in_array($ext,['html','htm','php'],true)&&filesize($path)<=1000000){$c=@file_get_contents($path);if(is_string($c))$row['markers']=$flags($c);}
          }
          return $row;
        };
        $root=trailingslashit(wp_normalize_path(ABSPATH));
        $root_files=[];
        foreach(['index.html','index.htm','index.php','.htaccess','wp-blog-header.php'] as $rel)$root_files[]=$describe($root.$rel,$rel);
        $learn_dir=$root.'learn/';
        $learn_files=[];
        if(is_dir($learn_dir)){
          $names=@scandir($learn_dir);
          if(is_array($names))foreach($names as $name){
            if($name==='.'||$name==='..')continue;
            if(!preg_match('/^[A-Za-z0-9._-]+$/',$name))continue;
            $learn_files[]=$describe($learn_dir.$name,'learn/'.$name);
          }
        }
        $htaccess=[];
        $ht=$root.'.htaccess';
        if(is_file($ht)&&is_readable($ht)){
          $lines=preg_split('/\\r?\\n/',(string)file_get_contents($ht));
          foreach($lines as $line){
            $trim=trim($line);
            if($trim===''||str_starts_with($trim,'#'))continue;
            if(preg_match('/^(DirectoryIndex|RewriteEngine|RewriteBase|RewriteCond|RewriteRule)\\b/i',$trim))$htaccess[]=substr($trim,0,300);
          }
        }
        $rules=get_option('rewrite_rules',[]);
        $root_rules=[];
        if(is_array($rules))foreach($rules as $pattern=>$target){if($pattern==='^$'||$pattern==='$'||str_contains($pattern,'learn'))$root_rules[]=[$pattern,$target];if(count($root_rules)>=15)break;}
        return rest_ensure_response([
          'home_url'=>home_url('/'),
          'site_url'=>site_url('/'),
          'show_on_front'=>get_option('show_on_front'),
          'page_on_front'=>(int)get_option('page_on_front'),
          'permalink_structure'=>get_option('permalink_structure'),
          'using_permalinks'=>(bool)$wp_rewrite->using_permalinks(),
          'root_files'=>$root_files,
          'learn_directory_exists'=>is_dir($learn_dir),
          'learn_files'=>$learn_files,
          'htaccess_rewrite_lines'=>$htaccess,
          'rewrite_rule_count'=>is_array($rules)?count($rules):0,
          'selected_rewrite_rules'=>$root_rules,
          'server'=>[
            'software'=>$_SERVER['SERVER_SOFTWARE']??null,
            'gateway'=>$_SERVER['GATEWAY_INTERFACE']??null,
            'script_name'=>$_SERVER['SCRIPT_NAME']??null,
          ],
        ]);
      }
    ]);
});`.trim();

let snippetId=0,server={};
try{
  const created=await request('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Route Resolution ${process.env.GITHUB_RUN_ID||Date.now()}`,desc:'Temporary read-only route resolution diagnostic.',code:php,tags:['dtf-diagnostic','temporary'],scope:'global',priority:1,active:false,network:false}});
  snippetId=Number(created.body?.id||0);if(!snippetId)throw new Error('Diagnostic snippet ID missing.');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`,{method:'POST'});
  for(let i=1;i<=8;i++){const r=await request('/wp-json/dtf-diagnostic/v1/route-resolution',{headers:{'X-DTF-Route-Token':token},allow:[404]});if(r.ok){server=r.body;break}await sleep(900+i*500)}
  if(!server?.root_files)throw new Error('Route resolution endpoint did not return data.');
}finally{
  if(snippetId){try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`,{method:'POST',allow:[400,404]})}catch{};try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404]})}catch{};try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404]})}catch{};}
  if(pluginInstalled&&!pluginOriginal.installed){try{await request(pluginPath(pluginId),{method:'POST',json:{status:'inactive'}})}catch{};try{await request(pluginPath(pluginId),{method:'DELETE',allow:[400,404]})}catch{};}
  else if(pluginActivated&&!pluginOriginal.active){try{await request(pluginPath(pluginId),{method:'POST',json:{status:'inactive'}})}catch{};}
}

console.log(JSON.stringify({generatedAt:new Date().toISOString(),pages:{homeBySlug:(homeQuery.body||[]).map(pageSummary),learnBySlug:(learnQuery.body||[]).map(pageSummary),id743:home743.ok?pageSummary(home743.body):null,id869:learn869.ok?pageSummary(learn869.body):null,id877:inf877.ok?pageSummary(inf877.body):null},server}));
