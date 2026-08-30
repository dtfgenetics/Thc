import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token = crypto.randomBytes(32).toString('hex');
const namespace = `dtf-cache-purge/v1-${crypto.randomBytes(8).toString('hex')}`;
const tokenLiteral = JSON.stringify(token);
const namespaceLiteral = JSON.stringify(namespace);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let snippetId = null;
let pluginId = 'code-snippets/code-snippets';
let pluginWasActive = false;
let installedByRun = false;
let activatedByRun = false;

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
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WordPress ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 800) : JSON.stringify(body).slice(0, 800)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function queryPlugin() {
  const result = await wpRequest('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [401, 403, 404] });
  if (!result.ok || !Array.isArray(result.body)) return null;
  return result.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(id) {
  return `/wp-json/wp/v2/plugins/${String(id || pluginId).split('/').map(encodeURIComponent).join('/')}`;
}

async function setPluginStatus(id, status) {
  return wpRequest(pluginEndpoint(id), { method: 'POST', json: { status } });
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const result = await wpRequest('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
      if (result.ok) return true;
    } catch {}
    await sleep(700 + attempt * 400);
  }
  return false;
}

async function ensureSnippetApi() {
  let plugin = await queryPlugin();
  pluginWasActive = plugin?.status === 'active';
  if (plugin?.plugin) pluginId = plugin.plugin;

  const direct = await wpRequest('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (direct.ok) return;

  if (!plugin) {
    plugin = (await wpRequest('/wp-json/wp/v2/plugins', {
      method: 'POST',
      json: { slug: 'code-snippets', status: 'active' },
    })).body;
    installedByRun = true;
  }
  if (plugin?.plugin) pluginId = plugin.plugin;
  if (plugin?.status !== 'active') {
    const activated = await setPluginStatus(pluginId, 'active');
    activatedByRun = true;
    if (activated.body?.plugin) pluginId = activated.body.plugin;
  }
  if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.');
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $namespace = ${namespaceLiteral};
    register_rest_route($namespace, '/purge', [
        'methods' => 'POST',
        'permission_callback' => static function (WP_REST_Request $request) use ($token) {
            $supplied = (string) $request->get_header('x-dtf-cache-purge-token');
            if ($supplied === '') $supplied = (string) $request->get_param('_dtf_cache_purge_token');
            return $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function () {
            $urls = [
                '/games/seed-man-platformer/',
                '/games/seed-man-platformer/index.html',
                '/games/seed-man-platformer/app.js',
                '/games/seed-man-platformer/seed-man-production-art.js',
                '/games/seed-man-platformer/canvas-compat-v1.js',
                '/games/seed-man-platformer/input-guard-v1.js',
                '/games/seed-man-platformer/seed-man.css',
            ];

            // LiteSpeed Cache for WordPress documents these purge actions.
            if (function_exists('do_action')) {
                foreach ($urls as $url) do_action('litespeed_purge_url', $url);
                do_action('litespeed_purge_all');
            }

            // LiteSpeed Web Server also accepts a purge response header. The
            // endpoint is protected by a per-run random token and removed after use.
            if (!headers_sent()) header('X-LiteSpeed-Purge: *');
            if (function_exists('wp_cache_flush')) wp_cache_flush();

            return rest_ensure_response([
                'ok' => true,
                'purged' => $urls,
                'litespeed_hook_fired' => true,
                'wp_cache_flushed' => function_exists('wp_cache_flush'),
                'at' => gmdate('c'),
            ]);
        },
    ]);
});
`.trim();

async function cleanup() {
  if (snippetId) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (activatedByRun && !pluginWasActive && !installedByRun) {
    try { await setPluginStatus(pluginId, 'inactive'); } catch {}
  }
  if (installedByRun) {
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  }
}

try {
  await ensureSnippetApi();
  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF LiteSpeed Cache Purge ${runId}`,
      desc: 'Temporary authenticated cache purge after public game deployment.',
      code: snippetCode,
      tags: ['dtf-release', 'temporary', 'cache-purge'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary cache purge snippet was created without an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const result = await wpRequest(`/wp-json/${namespace}/purge`, {
    method: 'POST',
    headers: { 'X-DTF-Cache-Purge-Token': token },
    json: { _dtf_cache_purge_token: token },
  });
  if (result.body?.ok !== true) throw new Error(`Cache purge did not report success: ${JSON.stringify(result.body).slice(0, 700)}`);
  console.log(JSON.stringify({ ok: true, ...result.body }, null, 2));
} finally {
  await cleanup();
}
