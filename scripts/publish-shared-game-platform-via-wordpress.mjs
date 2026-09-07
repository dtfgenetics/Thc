import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const sourceRoot = path.resolve('site/public-route-patch/games/shared-platform');
const releaseFiles = [
  '.htaccess',
  'manifest.json',
  'index.mjs',
  'settings.mjs',
  'replay.mjs',
  'telemetry.mjs',
  'input.mjs',
  'audio.mjs',
];

const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
if (manifest.platformVersion !== '1.1.0') {
  throw new Error(`Unexpected shared platform version: ${manifest.platformVersion}`);
}
if (!Array.isArray(manifest.files) || manifest.files.length !== 6) {
  throw new Error('Shared platform manifest must declare six runtime modules.');
}
for (const rel of releaseFiles) {
  const filePath = path.join(sourceRoot, rel);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile() || fs.statSync(filePath).size === 0) {
    throw new Error(`Missing shared platform release file: ${rel}`);
  }
}
for (const moduleName of manifest.files) {
  if (!releaseFiles.includes(moduleName)) throw new Error(`Manifest file is not allowlisted: ${moduleName}`);
}

const files = releaseFiles.map((rel) => {
  const data = fs.readFileSync(path.join(sourceRoot, rel));
  return {
    rel,
    size: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
    content_b64: data.toString('base64'),
  };
});

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token = crypto.randomBytes(32).toString('hex');
const namespace = `dtf-game-platform-publish/v1-${crypto.randomBytes(8).toString('hex')}`;
const tokenLiteral = JSON.stringify(token);
const namespaceLiteral = JSON.stringify(namespace);
const versionLiteral = JSON.stringify(manifest.platformVersion);
const phpAllowed = releaseFiles.map((rel) => `'${rel.replaceAll("'", "\\'")}'`).join(',');
const purgeUrls = ['/games/shared-platform/', ...releaseFiles.map((rel) => `/games/shared-platform/${rel}`)];
const phpPurgeUrls = purgeUrls.map((url) => `'${url.replaceAll("'", "\\'")}'`).join(',');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let snippetId = null;
let pluginId = 'code-snippets/code-snippets';
let pluginWasActive = false;
let installedByRun = false;
let activatedByRun = false;

