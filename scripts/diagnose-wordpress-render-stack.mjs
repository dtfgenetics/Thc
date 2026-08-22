import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function wpRequest(path, { method = 'GET', json, headers = {}, allow = [] } = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: 'follow',
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WordPress request ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(1200 + attempt * 900); }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

function pluginEndpoint(pluginId) {
  return `/wp-json/wp/v2/plugins/${String(pluginId || 'code-snippets/code-snippets').split('/').map(encodeURIComponent).join('/')}`;
}

async function queryCodeSnippetsPlugin() {
  const r = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!r.ok || !Array.isArray(r.body)) return null;
  return r.body.find(p => String(p?.plugin || '').startsWith('code-snippets/')) || null;
}

async function waitForPlugin() {
  for (let i = 0; i < 8; i++) {
    const p = await queryCodeSnippetsPlugin().catch(() => null);
    if (p) return p;
    await sleep(1200 + i * 700);
  }
  return null;
}

async function waitForSnippetApi() {
  for (let i = 0; i < 10; i++) {
    const r = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] }).catch(() => null);
    if (r?.ok) return true;
    await sleep(1000 + i * 650);
  }
  return false;
}

let plugin = await queryCodeSnippetsPlugin();
const pluginWasInstalled = Boolean(plugin);
const pluginWasActive = plugin?.status === 'active';
let installedByDiagnostic = false;
let activatedByDiagnostic = false;
let pluginId = plugin?.plugin || 'code-snippets/code-snippets';
let snippetId = 0;

async function cleanup() {
  if (snippetId) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (installedByDiagnostic && !pluginWasInstalled) {
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400, 404] }); } catch {}
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByDiagnostic && !pluginWasActive) {
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400, 404] }); } catch {}
  }
}

const token = crypto.randomBytes(32).toString('hex');
const code = `
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    register_rest_route('dtf-repair/v1', '/render-stack', [
        'methods' => 'GET',
        'permission_callback' => static function (WP_REST_Request $request) use ($token) {
            $supplied = (string) $request->get_header('x-dtf-repair-token');
            return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function () {
            if (!function_exists('get_mu_plugins') || !function_exists('get_dropins')) {
                require_once ABSPATH . 'wp-admin/includes/plugin.php';
            }
            $callback_name = static function ($cb) {
                if (is_string($cb)) return $cb;
                if (is_array($cb) && count($cb) === 2) {
                    $left = is_object($cb[0]) ? get_class($cb[0]) : (string) $cb[0];
                    return $left . '::' . (string) $cb[1];
                }
                if ($cb instanceof Closure) return 'Closure';
                if (is_object($cb)) return get_class($cb);
                return gettype($cb);
            };
            $hook_rows = static function ($name) use ($callback_name) {
                global $wp_filter;
                $out = [];
                $hook = $wp_filter[$name] ?? null;
                if (!$hook || !isset($hook->callbacks) || !is_array($hook->callbacks)) return $out;
                foreach ($hook->callbacks as $priority => $callbacks) {
                    foreach ($callbacks as $entry) {
                        $out[] = ['priority' => (int) $priority, 'callback' => $callback_name($entry['function'] ?? null)];
                    }
                }
                return $out;
            };
            $dropins = [];
            $known = ['advanced-cache.php','object-cache.php','db.php','sunrise.php','maintenance.php'];
            $labels = function_exists('get_dropins') ? get_dropins() : [];
            foreach ($known as $file) {
                $path = wp_normalize_path(WP_CONTENT_DIR . '/' . $file);
                $exists = is_file($path);
                $dropins[] = [
                    'file' => $file,
                    'exists' => $exists,
                    'size' => $exists ? filesize($path) : 0,
                    'sha256' => $exists ? hash_file('sha256', $path) : null,
                    'label' => isset($labels[$file]['Name']) ? (string) $labels[$file]['Name'] : null,
                ];
            }
            $mu = [];
            foreach ((array) get_mu_plugins() as $file => $data) $mu[] = $file . (empty($data['Name']) ? '' : ' [' . $data['Name'] . ']');
            $meta = [];
            foreach ([743, 869] as $id) {
                $all = get_post_meta($id);
                $keys = array_keys(is_array($all) ? $all : []);
                sort($keys);
                $elementor = [];
                foreach (['_elementor_edit_mode','_elementor_template_type','_elementor_page_settings','_elementor_data','_wp_page_template'] as $key) {
                    if (!array_key_exists($key, $all)) continue;
                    $value = get_post_meta($id, $key, true);
                    $elementor[$key] = is_scalar($value) ? substr((string) $value, 0, 120) : gettype($value);
                }
                $meta[(string) $id] = [
                    'template' => (string) get_page_template_slug($id),
                    'keys' => array_values(array_filter($keys, static fn($k) => preg_match('/elementor|template|cache|hostinger|seedprod|litespeed/i', $k))),
                    'elementor' => $elementor ?: null,
                ];
            }
            return rest_ensure_response([
                'ok' => true,
                'wp_cache' => defined('WP_CACHE') ? (bool) WP_CACHE : null,
                'settings' => [
                    'show_on_front' => get_option('show_on_front'),
                    'page_on_front' => (int) get_option('page_on_front'),
                    'page_for_posts' => (int) get_option('page_for_posts'),
                    'stylesheet' => get_option('stylesheet'),
                    'template' => get_option('template'),
                    'permalink_structure' => get_option('permalink_structure'),
                ],
                'active_plugins' => array_values((array) get_option('active_plugins', [])),
                'mu_plugins' => $mu,
                'dropins' => $dropins,
                'hooks' => [
                    'parse_request' => $hook_rows('parse_request'),
                    'request' => $hook_rows('request'),
                    'pre_get_posts' => $hook_rows('pre_get_posts'),
                    'posts_pre_query' => $hook_rows('posts_pre_query'),
                    'wp' => $hook_rows('wp'),
                    'template_redirect' => $hook_rows('template_redirect'),
                    'template_include' => $hook_rows('template_include'),
                    'the_content' => $hook_rows('the_content'),
                ],
                'page_meta' => $meta,
            ]);
        },
    ]);
});
`.trim();

