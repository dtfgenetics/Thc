import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const repairToken = crypto.randomBytes(32).toString('hex');
const tokenLiteral = JSON.stringify(repairToken);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let snippetId = null;
let pluginId = 'code-snippets/code-snippets';
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedByRun = false;
let activatedByRun = false;
let applied = false;
let rollbackFailed = false;

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

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(800 + attempt * 650); }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

async function queryPlugin() {
  const result = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [401, 403, 404] });
  if (!result.ok || !Array.isArray(result.body)) return null;
  return result.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(id) {
  const encoded = String(id || pluginId).split('/').map(encodeURIComponent).join('/');
  return `/wp-json/wp/v2/plugins/${encoded}`;
}

async function setPluginStatus(id, status) {
  return wpRequest(pluginEndpoint(id), { method: 'POST', json: { status } });
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

async function ensureSnippetApi() {
  const existing = await queryPlugin();
  pluginWasInstalled = Boolean(existing);
  pluginWasActive = existing?.status === 'active';
  if (existing?.plugin) pluginId = existing.plugin;

  const direct = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (direct.ok) return;

  let plugin = existing;
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
  } else if (!pluginWasActive) {
    activatedByRun = true;
  }
  if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.');
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-game-promotion-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };

    $targets = [
        [
            'rel' => '.htaccess',
            'desired' => 'RewriteRule ^games/(?:future-slots)(?:/|$) /games/ [R=301,L]',
            'stale' => [
                'RewriteRule ^games/(?:future-slots|bud-or-bluff)(?:/|$) /games/ [R=301,L]',
                'RewriteRule ^games/(?:future-slots|high-iq|bud-or-bluff|grower-conversations)(?:/|$) /games/ [R=301,L]',
            ],
        ],
        [
            'rel' => 'games/.htaccess',
            'desired' => 'RewriteRule ^(?:future-slots)(?:/|$) /games/ [R=301,L]',
            'stale' => [
                'RewriteRule ^(?:future-slots|bud-or-bluff)(?:/|$) /games/ [R=301,L]',
                'RewriteRule ^(?:future-slots|high-iq|bud-or-bluff|grower-conversations)(?:/|$) /games/ [R=301,L]',
            ],
        ],
    ];
    $state_key = 'dtf_public_game_route_promotion_state_v1';
    $backup_key = static function ($rel) { return 'dtf_public_game_route_promotion_backup_' . md5($rel); };
    $root = trailingslashit(wp_normalize_path(ABSPATH));
    $safe_path = static function ($rel) use ($root) {
        $candidate = wp_normalize_path(ABSPATH . $rel);
        return strpos($candidate, $root) === 0 ? $candidate : false;
    };

    $restore_all = static function () use ($targets, $backup_key, $safe_path, $state_key) {
        $restored = [];
        foreach ($targets as $target) {
            $backup = get_option($backup_key($target['rel']));
            if (!is_array($backup) || empty($backup['content_b64'])) continue;
            $raw = base64_decode((string) $backup['content_b64'], true);
            $path = $safe_path($target['rel']);
            if ($raw === false || $path === false) return new WP_Error('dtf_restore_invalid', 'Stored route backup is invalid.', ['status' => 500]);
            $tmp = $path . '.dtf-game-route-restore-' . wp_generate_uuid4();
            if (file_put_contents($tmp, $raw, LOCK_EX) !== strlen($raw)) { @unlink($tmp); return new WP_Error('dtf_restore_stage', 'Could not stage route rollback.', ['status' => 500]); }
            @chmod($tmp, (int) ($backup['mode'] ?? 0644));
            if (!@rename($tmp, $path)) { @unlink($tmp); return new WP_Error('dtf_restore_commit', 'Could not commit route rollback.', ['status' => 500]); }
            $restored[] = $target['rel'];
        }
        update_option($state_key, ['status' => 'rolled-back', 'restored' => $restored, 'updated_at' => gmdate('c')], false);
        if (function_exists('wp_cache_flush')) wp_cache_flush();
        clearstatcache();
        return rest_ensure_response(['ok' => true, 'restored' => $restored]);
    };

    register_rest_route('dtf-game-promotion/v1', '/apply', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_key, $safe_path, $state_key, $restore_all) {
            $prepared = [];
            $already = [];
            foreach ($targets as $target) {
                $path = $safe_path($target['rel']);
                if ($path === false || !is_file($path) || !is_readable($path) || !is_writable($path)) {
                    return new WP_Error('dtf_route_unavailable', 'Expected route file is not safely readable/writable.', ['status' => 500, 'path' => $target['rel']]);
                }
                $content = file_get_contents($path);
                if ($content === false) return new WP_Error('dtf_route_read', 'Could not read route file.', ['status' => 500, 'path' => $target['rel']]);

                $desired_count = substr_count($content, $target['desired']);
                $stale_matches = [];
                foreach ($target['stale'] as $stale) {
                    $count = substr_count($content, $stale);
                    if ($count > 0) $stale_matches[] = ['marker' => $stale, 'count' => $count];
                }
                if ($desired_count === 1 && count($stale_matches) === 0) { $already[] = $target['rel']; continue; }
                if ($desired_count !== 0 || count($stale_matches) !== 1 || $stale_matches[0]['count'] !== 1) {
                    return new WP_Error('dtf_route_marker_mismatch', 'Route file does not match an approved stale or canonical rule.', ['status' => 409, 'path' => $target['rel'], 'desired_count' => $desired_count, 'stale_matches' => $stale_matches]);
                }

                $backup = [
                    'sha256' => hash('sha256', $content),
                    'content_b64' => base64_encode($content),
                    'mode' => fileperms($path) & 0777,
                    'saved_at' => gmdate('c'),
                ];
                update_option($backup_key($target['rel']), $backup, false);
                $stored = get_option($backup_key($target['rel']));
                if (!is_array($stored) || ($stored['sha256'] ?? '') !== $backup['sha256']) {
                    return new WP_Error('dtf_route_backup', 'Route backup verification failed.', ['status' => 500, 'path' => $target['rel']]);
                }

                $next = str_replace($stale_matches[0]['marker'], $target['desired'], $content, $replace_count);
                if ($replace_count !== 1 || substr_count($next, $target['desired']) !== 1) {
                    return new WP_Error('dtf_route_replace', 'Route replacement was not exact.', ['status' => 500, 'path' => $target['rel']]);
                }
                $prepared[] = ['rel' => $target['rel'], 'path' => $path, 'next' => $next, 'backup' => $backup];
            }

            $changed = [];
            foreach ($prepared as $item) {
                $tmp = $item['path'] . '.dtf-game-route-promote-' . wp_generate_uuid4();
                if (file_put_contents($tmp, $item['next'], LOCK_EX) !== strlen($item['next']) || !hash_equals(hash('sha256', $item['next']), (string) @hash_file('sha256', $tmp))) {
                    @unlink($tmp); $restore_all();
                    return new WP_Error('dtf_route_stage', 'Could not stage exact route promotion; rollback attempted.', ['status' => 500, 'path' => $item['rel']]);
                }
                @chmod($tmp, (int) $item['backup']['mode']);
                if (!@rename($tmp, $item['path'])) { @unlink($tmp); $restore_all(); return new WP_Error('dtf_route_commit', 'Could not commit route promotion; rollback attempted.', ['status' => 500, 'path' => $item['rel']]); }
                $changed[] = $item['rel'];
            }
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            clearstatcache();
            update_option($state_key, ['status' => 'applied', 'changed' => $changed, 'already' => $already, 'updated_at' => gmdate('c')], false);
            return rest_ensure_response(['ok' => true, 'changed' => $changed, 'already' => $already]);
        },
    ]);

    register_rest_route('dtf-game-promotion/v1', '/rollback', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($restore_all) { return $restore_all(); },
    ]);

    register_rest_route('dtf-game-promotion/v1', '/finalize', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_key, $state_key) {
            foreach ($targets as $target) delete_option($backup_key($target['rel']));
            delete_option($state_key);
            return rest_ensure_response(['ok' => true]);
        },
    ]);
});
`.trim();

async function callPromotion(endpoint) {
  return wpRequest(`/wp-json/dtf-game-promotion/v1/${endpoint}`, {
    method: 'POST',
    headers: { 'X-DTF-Game-Promotion-Token': repairToken },
  });
}

async function probe(route) {
  const url = new URL(route, siteUrl);
  url.searchParams.set('dtf_game_promotion', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'user-agent': 'DTFSeeds-Game-Promotion/1.0',
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  return { response, text };
}

async function verifyPromotion() {
  let budOk = false;
  let lastBud = '';
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const { response, text } = await probe('/games/bud-or-bluff/');
      lastBud = `HTTP ${response.status} ${response.headers.get('location') || ''}`;
      budOk = response.status === 200
        && !response.headers.get('location')
        && /Bud or Bluff/i.test(text)
        && /Create lobby/i.test(text);
      if (budOk) break;
    } catch (error) {
      lastBud = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000 + attempt * 700);
  }
  if (!budOk) throw new Error(`Bud or Bluff did not resolve as its own playable route after promotion (${lastBud}).`);

  const retired = await probe('/games/future-slots/');
  const location = retired.response.headers.get('location') || '';
  if (![301, 302].includes(retired.response.status) || !location.includes('/games/')) {
    throw new Error(`future-slots retired route regression: HTTP ${retired.response.status} ${location || '<no location>'}`);
  }
}

async function cleanup() {
  if (snippetId && !rollbackFailed) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (rollbackFailed) return;
  if (installedByRun && !pluginWasInstalled) {
    try { await setPluginStatus(pluginId, 'inactive'); } catch {}
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByRun && !pluginWasActive) {
    try { await setPluginStatus(pluginId, 'inactive'); } catch {}
  }
}

try {
  await ensureSnippetApi();
  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Public Game Route Promotion ${runId}`,
      desc: 'Temporary authenticated and marker-gated removal of stale redirects for promoted public game routes.',
      code: snippetCode,
      tags: ['dtf-release', 'temporary', 'game-routing'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary route promotion snippet was created without an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const result = await callPromotion('apply');
  if (result.body?.ok !== true) throw new Error(`Route promotion did not report success: ${JSON.stringify(result.body).slice(0, 700)}`);
  applied = true;

  await verifyPromotion();

  const finalized = await callPromotion('finalize');
  if (finalized.body?.ok !== true) throw new Error(`Route promotion finalization failed: ${JSON.stringify(finalized.body).slice(0, 700)}`);
  console.log(JSON.stringify({ ok: true, routePromotion: 'finalized', changed: result.body.changed || [], already: result.body.already || [] }));
} catch (error) {
  if (snippetId && applied) {
    try {
      const rollback = await callPromotion('rollback');
      if (rollback.body?.ok !== true) throw new Error(`rollback returned ${JSON.stringify(rollback.body).slice(0, 600)}`);
      console.error('Route promotion verification failed; routing files were restored.');
    } catch (rollbackError) {
      rollbackFailed = true;
      console.error(`Automatic route rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
  }
  throw error;
} finally {
  await cleanup();
}
