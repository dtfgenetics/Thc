import crypto from 'node:crypto';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const sourceSha = String(process.env.THC_LEARNING_SOURCE_SHA || '').trim().toLowerCase();
const siteSha = String(process.env.GITHUB_SHA || '').trim().toLowerCase();
const workflowRunId = String(process.env.GITHUB_RUN_ID || '').trim();
const workflowRunAttempt = String(process.env.GITHUB_RUN_ATTEMPT || '').trim();

if (!username || !password) throw new Error('WordPress credentials are required.');
if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('THC_LEARNING_SOURCE_SHA must be a full 40-character Git SHA.');
if (siteSha && !/^[0-9a-f]{40}$/.test(siteSha)) throw new Error('GITHUB_SHA must be a full 40-character Git SHA when supplied.');

const publishedAt = new Date().toISOString();
const buildId = `dtf-academy-${sourceSha.slice(0, 12)}-${workflowRunId || 'manual'}`;
const identity = {
  service: 'thc-academy-wordpress',
  sourceRepository: 'dtfgenetics/Thc-learning-courses-',
  sourceSha,
  siteRepository: process.env.GITHUB_REPOSITORY || 'dtfgenetics/Thc',
  siteSha: siteSha || null,
  workflowRunId: workflowRunId || null,
  workflowRunAttempt: workflowRunAttempt || null,
  buildId,
  publishedAt,
};

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const token = crypto.randomBytes(32).toString('hex');
const namespace = `dtf-academy-identity-deploy/v1-${crypto.randomBytes(8).toString('hex')}`;
const muPluginFile = 'dtf-academy-build-identity.php';

let pluginId = 'code-snippets/code-snippets';
let pluginWasInstalled = false;
let pluginWasActive = false;
let activatedByRun = false;
let installedByRun = false;
let snippetId = 0;

async function request(path, { method = 'GET', json, headers = {}, allow = [], authenticated = true } = {}) {
  let lastError;
  const attempts = method === 'GET' ? 6 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${site}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(authenticated ? { Authorization: auth } : {}),
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok && !allow.includes(response.status)) {
        const detail = typeof body === 'string' ? body.slice(0, 1200) : JSON.stringify(body).slice(0, 1200);
        throw new Error(`${method} ${path} failed (${response.status}): ${detail}`);
      }
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(800 + attempt * 700);
    }
  }
  throw lastError;
}

function pluginEndpoint(id) {
  return `/wp-json/wp/v2/plugins/${String(id || pluginId).split('/').map(encodeURIComponent).join('/')}`;
}

async function queryCodeSnippetsPlugin() {
  const response = await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [401, 403, 404] });
  if (!response.ok || !Array.isArray(response.body)) return null;
  return response.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = await request('/wp-json/code-snippets/v1/snippets/schema', { allow: [404, 500] });
    if (response.ok) return true;
    await sleep(700 + attempt * 350);
  }
  return false;
}

async function ensureSnippetApi() {
  let plugin = await queryCodeSnippetsPlugin();
  pluginWasInstalled = Boolean(plugin);
  pluginWasActive = plugin?.status === 'active';
  if (plugin?.plugin) pluginId = plugin.plugin;

  const direct = await request('/wp-json/code-snippets/v1/snippets/schema', { allow: [404, 500] });
  if (direct.ok) return;

  if (!plugin) {
    const installed = await request('/wp-json/wp/v2/plugins', {
      method: 'POST',
      json: { slug: 'code-snippets', status: 'active' },
    });
    plugin = installed.body;
    installedByRun = true;
    activatedByRun = true;
    if (plugin?.plugin) pluginId = plugin.plugin;
  } else if (plugin.status !== 'active') {
    const activated = await request(pluginEndpoint(pluginId), {
      method: 'POST',
      json: { status: 'active' },
    });
    activatedByRun = true;
    if (activated.body?.plugin) pluginId = activated.body.plugin;
  }

  if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.');
}

