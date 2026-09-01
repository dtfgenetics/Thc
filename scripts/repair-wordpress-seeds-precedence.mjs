import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    throw new Error(`WordPress ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 900) : JSON.stringify(body).slice(0, 900)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await wpRequest(path, { ...options, method: 'GET' });
    } catch (error) {
      lastError = error;
      await sleep(1200 + attempt * 900);
    }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

async function queryCodeSnippetsPlugin() {
  const list = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!list.ok || !Array.isArray(list.body)) return null;
  return list.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(pluginId) {
  const safe = String(pluginId || 'code-snippets/code-snippets')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/wp-json/wp/v2/plugins/${safe}`;
}

async function waitForCodeSnippetsPlugin() {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const plugin = await queryCodeSnippetsPlugin();
      if (plugin) return plugin;
    } catch {}
    await sleep(1500 + attempt * 800);
  }
  return null;
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
      if (response.ok) return true;
    } catch {}
    await sleep(1100 + attempt * 650);
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
  } catch (error) {
    installError = error;
  }
  const recovered = await waitForCodeSnippetsPlugin();
  if (recovered) return recovered;
  throw installError || new Error('WordPress native plugin install did not produce Code Snippets.');
}

async function setPluginStatus(pluginId, status) {
  return wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status } });
}

const repairToken = crypto.randomBytes(32).toString('hex');
const tokenLiteral = JSON.stringify(repairToken);
const snippetCode = `
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_param('dtf_repair_token');
        return $supplied !== '' && hash_equals($token, $supplied);
    };

    $path = wp_normalize_path(ABSPATH . '.htaccess');
    $backup_key = 'dtf_seeds_precedence_backup_v1';
    $state_key = 'dtf_seeds_precedence_state_v1';
    $legacy = 'RewriteRule ^(seeds|learn|about|contact|gallery|community|shop)/?$ /$1/index.html [L]';
    $canonical = "RewriteRule ^seeds/?$ /index.php [L]\\nRewriteRule ^(learn|about|contact|gallery|community|shop)/?$ /$1/index.html [L]";

    register_rest_route('dtf-repair/v1', '/seeds-precedence-state', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($state_key) {
            $state = get_option($state_key, []);
            return rest_ensure_response(is_array($state) ? $state : []);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/apply-seeds-precedence', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($path, $backup_key, $state_key, $legacy, $canonical) {
            if (!is_file($path) || !is_readable($path) || !is_writable($path)) {
                return new WP_Error('dtf_htaccess_unavailable', '.htaccess is not safely readable and writable.', ['status' => 500]);
            }
            $content = file_get_contents($path);
            if ($content === false) return new WP_Error('dtf_htaccess_read', 'Could not read .htaccess.', ['status' => 500]);

            if (strpos($content, $canonical) !== false) {
                update_option($state_key, ['status' => 'already-canonical', 'changed' => false, 'updated_at' => gmdate('c')], false);
                return rest_ensure_response(['ok' => true, 'changed' => false, 'status' => 'already-canonical']);
            }

            if (substr_count($content, $legacy) !== 1) {
                return new WP_Error('dtf_unexpected_htaccess', 'Expected exactly one legacy shared static-route directive.', [
                    'status' => 409,
                    'legacy_count' => substr_count($content, $legacy),
                ]);
            }

            $backup = [
                'sha256' => hash('sha256', $content),
                'content_b64' => base64_encode($content),
                'mode' => fileperms($path) & 0777,
                'saved_at' => gmdate('c'),
            ];
            update_option($backup_key, $backup, false);
            $stored = get_option($backup_key);
            if (!is_array($stored) || ($stored['sha256'] ?? '') !== $backup['sha256']) {
                return new WP_Error('dtf_htaccess_backup', '.htaccess backup verification failed.', ['status' => 500]);
            }

            $next = str_replace($legacy, $canonical, $content, $count);
            if ($count !== 1) {
                return new WP_Error('dtf_htaccess_replace', 'Seeds route replacement count was not exactly one.', ['status' => 409, 'count' => $count]);
            }

            if (file_put_contents($path, $next, LOCK_EX) === false) {
                return new WP_Error('dtf_htaccess_write', 'Could not write repaired .htaccess.', ['status' => 500]);
            }
            @chmod($path, (int) $backup['mode']);
            clearstatcache(true, $path);
            $verify = file_get_contents($path);
            if ($verify === false || hash('sha256', $verify) !== hash('sha256', $next)) {
                file_put_contents($path, $content, LOCK_EX);
                @chmod($path, (int) $backup['mode']);
                return new WP_Error('dtf_htaccess_verify', 'Written .htaccess did not verify; original restored.', ['status' => 500]);
            }

            $state = [
                'status' => 'applied',
                'changed' => true,
                'before_sha256' => $backup['sha256'],
                'after_sha256' => hash('sha256', $next),
                'updated_at' => gmdate('c'),
            ];
            update_option($state_key, $state, false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'changed' => true, 'status' => 'applied', 'after_sha256' => $state['after_sha256']]);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/restore-seeds-precedence', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($path, $backup_key, $state_key) {
            $backup = get_option($backup_key);
            if (!is_array($backup) || empty($backup['content_b64'])) {
                return new WP_Error('dtf_htaccess_backup_missing', 'No .htaccess backup is available for rollback.', ['status' => 409]);
            }
            $raw = base64_decode($backup['content_b64'], true);
            if ($raw === false || hash('sha256', $raw) !== ($backup['sha256'] ?? '')) {
                return new WP_Error('dtf_htaccess_backup_invalid', '.htaccess backup failed integrity verification.', ['status' => 500]);
            }
            if (file_put_contents($path, $raw, LOCK_EX) === false) {
                return new WP_Error('dtf_htaccess_restore', 'Could not restore .htaccess backup.', ['status' => 500]);
            }
            @chmod($path, (int) ($backup['mode'] ?? 0644));
            update_option($state_key, ['status' => 'restored', 'changed' => false, 'updated_at' => gmdate('c')], false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'restored' => true]);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/finalize-seeds-precedence', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($backup_key, $state_key) {
            delete_option($backup_key);
            delete_option($state_key);
            return rest_ensure_response(['ok' => true]);
        },
    ]);
});
`.trim();

