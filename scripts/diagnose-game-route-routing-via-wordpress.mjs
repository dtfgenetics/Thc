import fs from 'node:fs';
import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const repairToken = crypto.randomBytes(32).toString('hex');
const tokenLiteral = JSON.stringify(repairToken);
let snippetId = null;
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedByProbe = false;
let activatedByProbe = false;
let pluginRestId = 'code-snippets/code-snippets';

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
    throw new Error(`WordPress request ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(900 + attempt * 700); }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

async function queryCodeSnippetsPlugin() {
  const list = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!list.ok || !Array.isArray(list.body)) return null;
  return list.body.find(plugin => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(pluginId) {
  return `/wp-json/wp/v2/plugins/${String(pluginId || 'code-snippets/code-snippets').split('/').map(encodeURIComponent).join('/')}`;
}

async function setPluginStatus(pluginId, status) {
  return wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status } });
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const check = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
      if (check.ok) return true;
    } catch {}
    await sleep(900 + attempt * 500);
  }
  return false;
}

async function installCodeSnippetsNative() {
  let installError;
  try {
    const result = await wpRequest('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
    if (result.body?.plugin) return result.body;
  } catch (error) { installError = error; }
  for (let attempt = 1; attempt <= 8; attempt++) {
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
        $supplied = (string) $request->get_header('x-dtf-routing-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };

    $normalize_root = static function ($root) {
        if (!is_string($root) || $root === '') return '';
        $real = realpath($root);
        return wp_normalize_path($real !== false ? $real : $root);
    };

    $file_meta = static function ($path) {
        if (!is_file($path)) return null;
        $size = (int) @filesize($path);
        return [
            'name' => basename($path),
            'size' => $size,
            'sha256' => $size <= 4 * 1024 * 1024 ? @hash_file('sha256', $path) : null,
            'mtime' => @filemtime($path) ?: null,
        ];
    };

    $inspect_dir = static function ($base, $rel) use ($file_meta) {
        $base = trailingslashit(wp_normalize_path($base));
        $path = wp_normalize_path($base . ltrim($rel, '/'));
        if (strpos($path, $base) !== 0) return ['rel' => $rel, 'unsafe' => true];
        $out = [
            'rel' => $rel,
            'path' => $path,
            'exists' => file_exists($path) || is_link($path),
            'is_dir' => is_dir($path),
            'is_file' => is_file($path),
            'realpath' => ($r = realpath($path)) !== false ? wp_normalize_path($r) : null,
            'entries' => [],
        ];
        if (is_file($path)) {
            $out['file'] = $file_meta($path);
            return $out;
        }
        if (!is_dir($path)) return $out;
        $items = @scandir($path);
        if (!is_array($items)) return $out;
        $count = 0;
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            if (++$count > 120) { $out['truncated'] = true; break; }
            $child = $path . '/' . $item;
            $entry = [
                'name' => $item,
                'type' => is_link($child) ? 'link' : (is_dir($child) ? 'dir' : (is_file($child) ? 'file' : 'other')),
            ];
            if (is_file($child)) {
                $entry['size'] = (int) @filesize($child);
                if (in_array(strtolower($item), ['index.html','index.htm','index.php','.htaccess','app.js','high-iq.css','grower-conversations.css'], true)) {
                    $entry['sha256'] = @hash_file('sha256', $child);
                }
            }
            $out['entries'][] = $entry;
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
            if (count($lines) >= 80) break;
        }
        return $lines;
    };

    register_rest_route('dtf-routing-diagnostic/v1', '/state', [
        'methods' => 'GET',
        'permission_callback' => $permission,
        'callback' => static function () use ($normalize_root, $inspect_dir, $routing_directives) {
            $abspath = $normalize_root(ABSPATH);
            $docroot = $normalize_root((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
            $bases = ['abspath' => $abspath];
            if ($docroot !== '') $bases['document_root'] = $docroot;
            $relative = ['games', 'games/index.html', 'games/.htaccess', 'games/high-iq', 'games/grower-conversations'];
            $trees = [];
            $rules = [];
            foreach ($bases as $label => $base) {
                $trees[$label] = [];
                foreach ($relative as $rel) $trees[$label][$rel] = $inspect_dir($base, $rel);
                $rules[$label] = [
                    '.htaccess' => $routing_directives(trailingslashit($base) . '.htaccess'),
                    'games/.htaccess' => $routing_directives(trailingslashit($base) . 'games/.htaccess'),
                    'games/high-iq/.htaccess' => $routing_directives(trailingslashit($base) . 'games/high-iq/.htaccess'),
                    'games/grower-conversations/.htaccess' => $routing_directives(trailingslashit($base) . 'games/grower-conversations/.htaccess'),
                ];
            }
            return rest_ensure_response([
                'ok' => true,
                'roots' => [
                    'abspath' => $abspath,
                    'document_root' => $docroot,
                    'same_root' => $abspath !== '' && $docroot !== '' && $abspath === $docroot,
                ],
                'server' => [
                    'software' => (string) ($_SERVER['SERVER_SOFTWARE'] ?? ''),
                    'php_sapi' => php_sapi_name(),
                    'script_filename' => wp_normalize_path((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')),
                ],
                'wordpress' => [
                    'home' => home_url('/'),
                    'siteurl' => site_url('/'),
                    'permalink_structure' => (string) get_option('permalink_structure', ''),
                ],
                'trees' => $trees,
                'routing_directives' => $rules,
            ]);
        },
    ]);
});
`.trim();

async function cleanupTemporaryTools() {
  if (snippetId) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (installedByProbe && !pluginWasInstalled) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByProbe && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function titleFromHtml(text) {
  const match = String(text).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim().slice(0, 180) : null;
}

const markerList = [
  'Pick what is playable. See what is coming next.',
  'High IQ — Test Higher Cognition',
  'Grower Conversations',
  '/games/dtf-route.css',
  '/assets/dtf-gateway-v2.css',
  'server-engine alpha',
  'implementation gates',
];

async function httpProbe(path) {
  const url = new URL(path, siteUrl);
  url.searchParams.set('dtf_routing_probe', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  try {
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
        'User-Agent': 'DTFSeeds-Routing-Diagnostic/1.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    const lower = text.toLowerCase();
    return {
      path,
      requested: url.toString(),
      status: response.status,
      location: response.headers.get('location'),
      contentType: response.headers.get('content-type'),
      server: response.headers.get('server'),
      cacheControl: response.headers.get('cache-control'),
      liteSpeedCache: response.headers.get('x-litespeed-cache'),
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      bodyBytes: Buffer.byteLength(text),
      bodySha256: sha256Text(text),
      title: titleFromHtml(text),
      markers: Object.fromEntries(markerList.map(marker => [marker, lower.includes(marker.toLowerCase())])),
    };
  } catch (error) {
    return { path, error: error.message };
  }
}

function localExpected() {
  const files = [
    'site/public-route-patch/games/index.html',
    'site/public-route-patch/games/high-iq/index.html',
    'site/public-route-patch/games/grower-conversations/index.html',
    'site/public-route-patch/games/dtf-route.css',
  ];
  return Object.fromEntries(files.map(path => {
    const raw = fs.readFileSync(path);
    return [path, { bytes: raw.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') }];
  }));
}

try {
  const prePlugin = await queryCodeSnippetsPlugin();
  pluginWasInstalled = Boolean(prePlugin);
  pluginWasActive = prePlugin?.status === 'active';
  if (prePlugin?.plugin) pluginRestId = prePlugin.plugin;

  const apiWasReady = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (!apiWasReady.ok) {
    let plugin = prePlugin;
    if (!plugin) { plugin = await installCodeSnippetsNative(); installedByProbe = true; }
    if (plugin?.plugin) pluginRestId = plugin.plugin;
    if (plugin?.status !== 'active') {
      const activated = await setPluginStatus(pluginRestId, 'active');
      activatedByProbe = true;
      if (activated.body?.plugin) pluginRestId = activated.body.plugin;
    } else if (!pluginWasActive) activatedByProbe = true;
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available for routing diagnostic.');
  }

  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Game Routing Diagnostic ${runId}`,
      desc: 'Temporary read-only diagnostic for DTF game route document-root and rewrite precedence.',
      code: snippetCode,
      tags: ['dtf-diagnostic', 'temporary', 'read-only'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary routing diagnostic snippet was created without an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const serverState = await wpRequest('/wp-json/dtf-routing-diagnostic/v1/state', {
    headers: { 'X-DTF-Routing-Token': repairToken },
  });
  if (serverState.body?.ok !== true) throw new Error('Routing diagnostic endpoint did not return success.');

  const probePaths = [
    '/games/',
    '/games/index.html',
    '/games/dtf-route.css',
    '/games/high-iq/',
    '/games/high-iq/index.html',
    '/games/high-iq/index.php',
    '/games/grower-conversations/',
    '/games/grower-conversations/index.html',
    '/games/grower-conversations/index.php',
  ];
  const http = [];
  for (const path of probePaths) http.push(await httpProbe(path));

  console.log(JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    localExpected: localExpected(),
    serverState: serverState.body,
    http,
  }, null, 2));
} finally {
  await cleanupTemporaryTools();
}