async function wpRequest(route, { method = 'GET', json, headers = {}, allow = [] } = {}) {
  const response = await fetch(`${siteUrl}${route}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    const detail = typeof body === 'string' ? body.slice(0, 1600) : JSON.stringify(body).slice(0, 1600);
    throw new Error(`WordPress ${method} ${route} failed (${response.status}): ${detail}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function queryPlugin() {
  const result = await wpRequest('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [401, 403, 404] });
  return result.ok && Array.isArray(result.body)
    ? result.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null
    : null;
}

function pluginEndpoint(id) {
  return `/wp-json/wp/v2/plugins/${String(id || pluginId).split('/').map(encodeURIComponent).join('/')}`;
}

async function setPluginStatus(id, status) {
  return wpRequest(pluginEndpoint(id), { method: 'POST', json: { status } });
}

async function waitForSnippetApi(safe = false) {
  const suffix = safe ? '?snippets-safe-mode=1' : '';
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const result = await wpRequest(`/wp-json/code-snippets/v1/snippets/schema${suffix}`, { allow: [404, 500] });
      if (result.ok) return true;
    } catch {}
    await sleep(700 + attempt * 350);
  }
  return false;
}

async function ensureSnippetApi() {
  let plugin = await queryPlugin();
  pluginWasActive = plugin?.status === 'active';
  if (plugin?.plugin) pluginId = plugin.plugin;

  const direct = await wpRequest('/wp-json/code-snippets/v1/snippets/schema', { allow: [404, 500] });
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
  if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API unavailable.');
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $namespace = ${namespaceLiteral};
    $version = ${versionLiteral};
    $allowed = [${phpAllowed}];
    $purge_urls = [${phpPurgeUrls}];

    $remove_tree = static function ($dir) use (&$remove_tree) {
        if (!is_dir($dir)) return;
        $items = scandir($dir);
        if ($items === false) return;
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $p = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($p) && !is_link($p)) $remove_tree($p); else @unlink($p);
        }
        @rmdir($dir);
    };

    register_rest_route($namespace, '/publish', [
        'methods' => 'POST',
        'permission_callback' => static function (WP_REST_Request $r) use ($token) {
            $supplied = (string) $r->get_header('x-dtf-game-platform-token');
            return $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function (WP_REST_Request $r) use ($allowed, $purge_urls, $remove_tree, $version) {
            $body = $r->get_json_params();
            $incoming = isset($body['files']) && is_array($body['files']) ? $body['files'] : [];
            if (count($incoming) !== count($allowed)) {
                return new WP_Error('dtf_platform_file_count', 'Shared platform file count mismatch.', ['status' => 400]);
            }

            $by = [];
            foreach ($incoming as $file) {
                $rel = (string) ($file['rel'] ?? '');
                if (!in_array($rel, $allowed, true) || isset($by[$rel])) {
                    return new WP_Error('dtf_platform_file_name', 'Unexpected or duplicate file.', ['status' => 400, 'rel' => $rel]);
                }
                $by[$rel] = $file;
            }
            foreach ($allowed as $rel) {
                if (!isset($by[$rel])) return new WP_Error('dtf_platform_missing', 'Missing file.', ['status' => 400, 'rel' => $rel]);
            }

            $root = trailingslashit(wp_normalize_path(ABSPATH));
            $games = wp_normalize_path(ABSPATH . 'games');
            $target = wp_normalize_path(ABSPATH . 'games/shared-platform');
            if (strpos($target, $root) !== 0) return new WP_Error('dtf_platform_path', 'Unsafe destination.', ['status' => 500]);
            if (!is_dir($games) && !wp_mkdir_p($games)) return new WP_Error('dtf_platform_games', 'Cannot create games directory.', ['status' => 500]);

            $nonce = wp_generate_uuid4();
            $stage = wp_normalize_path(ABSPATH . 'games/.shared-platform-stage-' . $nonce);
            $backup = wp_normalize_path(ABSPATH . 'games/.shared-platform-backup-' . $nonce);
            if (!wp_mkdir_p($stage)) return new WP_Error('dtf_platform_stage', 'Cannot create stage.', ['status' => 500]);

            $written = [];
            foreach ($allowed as $rel) {
                $file = $by[$rel];
                $raw = base64_decode((string) ($file['content_b64'] ?? ''), true);
                $sha = strtolower((string) ($file['sha256'] ?? ''));
                $size = (int) ($file['size'] ?? -1);
                if ($raw === false || !preg_match('/^[a-f0-9]{64}$/', $sha) || strlen($raw) !== $size || !hash_equals($sha, hash('sha256', $raw))) {
                    $remove_tree($stage);
                    return new WP_Error('dtf_platform_payload', 'Payload integrity failed.', ['status' => 400, 'rel' => $rel]);
                }
                $dest = wp_normalize_path($stage . '/' . $rel);
                if (strpos($dest, trailingslashit($stage)) !== 0) {
                    $remove_tree($stage);
                    return new WP_Error('dtf_platform_stage_path', 'Unsafe stage path.', ['status' => 500, 'rel' => $rel]);
                }
                if (file_put_contents($dest, $raw, LOCK_EX) !== strlen($raw) || !hash_equals($sha, (string) hash_file('sha256', $dest))) {
                    $remove_tree($stage);
                    return new WP_Error('dtf_platform_write', 'Stage write failed.', ['status' => 500, 'rel' => $rel]);
                }
                $written[$rel] = $sha;
            }

            $manifest_raw = @file_get_contents($stage . '/manifest.json');
            $manifest = is_string($manifest_raw) ? json_decode($manifest_raw, true) : null;
            $index = @file_get_contents($stage . '/index.mjs');
            if (!is_array($manifest) || ($manifest['platformVersion'] ?? '') !== $version || !is_string($index) || strpos($index, 'DTF_GAME_PLATFORM_VERSION') === false) {
                $remove_tree($stage);
                return new WP_Error('dtf_platform_markers', 'Invalid shared platform release markers.', ['status' => 409]);
            }

            $had = is_dir($target);
            if ($had && !@rename($target, $backup)) {
                $remove_tree($stage);
                return new WP_Error('dtf_platform_backup', 'Cannot backup current route.', ['status' => 500]);
            }
            if (!@rename($stage, $target)) {
                if ($had) @rename($backup, $target);
                $remove_tree($stage);
                return new WP_Error('dtf_platform_commit', 'Atomic publish failed.', ['status' => 500]);
            }

            $verified = true;
            foreach ($written as $rel => $sha) {
                $live = $target . '/' . $rel;
                if (!is_file($live) || !hash_equals($sha, (string) hash_file('sha256', $live))) {
                    $verified = false;
                    break;
                }
            }
            if (!$verified) {
                $remove_tree($target);
                if ($had) @rename($backup, $target);
                return new WP_Error('dtf_platform_verify', 'Server verification failed; rolled back.', ['status' => 500]);
            }
            if ($had) $remove_tree($backup);

            foreach ($purge_urls as $url) do_action('litespeed_purge_url', $url);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            clearstatcache();

            return rest_ensure_response([
                'ok' => true,
                'route' => '/games/shared-platform/',
                'version' => $version,
                'files' => $written,
                'server_verified' => true,
                'published_at' => gmdate('c'),
            ]);
        }
    ]);
});
`.trim();

async function cleanup() {
  if (snippetId) {
    let suffix = '';
    if (!(await waitForSnippetApi()) && await waitForSnippetApi(true)) suffix = '?snippets-safe-mode=1';
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate${suffix}`, { method: 'POST', allow: [400, 404, 500] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
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
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Shared Game Platform Publisher ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: `Temporary authenticated publisher for shared game platform ${manifest.platformVersion}.`,
      code: snippetCode,
      tags: ['dtf', 'temporary', 'game-platform'],
      scope: 'global',
      active: false,
    },
  });
  snippetId = created.body?.id;
  if (!snippetId) throw new Error('Could not create temporary shared platform publisher snippet.');

  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });
  const result = await wpRequest(`/wp-json/${namespace}/publish`, {
    method: 'POST',
    headers: { 'X-DTF-Game-Platform-Token': token },
    json: { files },
  });
  if (result.body?.server_verified !== true || result.body?.version !== manifest.platformVersion) {
    throw new Error(`Shared platform publication verification failed: ${JSON.stringify(result.body).slice(0, 1600)}`);
  }
  console.log(JSON.stringify(result.body, null, 2));
} finally {
  await cleanup();
}
