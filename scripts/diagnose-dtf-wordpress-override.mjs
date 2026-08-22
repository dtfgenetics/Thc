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
    headers: { Authorization: auth, Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: 'follow',
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) throw new Error(`WP ${method} ${path} failed (${response.status})`);
  return { ok: response.ok, status: response.status, body };
}

async function wpGetRetry(path, options = {}) {
  let last;
  for (let i = 1; i <= 6; i++) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (e) { last = e; await sleep(1000 + i * 900); }
  }
  throw last;
}

function pluginEndpoint(id) {
  return `/wp-json/wp/v2/plugins/${String(id || 'code-snippets/code-snippets').split('/').map(encodeURIComponent).join('/')}`;
}

async function queryPlugin() {
  const r = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!r.ok || !Array.isArray(r.body)) return null;
  return r.body.find(p => String(p?.plugin || '').startsWith('code-snippets/')) || null;
}

async function waitForPlugin() {
  for (let i = 0; i < 8; i++) {
    const p = await queryPlugin().catch(() => null);
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

let plugin = await queryPlugin();
const pluginWasInstalled = Boolean(plugin);
const pluginWasActive = plugin?.status === 'active';
let installed = false;
let activated = false;
let pluginId = plugin?.plugin || 'code-snippets/code-snippets';
let snippetId = 0;

async function cleanup() {
  if (snippetId) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (installed && !pluginWasInstalled) {
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400,404] }); } catch {}
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'DELETE', allow: [400,404] }); } catch {}
  } else if (activated && !pluginWasActive) {
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400,404] }); } catch {}
  }
}

const token = crypto.randomBytes(32).toString('hex');
const code = `
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    register_rest_route('dtf-repair/v1', '/override-owner', [
        'methods' => 'GET',
        'permission_callback' => static function (WP_REST_Request $request) use ($token) {
            $supplied = (string) $request->get_header('x-dtf-repair-token');
            return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function () {
            $rel = 'wp-content/mu-plugins/dtf-homepage-override.php';
            $path = wp_normalize_path(ABSPATH . $rel);
            $exists = is_file($path) && is_readable($path);
            $content = $exists ? file_get_contents($path) : '';
            if ($content === false) $content = '';
            $hints = [];
            if ($content !== '') {
                foreach (preg_split('/\\R/', $content) as $i => $line) {
                    if (preg_match('/add_(?:action|filter)|template_redirect|template_include|is_front_page|is_home|is_page|REQUEST_URI|index\\.html|learn|readfile|file_get_contents|include|require|echo|print|exit|die/i', $line)) {
                        $clean = trim(preg_replace('/\\s+/', ' ', $line));
                        if ($clean !== '') $hints[] = ['line' => $i + 1, 'text' => substr($clean, 0, 220)];
                    }
                    if (count($hints) >= 40) break;
                }
            }
            $closure_rows = [];
            global $wp_filter;
            foreach (['template_redirect','template_include','the_content','wp','parse_request'] as $hook_name) {
                $hook = $wp_filter[$hook_name] ?? null;
                if (!$hook || !isset($hook->callbacks) || !is_array($hook->callbacks)) continue;
                foreach ($hook->callbacks as $priority => $callbacks) {
                    foreach ($callbacks as $entry) {
                        $cb = $entry['function'] ?? null;
                        if (!($cb instanceof Closure)) continue;
                        try {
                            $ref = new ReflectionFunction($cb);
                            $file = wp_normalize_path((string) $ref->getFileName());
                            if (strpos($file, wp_normalize_path(ABSPATH)) === 0) $file = ltrim(substr($file, strlen(wp_normalize_path(ABSPATH))), '/');
                            $closure_rows[] = ['hook' => $hook_name, 'priority' => (int) $priority, 'file' => $file, 'line' => (int) $ref->getStartLine()];
                        } catch (Throwable $e) {}
                    }
                }
            }
            return rest_ensure_response([
                'ok' => true,
                'mu_override' => [
                    'path' => $rel,
                    'exists' => $exists,
                    'size' => $exists ? filesize($path) : 0,
                    'sha256' => $exists ? hash_file('sha256', $path) : null,
                    'markers' => [
                        'old_home' => stripos($content, 'THC Grow Doc, genetics, cultivation education, and games in one home.') !== false,
                        'old_learn' => stripos($content, 'Grow education belongs in a clean, readable library.') !== false || stripos($content, 'MOPS, cultivation notes, THC basics') !== false,
                        'current_home' => stripos($content, 'Genetics. Plant science. Tools. Games. Community.') !== false,
                        'current_learn' => stripos($content, 'Explore by subject') !== false,
                    ],
                    'behavior' => [
                        'front_page' => preg_match('/is_front_page|is_home|REQUEST_URI[^\\n]*(?:\\/|home)/i', $content) === 1,
                        'learn' => preg_match('/is_page\\s*\\([^)]*learn|REQUEST_URI[^\\n]*learn|\\/learn\\//i', $content) === 1,
                        'direct_output' => preg_match('/readfile|file_get_contents|echo|print|include|require|exit|die/i', $content) === 1,
                    ],
                    'hints' => $hints,
                ],
                'closures' => $closure_rows,
            ]);
        },
    ]);
});
`.trim();

try {
  const ready = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (!ready.ok) {
    if (!plugin) {
      try {
        const r = await wpRequest('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
        plugin = r.body;
        installed = true;
      } catch (e) {
        plugin = await waitForPlugin();
        if (!plugin) throw e;
      }
    }
    pluginId = plugin?.plugin || pluginId;
    if (plugin?.status !== 'active') {
      const r = await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'active' } });
      plugin = r.body;
      activated = true;
    }
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets API did not become available.');
  }

  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Override Owner Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary read-only source ownership diagnostic for DTF stale WordPress renders.',
      code,
      tags: ['dtf-repair','diagnostic','temporary'],
      scope: 'global', priority: 1, active: false, network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Diagnostic snippet missing ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });
  const result = await wpGetRetry('/wp-json/dtf-repair/v1/override-owner', { headers: { 'X-DTF-Repair-Token': token } });
  if (result.body?.ok !== true) throw new Error('Override owner endpoint failed.');
  console.log(JSON.stringify(result.body));
} finally {
  await cleanup();
}
