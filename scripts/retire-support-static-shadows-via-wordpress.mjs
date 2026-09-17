import crypto from 'node:crypto';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const runId = String(process.env.GITHUB_RUN_ID || Date.now());

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', json, allow = [], headers = {}, retryServer = true } = {}) {
  let lastError;
  const attempts = retryServer ? 8 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        method,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTFSeeds-Support-Shadow-Cleanup/2.0',
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000)
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if (retryServer && !allow.includes(response.status) && (response.status === 429 || response.status >= 500) && attempt < attempts) {
        await sleep(Math.min(12_000, 1_500 * attempt));
        continue;
      }
      if (!response.ok && !allow.includes(response.status)) {
        throw new Error(`${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      }
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(Math.min(12_000, 1_500 * attempt));
        continue;
      }
    }
  }
  throw lastError || new Error(`${method} ${path} failed.`);
}

function collection(body) {
  if (Array.isArray(body)) return body;
  for (const key of ['snippets', 'data', 'items', 'results']) if (Array.isArray(body?.[key])) return body[key];
  return [];
}

function item(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (Object.prototype.hasOwnProperty.call(body, 'id')) return body;
  for (const key of ['snippet', 'data', 'item']) {
    if (body[key] && typeof body[key] === 'object' && !Array.isArray(body[key])) return body[key];
  }
  return body;
}

function pluginEndpoint(pluginId) {
  return `/wp-json/wp/v2/plugins/${String(pluginId).split('/').map(encodeURIComponent).join('/')}`;
}

async function querySnippetPlugin() {
  const response = await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [401, 403, 404] });
  if (!response.ok || !Array.isArray(response.body)) return null;
  return response.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

async function waitForSnippetApi(safeMode = false) {
  const suffix = safeMode ? '?snippets-safe-mode=1' : '';
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    const response = await request(`/wp-json/code-snippets/v1/snippets/schema${suffix}`, { allow: [404, 500] }).catch(() => null);
    if (response?.ok) return true;
    await sleep(700 + attempt * 300);
  }
  return false;
}

async function discardSnippetBestEffort(id) {
  for (const safeMode of [false, true]) {
    const suffix = safeMode ? '?snippets-safe-mode=1' : '';
    try { await request(`/wp-json/code-snippets/v1/snippets/${id}/deactivate${suffix}`, { method: 'POST', allow: [400, 404, 500] }); } catch {}
    try { await request(`/wp-json/code-snippets/v1/snippets/${id}${suffix}`, { method: 'DELETE', allow: [400, 404, 500] }); } catch {}
    try { await request(`/wp-json/code-snippets/v1/snippets/${id}${suffix}`, { method: 'DELETE', allow: [400, 404, 500] }); } catch {}
  }
}

async function verifyPublicPage(path, required, forbidden) {
  let last = '';
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const response = await fetch(`${siteUrl}${path}?dtf_support_shadow_v2=${encodeURIComponent(runId)}-${attempt}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
        'User-Agent': 'DTFSeeds-Support-Shadow-Visitor-Verify/2.0'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(45_000)
    });
    last = await response.text();
    if (response.ok && required.every((marker) => last.toLowerCase().includes(marker.toLowerCase())) && forbidden.every((marker) => !last.toLowerCase().includes(marker.toLowerCase()))) {
      return { path, status: response.status, required, forbidden };
    }
    await sleep(2_500 + attempt * 500);
  }
  throw new Error(`Visitor verification failed for ${path}; required=${JSON.stringify(required)} forbidden=${JSON.stringify(forbidden)} sample=${last.slice(0, 1200)}`);
}

const plugin = await querySnippetPlugin();
if (!plugin?.plugin) throw new Error('Code Snippets plugin is not available through authenticated WordPress REST.');
const pluginWasActive = String(plugin.status || '').toLowerCase() === 'active';
if (!pluginWasActive) {
  await request(pluginEndpoint(plugin.plugin), { method: 'POST', json: { status: 'active' } });
}
if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.');

const token = crypto.randomBytes(32).toString('hex');
const suffix = crypto.randomBytes(6).toString('hex');
const namespace = `dtf-support-shadow-${suffix}/v1`;
const tokenLiteral = JSON.stringify(token);
const namespaceLiteral = JSON.stringify(namespace);
const runLiteral = JSON.stringify(runId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || suffix);

