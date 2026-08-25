import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const repairToken = crypto.randomBytes(32).toString('hex');
const tokenLiteral = JSON.stringify(repairToken);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let snippetId = null;
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedByRepair = false;
let activatedByRepair = false;
let pluginRestId = 'code-snippets/code-snippets';
let repairApplied = false;
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
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WordPress request ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 900) : JSON.stringify(body).slice(0, 900)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(1000 + attempt * 700); }
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
    await sleep(1000 + attempt * 550);
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
    await sleep(1300 + attempt * 700);
  }
  throw installError || new Error('WordPress native plugin install did not produce Code Snippets.');
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-route-repair-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };

    $targets = [
        [
            'rel' => '.htaccess',
            'old' => 'RewriteRule ^games/(?:future-slots|high-iq|bud-or-bluff|grower-conversations)(?:/|$) /games/ [R=301,L]',
            'new' => 'RewriteRule ^games/(?:future-slots|bud-or-bluff)(?:/|$) /games/ [R=301,L]',
        ],
        [
            'rel' => 'games/.htaccess',
            'old' => 'RewriteRule ^(?:future-slots|high-iq|bud-or-bluff|grower-conversations)(?:/|$) /games/ [R=301,L]',
            'new' => 'RewriteRule ^(?:future-slots|bud-or-bluff)(?:/|$) /games/ [R=301,L]',
        ],
    ];
    $state_key = 'dtf_game_route_redirect_repair_state';
    $backup_key = static function ($rel) { return 'dtf_game_route_redirect_backup_' . md5($rel); };
    $root = trailingslashit(wp_normalize_path(ABSPATH));

    $safe_path = static function ($rel) use ($root) {
        $path = wp_normalize_path(ABSPATH . $rel);
        return strpos($path, $root) === 0 ? $path : false;
    };

    $restore_all = static function () use ($targets, $backup_key, $safe_path, $state_key) {
        $restored = [];
        foreach ($targets as $target) {
            $rel = $target['rel'];
            $backup = get_option($backup_key($rel));
            if (!is_array($backup) || empty($backup['content_b64'])) continue;
            $raw = base64_decode((string) $backup['content_b64'], true);
            $path = $safe_path($rel);
            if ($raw === false || $path === false) return new WP_Error('dtf_restore_invalid', 'Stored routing backup is invalid.', ['status' => 500, 'path' => $rel]);
            $tmp = $path . '.dtf-route-restore-' . wp_generate_uuid4();
            if (file_put_contents($tmp, $raw, LOCK_EX) !== strlen($raw)) { @unlink($tmp); return new WP_Error('dtf_restore_write', 'Could not stage routing backup.', ['status' => 500, 'path' => $rel]); }
            @chmod($tmp, (int) ($backup['mode'] ?? 0644));
            if (!@rename($tmp, $path)) { @unlink($tmp); return new WP_Error('dtf_restore_rename', 'Could not restore routing backup atomically.', ['status' => 500, 'path' => $rel]); }
            $restored[] = $rel;
        }
        update_option($state_key, ['status' => 'rolled_back', 'restored' => $restored, 'updated_at' => gmdate('c')], false);
        if (function_exists('wp_cache_flush')) wp_cache_flush();
        clearstatcache();
        return rest_ensure_response(['ok' => true, 'status' => 'rolled_back', 'restored' => $restored]);
    };

    register_rest_route('dtf-route-repair/v1', '/state', [
        'methods' => 'GET',
        'permission_callback' => $permission,
        'callback' => static function () use ($state_key) {
            $state = get_option($state_key, []);
            return rest_ensure_response(is_array($state) ? $state : []);
        },
    ]);

    register_rest_route('dtf-route-repair/v1', '/apply', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_key, $safe_path, $state_key, $restore_all) {
            $prepared = [];
            $already = [];
            foreach ($targets as $target) {
                $rel = $target['rel'];
                $path = $safe_path($rel);
                if ($path === false || !is_file($path)) return new WP_Error('dtf_route_file_missing', 'Expected routing file is missing or unsafe.', ['status' => 500, 'path' => $rel]);
                $content = file_get_contents($path);
                if ($content === false) return new WP_Error('dtf_route_read', 'Could not read routing file.', ['status' => 500, 'path' => $rel]);
                $old_count = substr_count($content, $target['old']);
                $new_count = substr_count($content, $target['new']);
                if ($old_count === 0 && $new_count === 1) { $already[] = $rel; continue; }
                if ($old_count !== 1 || $new_count !== 0) return new WP_Error('dtf_route_marker_mismatch', 'Routing file does not match the exact reviewed legacy marker.', ['status' => 409, 'path' => $rel, 'old_count' => $old_count, 'new_count' => $new_count]);
                if (!is_writable($path) || !is_writable(dirname($path))) return new WP_Error('dtf_route_not_writable', 'Routing file is not writable by WordPress.', ['status' => 500, 'path' => $rel]);
                $backup = [
                    'path' => $rel,
                    'sha256' => hash('sha256', $content),
                    'content_b64' => base64_encode($content),
                    'mode' => fileperms($path) & 0777,
                    'backed_at' => gmdate('c'),
                ];
                update_option($backup_key($rel), $backup, false);
                $stored = get_option($backup_key($rel));
                if (!is_array($stored) || ($stored['sha256'] ?? '') !== $backup['sha256']) return new WP_Error('dtf_route_backup', 'Routing backup verification failed.', ['status' => 500, 'path' => $rel]);
                $updated = str_replace($target['old'], $target['new'], $content, $replace_count);
                if ($replace_count !== 1 || substr_count($updated, $target['old']) !== 0 || substr_count($updated, $target['new']) !== 1) return new WP_Error('dtf_route_replace', 'Routing replacement did not produce the exact expected result.', ['status' => 500, 'path' => $rel]);
                $prepared[] = ['rel' => $rel, 'path' => $path, 'updated' => $updated, 'backup' => $backup];
            }

            $applied = [];
            foreach ($prepared as $item) {
                $tmp = $item['path'] . '.dtf-route-repair-' . wp_generate_uuid4();
                $bytes = strlen($item['updated']);
                if (file_put_contents($tmp, $item['updated'], LOCK_EX) !== $bytes || !hash_equals(hash('sha256', $item['updated']), (string) @hash_file('sha256', $tmp))) {
                    @unlink($tmp);
                    $restore_all();
                    return new WP_Error('dtf_route_stage', 'Could not stage exact routing repair; backups restored.', ['status' => 500, 'path' => $item['rel']]);
                }
                @chmod($tmp, (int) $item['backup']['mode']);
                if (!@rename($tmp, $item['path'])) {
                    @unlink($tmp);
                    $restore_all();
                    return new WP_Error('dtf_route_commit', 'Could not atomically commit routing repair; backups restored.', ['status' => 500, 'path' => $item['rel']]);
                }
                $applied[] = $item['rel'];
            }

            clearstatcache();
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            $state = ['status' => 'applied', 'applied' => $applied, 'already_repaired' => $already, 'updated_at' => gmdate('c')];
            update_option($state_key, $state, false);
            return rest_ensure_response(['ok' => true, 'status' => 'applied', 'applied' => $applied, 'already_repaired' => $already]);
        },
    ]);

    register_rest_route('dtf-route-repair/v1', '/rollback', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($restore_all) { return $restore_all(); },
    ]);

    register_rest_route('dtf-route-repair/v1', '/finalize', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_key, $state_key) {
            $state = get_option($state_key, []);
            if (!is_array($state) || ($state['status'] ?? '') !== 'applied') return new WP_Error('dtf_route_not_applied', 'Routing repair is not in an applied state.', ['status' => 409]);
            $deleted = 0;
            foreach ($targets as $target) {
                $key = $backup_key($target['rel']);
                if (get_option($key, null) !== null) { delete_option($key); $deleted++; }
            }
            delete_option($state_key);
            return rest_ensure_response(['ok' => true, 'status' => 'finalized', 'backup_options_deleted' => $deleted]);
        },
    ]);
});
`.trim();

async function cleanupTemporaryTools() {
  if (snippetId && !rollbackFailed) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (rollbackFailed) {
    console.error('Routing rollback failed; temporary repair tooling is being left active for recovery.');
    return;
  }
  if (installedByRepair && !pluginWasInstalled) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByRepair && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
}

async function callRepair(path, { method = 'POST' } = {}) {
  return wpRequest(`/wp-json/dtf-route-repair/v1/${path}`, {
    method,
    headers: { 'X-DTF-Route-Repair-Token': repairToken },
  });
}

async function probe(path) {
  const url = new URL(path, siteUrl);
  url.searchParams.set('dtf_route_repair', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      'User-Agent': 'DTFSeeds-Route-Repair/1.0',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  return { response, text, url: url.toString() };
}

async function verifyRouting() {
  const playable = [
    ['/games/high-iq/', ['High IQ — Test Higher Cognition', '/games/dtf-route.css', './high-iq.css', './app.js']],
    ['/games/grower-conversations/', ['Grower Conversations', './grower-conversations.css', './app.js']],
  ];
  for (const [path, markers] of playable) {
    let ok = false;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const { response, text } = await probe(path);
        const lower = text.toLowerCase();
        ok = response.status === 200 && !response.headers.get('location') && markers.every(marker => lower.includes(marker.toLowerCase()));
        if (ok) break;
      } catch {}
      await sleep(1200 + attempt * 650);
    }
    if (!ok) throw new Error(`Playable route verification failed after redirect repair: ${path}`);
    console.log(`Verified playable route ${path}`);
  }

  for (const path of ['/games/future-slots/', '/games/bud-or-bluff/']) {
    const { response } = await probe(path);
    const location = response.headers.get('location') || '';
    if (![301, 302].includes(response.status) || !location.includes('/games/')) {
      throw new Error(`Retired route no longer redirects to Game Hub as intended: ${path} (HTTP ${response.status}, location=${location || 'none'})`);
    }
    console.log(`Preserved retired-route redirect ${path}`);
  }
}

try {
  const prePlugin = await queryCodeSnippetsPlugin();
  pluginWasInstalled = Boolean(prePlugin);
  pluginWasActive = prePlugin?.status === 'active';
  if (prePlugin?.plugin) pluginRestId = prePlugin.plugin;

  const apiWasReady = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (!apiWasReady.ok) {
    let plugin = prePlugin;
    if (!plugin) { plugin = await installCodeSnippetsNative(); installedByRepair = true; }
    if (plugin?.plugin) pluginRestId = plugin.plugin;
    if (plugin?.status !== 'active') {
      const activated = await setPluginStatus(pluginRestId, 'active');
      activatedByRepair = true;
      if (activated.body?.plugin) pluginRestId = activated.body.plugin;
    } else if (!pluginWasActive) activatedByRepair = true;
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available for routing repair.');
  }

  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Game Route Redirect Repair ${runId}`,
      desc: 'Temporary authenticated, marker-gated repair for two stale DTF game redirect rules.',
      code: snippetCode,
      tags: ['dtf-repair', 'temporary', 'game-routing'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary game-route redirect repair snippet was created without an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const applied = await callRepair('apply');
  if (applied.body?.ok !== true) throw new Error(`Routing repair did not report success: ${JSON.stringify(applied.body).slice(0, 800)}`);
  repairApplied = true;

  await verifyRouting();

  const finalized = await callRepair('finalize');
  if (finalized.body?.ok !== true) throw new Error(`Routing repair finalize did not report success: ${JSON.stringify(finalized.body).slice(0, 800)}`);
  console.log(JSON.stringify({ ok: true, routingRepair: 'finalized', applied: applied.body.applied || [], alreadyRepaired: applied.body.already_repaired || [] }));
} catch (error) {
  if (snippetId && repairApplied) {
    try {
      const rolled = await callRepair('rollback');
      if (rolled.body?.ok !== true) throw new Error(`Rollback returned ${JSON.stringify(rolled.body).slice(0, 700)}`);
      console.error('Routing verification failed; both .htaccess files were restored automatically.');
    } catch (rollbackError) {
      rollbackFailed = true;
      console.error(`Automatic routing rollback failed: ${rollbackError.message}`);
    }
  }
  throw error;
} finally {
  await cleanupTemporaryTools();
  console.log(`Temporary route-repair cleanup complete. applied=${repairApplied ? 'yes' : 'no'} rollbackFailed=${rollbackFailed ? 'yes' : 'no'}.`);
}
