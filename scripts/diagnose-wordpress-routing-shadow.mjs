import crypto from 'node:crypto';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
if(!user||!pass) throw new Error('WordPress credentials required');
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function request(path,{method='GET',json,headers={},allow=[]}={}){
  const response=await fetch(`${siteUrl}${path}`,{
    method,
    headers:{Authorization:auth,Accept:'application/json',...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},
    body:json!==undefined?JSON.stringify(json):undefined,
  });
  const text=await response.text();
  let body=text; try{body=text?JSON.parse(text):null}catch{}
  if(!response.ok&&!allow.includes(response.status)) throw new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
  return {ok:response.ok,status:response.status,body};
}

async function getRetry(path,options={}){
  let last;
  for(let i=1;i<=6;i++){
    try{return await request(path,{...options,method:'GET'})}catch(e){last=e;await sleep(1000+i*800)}
  }
  throw last;
}

async function queryPlugin(){
  const r=await getRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100');
  return Array.isArray(r.body)?r.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null:null;
}

function pluginPath(id){return `/wp-json/wp/v2/plugins/${String(id).split('/').map(encodeURIComponent).join('/')}`}
async function setPluginStatus(id,status){return request(pluginPath(id),{method:'POST',json:{status}})}

let pre=await queryPlugin();
const pluginWasInstalled=Boolean(pre);
const pluginWasActive=pre?.status==='active';
let installedByDiagnostic=false;
let activatedByDiagnostic=false;
let pluginId=pre?.plugin||'code-snippets/code-snippets';

if(!pre){
  const installed=await request('/wp-json/wp/v2/plugins',{method:'POST',json:{slug:'code-snippets',status:'active'}});
  pre=installed.body;
  installedByDiagnostic=true;
  activatedByDiagnostic=true;
  if(pre?.plugin) pluginId=pre.plugin;
}else if(pre.status!=='active'){
  const activated=await setPluginStatus(pluginId,'active');
  activatedByDiagnostic=true;
  if(activated.body?.plugin) pluginId=activated.body.plugin;
}

let apiReady=false;
for(let i=1;i<=10;i++){
  const r=await getRetry('/wp-json/code-snippets/v1/snippets/schema',{allow:[404]});
  if(r.ok){apiReady=true;break}
  await sleep(1000+i*500);
}
if(!apiReady) throw new Error('Code Snippets API unavailable after native WordPress activation');

