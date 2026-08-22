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
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WordPress request ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(1000 + attempt * 900); }
  }
  throw lastError;
}

async function queryPlugin() {
  const list = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!list.ok || !Array.isArray(list.body)) return null;
  return list.body.find(plugin => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(pluginId) {
  return `/wp-json/wp/v2/plugins/${String(pluginId).split('/').map(encodeURIComponent).join('/')}`;
}

async function waitForPlugin() {
  for (let i = 0; i < 8; i++) {
    const plugin = await queryPlugin().catch(() => null);
    if (plugin) return plugin;
    await sleep(1200 + i * 700);
  }
  return null;
}

async function waitForSnippetApi() {
  for (let i = 0; i < 10; i++) {
    const response = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] }).catch(() => null);
    if (response?.ok) return true;
    await sleep(1000 + i * 600);
  }
  return false;
}

let plugin = await queryPlugin();
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
const tokenLiteral = JSON.stringify(token);
const code = `
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    register_rest_route('dtf-repair/v1', '/inspect-shadow-files', [
        'methods' => 'GET',
        'permission_callback' => static function (WP_REST_Request $request) use ($token) {
            $supplied = (string) $request->get_header('x-dtf-repair-token');
            return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function () {
            $markers = [
                'old_home' => 'THC Grow Doc, genetics, cultivation education, and games in one home.',
                'old_learn' => 'Grow education belongs in a clean, readable library.',
                'old_learn_body' => 'MOPS, cultivation notes, THC basics',
                'old_infographics_1' => 'being rebuilt',
                'old_infographics_2' => 'Reserved strain card',
                'old_infographics_3' => 'Tool-ready rebuild',
                'new_home' => 'Genetics. Plant science. Tools. Games. Community.',
                'new_learn' => 'Explore by subject',
                'new_infographics' => 'Visual plant science and cultivation library.',
            ];
            $dirs = ['', 'learn/', 'learn/infographics/'];
            $names = ['index.html', 'index.htm', 'index.php', 'default.html', 'default.htm'];
            $files = [];
            foreach ($dirs as $dir) {
                foreach ($names as $name) {
                    $rel = $dir . $name;
                    $path = wp_normalize_path(ABSPATH . $rel);
                    $entry = [
                        'rel' => $rel,
                        'exists' => is_file($path),
                        'is_link' => is_link($path),
                        'readable' => is_readable($path),
                        'writable' => is_writable($path),
                        'dir_writable' => is_writable(dirname($path)),
                    ];
                    if ($entry['exists'] && $entry['readable']) {
                        $content = file_get_contents($path);
                        if ($content !== false) {
                            $entry['size'] = strlen($content);
                            $entry['sha256'] = hash('sha256', $content);
                            $entry['matches'] = [];
                            foreach ($markers as $key => $marker) {
                                if (stripos($content, $marker) !== false) $entry['matches'][] = $key;
                            }
                            if (preg_match('/<title[^>]*>(.*?)<\\/title>/is', $content, $m)) {
                                $entry['title'] = trim(wp_strip_all_tags(html_entity_decode($m[1])));
                            }
                        }
                    }
                    $files[] = $entry;
                }
            }
            return rest_ensure_response([
                'ok' => true,
                'wordpress_index_php_exists' => is_file(wp_normalize_path(ABSPATH . 'index.php')),
                'files' => $files,
            ]);
        },
    ]);
});
`.trim();

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
      name: `DTF Shadow Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary read-only diagnostic for known DTF static route candidates.',
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

  const result = await wpGetRetry('/wp-json/dtf-repair/v1/inspect-shadow-files', {
    headers: { 'X-DTF-Repair-Token': token },
  });
  if (result.body?.ok !== true) throw new Error('Filesystem diagnostic endpoint did not return success.');
  console.log(JSON.stringify(result.body));
} finally {
  await cleanup();
}
