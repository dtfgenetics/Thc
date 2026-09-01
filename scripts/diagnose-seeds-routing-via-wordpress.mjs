import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const repairToken = crypto.randomBytes(32).toString('hex');
const tokenLiteral = JSON.stringify(repairToken);

async function wpRequest(path, { method = 'GET', json, allow = [] } = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WordPress ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(900 + attempt * 700); }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

async function queryCodeSnippetsPlugin() {
  const list = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!list.ok || !Array.isArray(list.body)) return null;
  return list.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(pluginId) {
  const safe = String(pluginId || 'code-snippets/code-snippets').split('/').map(encodeURIComponent).join('/');
  return `/wp-json/wp/v2/plugins/${safe}`;
}

async function setPluginStatus(pluginId, status) {
  return wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status } });
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
      if (response.ok) return true;
    } catch {}
    await sleep(900 + attempt * 500);
  }
  return false;
}

async function installCodeSnippetsNative() {
  let installError;
  try {
    const result = await wpRequest('/wp-json/wp/v2/plugins', {
      method: 'POST',
      json: { slug: 'code-snippets', status: 'active' },
    });
    if (result.body?.plugin) return result.body;
  } catch (error) { installError = error; }
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const plugin = await queryCodeSnippetsPlugin().catch(() => null);
    if (plugin) return plugin;
    await sleep(1200 + attempt * 600);
  }
  throw installError || new Error('WordPress native plugin install did not produce Code Snippets.');
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_param('dtf_repair_token');
        return $supplied !== '' && hash_equals($token, $supplied);
    };

    $normalize_root = static function ($root) {
        if (!is_string($root) || $root === '') return '';
        $real = realpath($root);
        return wp_normalize_path($real !== false ? $real : $root);
    };

    $file_meta = static function ($path, $markers = []) {
        $exists = file_exists($path) || is_link($path);
        $out = [
            'exists' => $exists,
            'is_file' => is_file($path),
            'is_dir' => is_dir($path),
            'is_link' => is_link($path),
            'size' => is_file($path) ? (int) @filesize($path) : null,
            'mtime' => $exists ? (@filemtime($path) ?: null) : null,
            'sha256' => is_file($path) && @filesize($path) <= 4 * 1024 * 1024 ? @hash_file('sha256', $path) : null,
            'markers' => [],
        ];
        if (is_file($path) && @filesize($path) <= 4 * 1024 * 1024 && !empty($markers)) {
            $raw = @file_get_contents($path);
            if (is_string($raw)) {
                foreach ($markers as $label => $marker) $out['markers'][$label] = strpos($raw, $marker) !== false;
            }
        }
        return $out;
    };

    $routing_directives = static function ($path) {
        if (!is_file($path) || @filesize($path) > 256 * 1024) return [];
        $raw = @file($path, FILE_IGNORE_NEW_LINES);
        if (!is_array($raw)) return [];
        $lines = [];
        foreach ($raw as $line) {
            $trim = trim((string) $line);
            if ($trim === '' || $trim[0] === '#') continue;
            if (preg_match('/^(DirectoryIndex|FallbackResource|Options|RewriteEngine|RewriteBase|RewriteCond|RewriteRule)\b/i', $trim)) {
                $lines[] = substr($trim, 0, 500);
            }
            if (count($lines) >= 120) break;
        }
        return $lines;
    };

    register_rest_route('dtf-seeds-routing-diagnostic/v1', '/state', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($normalize_root, $file_meta, $routing_directives) {
            $abspath = $normalize_root(ABSPATH);
            $document_root = $normalize_root((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
            $root = $abspath;
            $stale = 'DTF Genetics catalog pages built around strain identity and grow context.';
            $canonical = 'DTF Genetics library';
            $profile = 'Open Blue Mango profile';
            $markers = ['stale_static' => $stale, 'genetics_library' => $canonical, 'blue_mango_profile' => $profile];
            $seeds_dir = trailingslashit($root) . 'seeds';

            return rest_ensure_response([
                'ok' => true,
                'roots' => [
                    'same_root' => $document_root !== '' && $abspath === $document_root,
                    'abspath_sha256' => hash('sha256', $abspath),
                    'document_root_sha256' => $document_root !== '' ? hash('sha256', $document_root) : null,
                ],
                'server' => [
                    'software' => (string) ($_SERVER['SERVER_SOFTWARE'] ?? ''),
                    'php_sapi' => PHP_SAPI,
                    'request_script' => basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')),
                ],
                'wordpress' => [
                    'home' => home_url('/'),
                    'siteurl' => site_url('/'),
                    'permalink_structure' => (string) get_option('permalink_structure'),
                ],
                'filesystem' => [
                    'root_htaccess' => $file_meta(trailingslashit($root) . '.htaccess'),
                    'root_routing_directives' => $routing_directives(trailingslashit($root) . '.htaccess'),
                    'seeds_dir' => $file_meta($seeds_dir),
                    'seeds_htaccess' => $file_meta(trailingslashit($seeds_dir) . '.htaccess'),
                    'seeds_routing_directives' => $routing_directives(trailingslashit($seeds_dir) . '.htaccess'),
                    'seeds_index_html' => $file_meta(trailingslashit($seeds_dir) . 'index.html', $markers),
                    'seeds_index_php' => $file_meta(trailingslashit($seeds_dir) . 'index.php', $markers),
                ],
            ]);
        },
    ]);
});
`.trim();

let snippetId = 0;
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedByProbe = false;
let activatedByProbe = false;
let pluginRestId = 'code-snippets/code-snippets';

async function cleanupTemporaryTools() {
  if (snippetId) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (activatedByProbe && pluginWasInstalled && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
  if (installedByProbe) {
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [404] }); } catch {}
  }
}

async function probeHttp(path) {
  const nonce = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const requested = `${siteUrl}${path}${path.includes('?') ? '&' : '?'}dtf_seeds_probe=${nonce}`;
  const response = await fetch(requested, {
    redirect: 'manual',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      'User-Agent': 'DTFSeeds-Seeds-Routing-Diagnostic/1.0',
    },
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  const lower = text.toLowerCase();
  const title = text.match(/<title[^>]*>([^<]{0,240})<\/title>/i)?.[1]?.trim() || null;
  return {
    path,
    status: response.status,
    location: response.headers.get('location'),
    server: response.headers.get('server'),
    contentType: response.headers.get('content-type'),
    cacheControl: response.headers.get('cache-control'),
    liteSpeedCache: response.headers.get('x-litespeed-cache'),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    bodyBytes: Buffer.byteLength(text),
    bodySha256: crypto.createHash('sha256').update(text).digest('hex'),
    title,
    markers: {
      stale_static: lower.includes('dtf genetics catalog pages built around strain identity and grow context.'),
      genetics_library: lower.includes('dtf genetics library'),
      blue_mango_profile: lower.includes('open blue mango profile'),
    },
  };
}

try {
  let plugin = await queryCodeSnippetsPlugin();
  pluginWasInstalled = Boolean(plugin);
  pluginWasActive = plugin?.status === 'active';
  if (!plugin) {
    plugin = await installCodeSnippetsNative();
    installedByProbe = true;
  }
  if (plugin?.plugin) pluginRestId = plugin.plugin;
  if (plugin?.status !== 'active') {
    const activated = await setPluginStatus(pluginRestId, 'active');
    activatedByProbe = true;
    if (activated.body?.plugin) pluginRestId = activated.body.plugin;
  }
  if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.');

  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Seeds Read-Only Routing Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary read-only filesystem/routing diagnostic for the public Seeds route.',
      code: snippetCode,
      tags: ['dtf-diagnostic', 'temporary', 'seeds'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary diagnostic snippet was created without a usable ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const state = await wpRequest('/wp-json/dtf-seeds-routing-diagnostic/v1/state', {
    method: 'POST',
    json: { dtf_repair_token: repairToken },
  });
  if (state.body?.ok !== true) throw new Error(`Diagnostic endpoint returned invalid state: ${JSON.stringify(state.body).slice(0, 700)}`);

  const paths = ['/seeds/', '/seeds/index.html', '/seeds/index.php'];
  const http = [];
  for (const path of paths) http.push(await probeHttp(path));

  console.log(JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    serverState: state.body,
    http,
  }, null, 2));
} finally {
  await cleanupTemporaryTools();
}