const token=crypto.randomBytes(32).toString('hex');
const snippet=`
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    register_rest_route('dtf-diagnostic/v1', '/routing-shadow', [
        'methods' => 'GET',
        'permission_callback' => static function (WP_REST_Request $request) use ($token) {
            $supplied = (string) $request->get_header('x-dtf-diagnostic-token');
            return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function () {
            $normalize = static fn($p) => rtrim(wp_normalize_path((string) $p), '/');
            $abs = $normalize(ABSPATH);
            $doc = $normalize($_SERVER['DOCUMENT_ROOT'] ?? '');
            $parent = $normalize(dirname(ABSPATH));
            $roots = [
                'ABSPATH' => $abs,
                'DOCUMENT_ROOT' => $doc,
                'PARENT_ABSPATH' => $parent,
            ];
            $files = ['index.html','index.htm','default.html','home.html','learn/index.html','learn/infographics/index.html'];
            $markers = [
                'old_home' => 'THC Grow Doc, genetics, cultivation education, and games in one home.',
                'old_learn' => 'Grow education belongs in a clean, readable library.',
                'old_learn_2' => 'MOPS, cultivation notes, THC basics',
                'old_infographics' => 'being rebuilt',
                'current_home' => 'Genetics. Plant science. Tools. Games. Community.',
                'current_learn' => 'Explore by subject',
                'current_infographics' => 'Visual plant science and cultivation library.',
            ];
            $inventory = [];
            $seen = [];
            foreach ($roots as $label => $root) {
                if ($root === '') continue;
                foreach ($files as $rel) {
                    $path = $normalize($root . '/' . $rel);
                    if (isset($seen[$path])) continue;
                    $seen[$path] = true;
                    $row = ['root' => $label, 'rel' => $rel, 'exists' => is_file($path)];
                    if ($row['exists']) {
                        $content = file_get_contents($path);
                        $row['size'] = is_string($content) ? strlen($content) : null;
                        $row['sha12'] = is_string($content) ? substr(hash('sha256', $content), 0, 12) : null;
                        $row['markers'] = [];
                        if (is_string($content)) {
                            foreach ($markers as $name => $marker) {
                                if (stripos($content, $marker) !== false) $row['markers'][] = $name;
                            }
                        }
                    }
                    $inventory[] = $row;
                }
            }

            $front_id = (int) get_option('page_on_front');
            $front = $front_id ? get_post($front_id) : null;
            $front_content = $front ? (string) $front->post_content : '';
            $home_page = get_page_by_path('home', OBJECT, 'page');
            $home_content = $home_page ? (string) $home_page->post_content : '';

            return rest_ensure_response([
                'document_root_equals_abspath' => $doc !== '' && $doc === $abs,
                'document_root_is_parent_of_abspath' => $doc !== '' && str_starts_with($abs . '/', $doc . '/'),
                'abspath_is_parent_of_document_root' => $doc !== '' && str_starts_with($doc . '/', $abs . '/'),
                'show_on_front' => get_option('show_on_front'),
                'page_on_front' => $front_id,
                'page_for_posts' => (int) get_option('page_for_posts'),
                'front_page' => $front ? [
                    'id' => (int) $front->ID,
                    'slug' => $front->post_name,
                    'status' => $front->post_status,
                    'title' => get_the_title($front),
                    'content_length' => strlen($front_content),
                    'has_current_home_marker' => stripos($front_content, 'Genetics. Plant science. Tools. Games. Community.') !== false,
                    'has_old_home_marker' => stripos($front_content, 'THC Grow Doc, genetics, cultivation education, and games in one home.') !== false,
                ] : null,
                'home_slug_page' => $home_page ? [
                    'id' => (int) $home_page->ID,
                    'status' => $home_page->post_status,
                    'title' => get_the_title($home_page),
                    'content_length' => strlen($home_content),
                    'has_current_home_marker' => stripos($home_content, 'Genetics. Plant science. Tools. Games. Community.') !== false,
                    'has_old_home_marker' => stripos($home_content, 'THC Grow Doc, genetics, cultivation education, and games in one home.') !== false,
                ] : null,
                'files' => $inventory,
            ]);
        },
    ]);
});
`.trim();

let snippetId=0;
try{
  const created=await request('/wp-json/code-snippets/v1/snippets',{method:'POST',json:{name:`DTF Routing Diagnostic ${process.env.GITHUB_RUN_ID||Date.now()}`,desc:'Temporary read-only routing/static-shadow diagnostic.',code:snippet,tags:['dtf-diagnostic','temporary'],scope:'global',priority:1,active:false,network:false}});
  snippetId=Number(created.body?.id||0);
  if(!snippetId) throw new Error('Diagnostic snippet ID missing');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`,{method:'POST'});

  let result=null;
  for(let i=1;i<=6;i++){
    const r=await getRetry('/wp-json/dtf-diagnostic/v1/routing-shadow',{headers:{'X-DTF-Diagnostic-Token':token},allow:[404]});
    if(r.ok){result=r.body;break}
    await sleep(1000+i*500);
  }
  if(!result) throw new Error('Temporary routing diagnostic endpoint did not become available');
  console.log(JSON.stringify(result));
}finally{
  if(snippetId){
    try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`,{method:'POST',allow:[400,404]})}catch{}
    try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404]})}catch{}
    try{await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`,{method:'DELETE',allow:[404]})}catch{}
  }
  if(installedByDiagnostic&&!pluginWasInstalled){
    try{await setPluginStatus(pluginId,'inactive')}catch{}
    try{await request(pluginPath(pluginId),{method:'DELETE',allow:[400,404]})}catch{}
  }else if(activatedByDiagnostic&&!pluginWasActive){
    try{await setPluginStatus(pluginId,'inactive')}catch{}
  }
}