const renderDefs = [
  { path: '/index.php', current: 'Genetics. Plant science. Tools. Games. Community.', stale: 'THC Grow Doc, genetics, cultivation education, and games in one home.' },
  { path: '/index.php?page_id=743', current: 'Genetics. Plant science. Tools. Games. Community.', stale: 'THC Grow Doc, genetics, cultivation education, and games in one home.' },
  { path: '/learn/', current: 'Explore by subject', stale: 'Grow education belongs in a clean, readable library.' },
];

async function freshRender(def, suffix) {
  const joiner = def.path.includes('?') ? '&' : '?';
  const response = await fetch(`${siteUrl}${def.path}${joiner}dtf_stack=${encodeURIComponent(suffix)}`, {
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-RenderStack/1.0' },
    redirect: 'follow',
  });
  const text = await response.text();
  const headers = Object.fromEntries(response.headers.entries());
  const selected = {};
  for (const key of ['server','x-litespeed-cache','x-litespeed-tag','age','cache-control','cf-cache-status','x-cache','vary','x-powered-by']) {
    if (headers[key] !== undefined) selected[key] = headers[key];
  }
  return {
    path: def.path,
    status: response.status,
    current: text.toLowerCase().includes(def.current.toLowerCase()),
    stale: text.toLowerCase().includes(def.stale.toLowerCase()),
    headers: selected,
  };
}

try {
  const apiReady = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (!apiReady.ok) {
    if (!plugin) {
      try {
        const install = await wpRequest('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
        plugin = install.body;
        installedByDiagnostic = true;
      } catch (error) {
        plugin = await waitForPlugin();
        if (!plugin) throw error;
      }
    }
    pluginId = plugin?.plugin || pluginId;
    if (plugin?.status !== 'active') {
      const activated = await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'active' } });
      plugin = activated.body;
      activatedByDiagnostic = true;
    }
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets API did not become available.');
  }

  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Render Stack Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary authenticated read-only runtime inspection for DTFSeeds stale-render diagnosis.',
      code,
      tags: ['dtf-repair', 'diagnostic', 'temporary'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Diagnostic snippet did not return an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const runtime = await wpGetRetry('/wp-json/dtf-repair/v1/render-stack', { headers: { 'X-DTF-Repair-Token': token } });
  if (runtime.body?.ok !== true) throw new Error('Render-stack endpoint did not return success.');

  const renders = [];
  for (let i = 0; i < renderDefs.length; i++) {
    renders.push(await freshRender(renderDefs[i], `${process.env.GITHUB_RUN_ID || Date.now()}-${i}-${crypto.randomBytes(5).toString('hex')}`));
  }
  console.log(JSON.stringify({ ...runtime.body, renders }));
} finally {
  await cleanup();
}