const muPlugin = String.raw`<?php
/**
 * Plugin Name: DTF Academy Build Identity
 * Description: Read-only deployment identity for the public THC Academy course surface.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) { exit; }

function dtf_academy_build_identity_payload_v1() {
    $identity = get_option('dtf_academy_build_identity_v1', []);
    if (!is_array($identity)) { $identity = []; }

    $source_sha = strtolower((string)($identity['sourceSha'] ?? ''));
    $build_id = (string)($identity['buildId'] ?? '');
    $exact = $build_id !== '' && preg_match('/^[0-9a-f]{40}$/', $source_sha) === 1;

    return [
        'service' => 'thc-academy-wordpress',
        'sourceRepository' => 'dtfgenetics/Thc-learning-courses-',
        'buildId' => $build_id,
        'sourceSha' => $source_sha,
        'siteRepository' => (string)($identity['siteRepository'] ?? 'dtfgenetics/Thc'),
        'siteSha' => (string)($identity['siteSha'] ?? ''),
        'workflowRunId' => (string)($identity['workflowRunId'] ?? ''),
        'workflowRunAttempt' => (string)($identity['workflowRunAttempt'] ?? ''),
        'publishedAt' => (string)($identity['publishedAt'] ?? ''),
        'exactIdentityAvailable' => $exact,
    ];
}

add_action('rest_api_init', static function () {
    register_rest_route('dtf-academy/v1', '/build-info', [
        'methods' => WP_REST_Server::READABLE,
        'callback' => static function () {
            $response = rest_ensure_response(dtf_academy_build_identity_payload_v1());
            $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return $response;
        },
        'permission_callback' => '__return_true',
    ]);
});

add_action('parse_request', static function ($wp) {
    $request = trim((string)($wp->request ?? ''), '/');
    if ($request !== 'api/build-info') { return; }

    status_header(200);
    nocache_headers();
    header('Content-Type: application/json; charset=' . get_option('blog_charset'));
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo wp_json_encode(dtf_academy_build_identity_payload_v1());
    exit;
}, 0);
`;

const muPluginSha = crypto.createHash('sha256').update(muPlugin).digest('hex');

const bridgeCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    $namespace = ${JSON.stringify(namespace)};
    $file_name = ${JSON.stringify(muPluginFile)};

    register_rest_route($namespace, '/publish', [
        'methods' => 'POST',
        'permission_callback' => static function (WP_REST_Request $request) use ($token) {
            $supplied = (string)$request->get_header('x-dtf-academy-token');
            return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function (WP_REST_Request $request) use ($file_name) {
            $body = $request->get_json_params();
            $plugin_b64 = (string)($body['plugin_b64'] ?? '');
            $plugin_sha = strtolower((string)($body['plugin_sha256'] ?? ''));
            $identity = isset($body['identity']) && is_array($body['identity']) ? $body['identity'] : [];

            $source_sha = strtolower((string)($identity['sourceSha'] ?? ''));
            $build_id = (string)($identity['buildId'] ?? '');
            if (!preg_match('/^[0-9a-f]{40}$/', $source_sha) || $build_id === '') {
                return new WP_Error('dtf_academy_identity_invalid', 'Invalid source SHA or build ID.', ['status' => 400]);
            }
            if (!preg_match('/^[a-f0-9]{64}$/', $plugin_sha)) {
                return new WP_Error('dtf_academy_plugin_hash', 'Invalid plugin hash.', ['status' => 400]);
            }

            $plugin_raw = base64_decode($plugin_b64, true);
            if ($plugin_raw === false || !hash_equals($plugin_sha, hash('sha256', $plugin_raw))) {
                return new WP_Error('dtf_academy_plugin_payload', 'MU-plugin payload integrity failed.', ['status' => 400]);
            }
            if (strpos($plugin_raw, 'DTF Academy Build Identity') === false || strpos($plugin_raw, 'dtf_academy_build_identity_payload_v1') === false) {
                return new WP_Error('dtf_academy_plugin_marker', 'MU-plugin marker validation failed.', ['status' => 400]);
            }

            $dir = wp_normalize_path(WPMU_PLUGIN_DIR);
            if (!is_dir($dir) && !wp_mkdir_p($dir)) {
                return new WP_Error('dtf_academy_mu_dir', 'Unable to create MU-plugin directory.', ['status' => 500]);
            }

            $root = trailingslashit(wp_normalize_path(WP_CONTENT_DIR));
            $target = wp_normalize_path($dir . '/' . $file_name);
            if (strpos($target, $root) !== 0) {
                return new WP_Error('dtf_academy_mu_path', 'Unsafe MU-plugin destination.', ['status' => 500]);
            }

            $nonce = wp_generate_uuid4();
            $stage = $target . '.stage-' . $nonce;
            $backup = $target . '.backup-' . $nonce;
            $had = is_file($target);

            if (file_put_contents($stage, $plugin_raw, LOCK_EX) !== strlen($plugin_raw) ||
                !is_file($stage) ||
                !hash_equals($plugin_sha, (string)hash_file('sha256', $stage))) {
                @unlink($stage);
                return new WP_Error('dtf_academy_mu_stage', 'Unable to stage MU-plugin.', ['status' => 500]);
            }

            if ($had && !@rename($target, $backup)) {
                @unlink($stage);
                return new WP_Error('dtf_academy_mu_backup', 'Unable to back up current MU-plugin.', ['status' => 500]);
            }
            if (!@rename($stage, $target)) {
                if ($had) { @rename($backup, $target); }
                @unlink($stage);
                return new WP_Error('dtf_academy_mu_commit', 'Unable to commit MU-plugin.', ['status' => 500]);
            }

            clearstatcache(true, $target);
            if (!is_file($target) || !hash_equals($plugin_sha, (string)hash_file('sha256', $target))) {
                @unlink($target);
                if ($had) { @rename($backup, $target); }
                return new WP_Error('dtf_academy_mu_verify', 'MU-plugin verification failed and was rolled back.', ['status' => 500]);
            }

            $clean = [
                'service' => 'thc-academy-wordpress',
                'sourceRepository' => 'dtfgenetics/Thc-learning-courses-',
                'sourceSha' => $source_sha,
                'siteRepository' => sanitize_text_field((string)($identity['siteRepository'] ?? 'dtfgenetics/Thc')),
                'siteSha' => strtolower(sanitize_text_field((string)($identity['siteSha'] ?? ''))),
                'workflowRunId' => sanitize_text_field((string)($identity['workflowRunId'] ?? '')),
                'workflowRunAttempt' => sanitize_text_field((string)($identity['workflowRunAttempt'] ?? '')),
                'buildId' => sanitize_text_field($build_id),
                'publishedAt' => sanitize_text_field((string)($identity['publishedAt'] ?? '')),
            ];
            update_option('dtf_academy_build_identity_v1', $clean, false);

            if ($had) { @unlink($backup); }
            if (function_exists('wp_cache_flush')) { wp_cache_flush(); }
            do_action('litespeed_purge_url', '/api/build-info');
            do_action('litespeed_purge_url', '/wp-json/dtf-academy/v1/build-info');

            return rest_ensure_response([
                'ok' => true,
                'sourceSha' => $source_sha,
                'buildId' => $build_id,
                'pluginSha256' => $plugin_sha,
                'serverVerified' => true,
            ]);
        },
    ]);
});
`.trim();

async function cleanup() {
  if (snippetId) {
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404, 500] }); } catch {}
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
  }

  if (activatedByRun && pluginWasInstalled && !pluginWasActive) {
    try { await request(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400, 404] }); } catch {}
  } else if (installedByRun) {
    try { await request(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400, 404] }); } catch {}
  }
}

try {
  await ensureSnippetApi();

  const created = await request('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Academy Build Identity Publisher ${workflowRunId || Date.now()}`,
      desc: 'Temporary authenticated bridge for installing the Academy build-identity MU-plugin and updating public deployment identity.',
      code: bridgeCode,
      tags: ['dtf-academy', 'deployment-identity', 'temporary'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || created.body?.data?.id || created.body?.snippet?.id || 0);
  if (!snippetId) throw new Error('Temporary build-identity bridge was created without a numeric ID.');

  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  let published = false;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await request(`/wp-json/${namespace}/publish`, {
      method: 'POST',
      headers: { 'X-DTF-Academy-Token': token },
      json: {
        plugin_b64: Buffer.from(muPlugin).toString('base64'),
        plugin_sha256: muPluginSha,
        identity,
      },
      allow: [404],
    });
    if (response.ok) {
      published = true;
      break;
    }
    await sleep(700 + attempt * 400);
  }
  if (!published) throw new Error('Academy build-identity publishing bridge did not become available.');

  const nonce = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const endpoints = [
    `/wp-json/dtf-academy/v1/build-info?verify=${nonce}`,
    `/api/build-info?verify=${nonce}`,
  ];

  for (const endpoint of endpoints) {
    const response = await request(endpoint, {
      authenticated: false,
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
    });
    if (!response.ok || typeof response.body !== 'object' || response.body === null) {
      throw new Error(`Public build identity endpoint failed: ${endpoint}`);
    }
    if (response.body.exactIdentityAvailable !== true ||
        String(response.body.sourceSha || '').toLowerCase() !== sourceSha ||
        response.body.buildId !== buildId) {
      throw new Error(`Public build identity mismatch at ${endpoint}: ${JSON.stringify(response.body).slice(0, 1000)}`);
    }
  }

  console.log(JSON.stringify({
    result: 'success',
    endpoint: `${site}/api/build-info`,
    restEndpoint: `${site}/wp-json/dtf-academy/v1/build-info`,
    sourceSha,
    siteSha: siteSha || null,
    buildId,
    exactIdentityAvailable: true,
  }, null, 2));
} finally {
  await cleanup();
}