let snippetId = 0;
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedByRepair = false;
let activatedByRepair = false;
let pluginRestId = 'code-snippets/code-snippets';
let routeChanged = false;
let repairSucceeded = false;
let rollbackFailed = false;

async function cleanupTemporaryTools() {
  if (snippetId && !rollbackFailed) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (activatedByRepair && pluginWasInstalled && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
  if (installedByRepair) {
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [404] }); } catch {}
  }
}

async function recoverRepairState() {
  try {
    const state = await wpRequest('/wp-json/dtf-repair/v1/seeds-precedence-state', {
      method: 'POST',
      json: { dtf_repair_token: repairToken },
      allow: [404],
    });
    if (!state.ok || !state.body || typeof state.body !== 'object') return null;
    if (state.body.status === 'applied') return { ok: true, changed: true, status: 'applied', recovered: true };
    if (state.body.status === 'already-canonical') return { ok: true, changed: false, status: 'already-canonical', recovered: true };
  } catch {}
  return null;
}

async function verifySeeds(runId) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}/seeds/?dtf_seeds_precedence=${encodeURIComponent(runId)}-${attempt}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTFSeeds-Seeds-Precedence/1.0',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`/seeds/ returned HTTP ${response.status}`);
      if (!text.toLowerCase().includes('dtf genetics library')) throw new Error('Dedicated Genetics library marker is missing.');
      if (!text.toLowerCase().includes('open blue mango profile')) throw new Error('Blue Mango profile marker is missing.');
      if (text.toLowerCase().includes('dtf genetics catalog pages built around strain identity and grow context.')) {
        throw new Error('Stale static Seeds marker is still visitor-visible.');
      }
      return;
    } catch (error) {
      lastError = error;
      await sleep(2500 + attempt * 900);
    }
  }
  throw lastError || new Error('Seeds visitor verification failed.');
}

try {
  let plugin = await queryCodeSnippetsPlugin();
  pluginWasInstalled = Boolean(plugin);
  pluginWasActive = plugin?.status === 'active';

  if (!plugin) {
    plugin = await installCodeSnippetsNative();
    installedByRepair = true;
  }
  if (plugin?.plugin) pluginRestId = plugin.plugin;

  if (plugin?.status !== 'active') {
    const activated = await setPluginStatus(pluginRestId, 'active');
    activatedByRepair = true;
    if (activated.body?.plugin) pluginRestId = activated.body.plugin;
  }

  if (!(await waitForSnippetApi())) {
    throw new Error('Code Snippets REST API did not become available.');
  }

  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Seeds Route Precedence ${runId}`,
      desc: 'Temporary, authenticated, rollback-safe repair that delegates only /seeds/ to WordPress while preserving other route behavior.',
      code: snippetCode,
      tags: ['dtf-repair', 'temporary', 'seeds'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary Seeds precedence snippet was created without a usable ID.');

  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  let repair;
  try {
    repair = await wpRequest('/wp-json/dtf-repair/v1/apply-seeds-precedence', {
      method: 'POST',
      json: { dtf_repair_token: repairToken },
    });
  } catch (error) {
    const recovered = await recoverRepairState();
    if (!recovered) throw error;
    repair = { body: recovered };
    console.warn('Recovered Seeds precedence state after an ambiguous HTTP failure.');
  }

  if (repair.body?.ok !== true) {
    throw new Error(`Seeds precedence endpoint did not return success: ${JSON.stringify(repair.body).slice(0, 900)}`);
  }
  routeChanged = repair.body?.changed === true;
  console.log(`Seeds precedence transaction status: ${repair.body?.status || 'unknown'}; changed=${routeChanged ? 'yes' : 'no'}.`);

  await verifySeeds(runId);

  await wpRequest('/wp-json/dtf-repair/v1/finalize-seeds-precedence', {
    method: 'POST',
    json: { dtf_repair_token: repairToken },
  });
  repairSucceeded = true;
  console.log('Seeds route precedence is visitor-verified for the dedicated Genetics library.');
} catch (error) {
  if (snippetId && routeChanged) {
    try {
      await wpRequest('/wp-json/dtf-repair/v1/restore-seeds-precedence', {
        method: 'POST',
        json: { dtf_repair_token: repairToken },
      });
      console.error('Seeds precedence verification failed; restored the backed-up .htaccess.');
    } catch (restoreError) {
      rollbackFailed = true;
      console.error(`CRITICAL: automatic .htaccess rollback also failed: ${restoreError.message}`);
    }
  }
  throw error;
} finally {
  await cleanupTemporaryTools();
  console.log(`Temporary Seeds precedence cleanup complete. Repair success: ${repairSucceeded ? 'yes' : 'no'}.`);
}