const php = String.raw`add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $namespace = ${namespaceLiteral};
    $run_id = ${runLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-shadow-token');
        if ($supplied === '') $supplied = (string) $request->get_param('_dtf_shadow_token');
        return $supplied !== '' && hash_equals($token, $supplied);
    };
    $targets = [
        'gallery' => [
            '/assets/dtf-home/dtf-home.css', 'Character Art', 'Grow Media',
            'Cannabis Plant Anatomy', 'Nutrient Uptake', 'Beneficial Insects',
            'Deficiency vs Toxicity', 'Cannabis Life Cycle'
        ],
        'about' => [
            '/assets/dtf-home/dtf-home.css',
            'Dream the Future with genetics, games, and education.',
            'THC Grow Doc', 'Game Hub'
        ],
    ];
    $backup_root = trailingslashit(WP_CONTENT_DIR) . 'uploads/dtf-support-shadow-backups/' . $run_id;

    register_rest_route($namespace, '/cleanup', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_root) {
            $root = trailingslashit(ABSPATH);
            $removed = [];
            foreach ($targets as $rel => $markers) {
                $dir = $root . $rel;
                $index = trailingslashit($dir) . 'index.html';
                if (!is_dir($dir) || !is_file($index)) continue;
                $body = @file_get_contents($index);
                if (!is_string($body)) return new WP_Error('dtf_shadow_read', 'Could not read static shadow index.', ['status' => 500, 'route' => $rel]);
                $stale = false;
                foreach ($markers as $marker) {
                    if (stripos($body, $marker) !== false) { $stale = true; break; }
                }
                if (!$stale) continue;
                $parent = dirname($backup_root . '/' . $rel);
                if (!wp_mkdir_p($parent)) return new WP_Error('dtf_shadow_backup_parent', 'Could not create support-shadow backup directory.', ['status' => 500, 'route' => $rel]);
                $backup = $backup_root . '/' . $rel;
                if (file_exists($backup)) return new WP_Error('dtf_shadow_backup_exists', 'Support-shadow backup target already exists.', ['status' => 409, 'route' => $rel]);
                if (!@rename($dir, $backup)) return new WP_Error('dtf_shadow_move', 'Could not move stale static route into backup.', ['status' => 500, 'route' => $rel]);
                $removed[] = ['route' => $rel, 'backup' => $backup];
            }
            if (function_exists('flush_rewrite_rules')) flush_rewrite_rules(false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'removed' => $removed, 'backup_root' => $backup_root]);
        },
    ]);

    register_rest_route($namespace, '/rollback', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_root) {
            $root = trailingslashit(ABSPATH);
            $restored = [];
            foreach (array_keys($targets) as $rel) {
                $backup = $backup_root . '/' . $rel;
                $target = $root . $rel;
                if (!is_dir($backup)) continue;
                if (file_exists($target)) return new WP_Error('dtf_shadow_target_exists', 'Refusing rollback because route target already exists.', ['status' => 409, 'route' => $rel]);
                if (!@rename($backup, $target)) return new WP_Error('dtf_shadow_restore', 'Could not restore support-shadow backup.', ['status' => 500, 'route' => $rel]);
                $restored[] = $rel;
            }
            if (function_exists('flush_rewrite_rules')) flush_rewrite_rules(false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'restored' => $restored]);
        },
    ]);
});`;

let snippetId = 0;
let cleanupResult = null;
let rollbackResult = null;
try {
  const created = await request('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Support Shadow Cleanup ${runId}`,
      desc: 'Temporary token-protected backup-first cleanup for stale About/Gallery static shadows.',
      code: php,
      tags: ['dtf-deploy-cleanup', 'temporary', 'support-shadow'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false
    }
  });
  snippetId = Number(item(created.body)?.id || 0);
  if (!Number.isInteger(snippetId) || snippetId <= 0) throw new Error('Support-shadow cleanup snippet was created without a numeric ID.');

  const activated = await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST', allow: [400] });
  if (!activated.ok && activated.status !== 400) throw new Error(`Could not activate support-shadow cleanup snippet ${snippetId}.`);

  let routeReady = false;
  const probePath = `/wp-json/${namespace}/cleanup?_dtf_shadow_token=${encodeURIComponent(token)}`;
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    const response = await request(probePath, {
      method: 'POST',
      json: { _dtf_shadow_token: token },
      headers: { 'X-DTF-Shadow-Token': token },
      allow: [404]
    }).catch(() => null);
    if (response?.ok && response.body?.ok === true) {
      cleanupResult = response.body;
      routeReady = true;
      break;
    }
    await sleep(700 + attempt * 300);
  }
  if (!routeReady) throw new Error(`Temporary support-shadow route from snippet ${snippetId} did not become available.`);

  try {
    const gallery = await verifyPublicPage('/gallery/', ['DTF gallery.', 'Approved visuals only.'], [
      'Cannabis Plant Anatomy', 'Nutrient Uptake and Root-Zone Chemistry', 'Beneficial Insects', 'Deficiency vs Toxicity', 'Cannabis Life Cycle'
    ]);
    const about = await verifyPublicPage('/about/', ['Dream the future.', 'One brand. Four core experiences.'], [
      'Dream the Future with genetics, games, and education.'
    ]);
    console.log(JSON.stringify({ ok: true, cleanupResult, verified: [gallery, about] }, null, 2));
  } catch (verificationError) {
    const rollbackPath = `/wp-json/${namespace}/rollback?_dtf_shadow_token=${encodeURIComponent(token)}`;
    const rolledBack = await request(rollbackPath, {
      method: 'POST',
      json: { _dtf_shadow_token: token },
      headers: { 'X-DTF-Shadow-Token': token }
    });
    rollbackResult = rolledBack.body;
    throw new Error(`${verificationError.message}; rollback=${JSON.stringify(rollbackResult)}`);
  }
} finally {
  if (snippetId) await discardSnippetBestEffort(snippetId);
  if (!pluginWasActive) {
    try { await request(pluginEndpoint(plugin.plugin), { method: 'POST', json: { status: 'inactive' } }); } catch {}
  }
}
