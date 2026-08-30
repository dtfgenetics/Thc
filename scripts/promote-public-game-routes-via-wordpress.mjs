import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const repairToken = crypto.randomBytes(32).toString('hex');
const promotionNamespace = `dtf-route-promotion/v2-${crypto.randomBytes(8).toString('hex')}`;
const tokenLiteral = JSON.stringify(repairToken);
const namespaceLiteral = JSON.stringify(promotionNamespace);
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
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(900 + attempt * 700); }
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

async function waitForSnippetApi(safeMode = false) {
  const suffix = safeMode ? '?snippets-safe-mode=1' : '';
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await wpGetRetry(`/wp-json/code-snippets/v1/snippets/schema${suffix}`, { allow: [404, 500] });
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

  const direct = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404, 500] });
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

const rootOverlayBlock = `# DTFSeeds managed application child-route overlay v1
RewriteRule ^games/future-slots(?:/|$) /games/ [R=301,L]
RewriteRule ^learn/(academy|atlas|cultivation-science|glossary|plant-health|search|sops|sources|symptoms|tools)(?:/(.*))?/?$ /dtf-content-overlay/learn/$1/$2 [L]
RewriteRule ^community/grow-offs(?:/(.*))?/?$ /dtf-content-overlay/community/grow-offs/$1 [L]
RewriteRule ^games/seed-ascent(?:/(.*))?/?$ /dtf-content-overlay/games/seed-ascent/$1 [L]
RewriteRule ^_next/static/(.*)$ /dtf-content-overlay/_next/static/$1 [L]
RewriteRule ^seed-ascent\\.html$ /dtf-content-overlay/seed-ascent.html [L]
RewriteRule ^seed-ascent/(.*)$ /dtf-content-overlay/seed-ascent/$1 [L]`;
const rootOverlayBase64 = Buffer.from(rootOverlayBlock, 'utf8').toString('base64');

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $namespace = ${namespaceLiteral};
    $root_overlay = base64_decode(${JSON.stringify(rootOverlayBase64)}, true);
    if (!is_string($root_overlay) || $root_overlay === '') return;
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-route-promotion-token');
        if ($supplied === '') $supplied = (string) $request->get_param('_dtf_route_promotion_token');
        return $supplied !== '' && hash_equals($token, $supplied);
    };

    $targets = [
        [
            'rel' => '.htaccess',
            'desired' => $root_overlay,
            'stale' => [
                'RewriteRule ^games/(?:future-slots)(?:/|$) /games/ [R=301,L]',
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
    $state_key = 'dtf_public_route_promotion_state_v2';
    $backup_key = static function ($rel) { return 'dtf_public_route_promotion_backup_v2_' . md5($rel); };
    $root = trailingslashit(wp_normalize_path(ABSPATH));
    $safe_path = static function ($rel) use ($root) {
        $candidate = wp_normalize_path(ABSPATH . $rel);
        return strpos($candidate, $root) === 0 ? $candidate : false;
    };

    $overlay_manifest = $safe_path('dtf-content-overlay/overlay-manifest.json');
    if ($overlay_manifest === false || !is_file($overlay_manifest)) return;

    $restore_all = static function () use ($targets, $backup_key, $safe_path, $state_key) {
        $restored = [];
        foreach ($targets as $target) {
            $backup = get_option($backup_key($target['rel']));
            if (!is_array($backup) || !array_key_exists('content_b64', $backup)) continue;
            $raw = base64_decode((string) $backup['content_b64'], true);
            $path = $safe_path($target['rel']);
            if ($raw === false || $path === false) return new WP_Error('dtf_restore_invalid', 'Stored route backup is invalid.', ['status' => 500]);
            $tmp = $path . '.dtf-route-restore-' . wp_generate_uuid4();
            if (file_put_contents($tmp, $raw, LOCK_EX) !== strlen($raw)) { @unlink($tmp); return new WP_Error('dtf_restore_stage', 'Could not stage route rollback.', ['status' => 500]); }
            @chmod($tmp, (int) ($backup['mode'] ?? 0644));
            if (!@rename($tmp, $path)) { @unlink($tmp); return new WP_Error('dtf_restore_commit', 'Could not commit route rollback.', ['status' => 500]); }
            $restored[] = $target['rel'];
        }
        update_option($state_key, ['status' => 'rolled-back', 'restored' => $restored, 'updated_at' => gmdate('c')], false);
        if (function_exists('do_action')) do_action('litespeed_purge_all');
        if (!headers_sent()) {
            header('X-LiteSpeed-Purge: *');
            header('X-LiteSpeed-Cache-Control: no-cache');
        }
        if (function_exists('wp_cache_flush')) wp_cache_flush();
        clearstatcache();
        return rest_ensure_response(['ok' => true, 'restored' => $restored]);
    };

    register_rest_route($namespace, '/apply', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_key, $safe_path, $state_key, $restore_all, $overlay_manifest) {
            $manifest_raw = file_get_contents($overlay_manifest);
            $manifest = is_string($manifest_raw) ? json_decode($manifest_raw, true) : null;
            $expected_routes = ['learn/academy','learn/atlas','learn/cultivation-science','learn/glossary','learn/plant-health','learn/search','learn/sops','learn/sources','learn/symptoms','learn/tools','community/grow-offs','games/seed-ascent'];
            $expected_shared = ['_next/static','seed-ascent','seed-ascent.html'];
            if (!is_array($manifest)
                || ($manifest['canonicalOrigin'] ?? '') !== 'https://dtfseeds.com'
                || ($manifest['repository'] ?? '') !== 'dtfgenetics/Dtf420'
                || ($manifest['routePrefixes'] ?? null) !== $expected_routes
                || ($manifest['sharedPaths'] ?? null) !== $expected_shared) {
                return new WP_Error('dtf_overlay_manifest', 'Dtf420 overlay manifest does not match the approved production contract.', ['status' => 409]);
            }
            foreach ([
                'dtf-content-overlay/learn/academy/index.html',
                'dtf-content-overlay/learn/atlas/seed-germination/seed-anatomy/index.html',
                'dtf-content-overlay/learn/cultivation-science/outdoor-site-and-sun-mapping/index.html',
                'dtf-content-overlay/learn/plant-health/two-spotted-spider-mite/index.html',
                'dtf-content-overlay/learn/sops/ph-meter-calibration-and-measurement/index.html',
                'dtf-content-overlay/learn/symptoms/lower-leaf-yellowing/index.html',
                'dtf-content-overlay/learn/tools/plant-health-intake/index.html',
                'dtf-content-overlay/community/grow-offs/solo-cup-grow-off/index.html',
                'dtf-content-overlay/games/seed-ascent/index.html',
                'dtf-content-overlay/seed-ascent.html',
            ] as $required) {
                $path = $safe_path($required);
                if ($path === false || !is_file($path) || filesize($path) < 1) {
                    return new WP_Error('dtf_overlay_required', 'Dtf420 overlay is incomplete.', ['status' => 409, 'path' => $required]);
                }
            }

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
                $tmp = $item['path'] . '.dtf-route-promote-' . wp_generate_uuid4();
                if (file_put_contents($tmp, $item['next'], LOCK_EX) !== strlen($item['next']) || !hash_equals(hash('sha256', $item['next']), (string) @hash_file('sha256', $tmp))) {
                    @unlink($tmp); $restore_all();
                    return new WP_Error('dtf_route_stage', 'Could not stage exact route promotion; rollback attempted.', ['status' => 500, 'path' => $item['rel']]);
                }
                @chmod($tmp, (int) $item['backup']['mode']);
                if (!@rename($tmp, $item['path'])) { @unlink($tmp); $restore_all(); return new WP_Error('dtf_route_commit', 'Could not commit route promotion; rollback attempted.', ['status' => 500, 'path' => $item['rel']]); }
                $changed[] = $item['rel'];
            }
            if (function_exists('do_action')) do_action('litespeed_purge_all');
            if (!headers_sent()) {
                header('X-LiteSpeed-Purge: *');
                header('X-LiteSpeed-Cache-Control: no-cache');
            }
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            clearstatcache();
            update_option($state_key, ['status' => 'applied', 'changed' => $changed, 'already' => $already, 'overlay_commit' => $manifest['commit'] ?? '', 'updated_at' => gmdate('c')], false);
            return rest_ensure_response(['ok' => true, 'changed' => $changed, 'already' => $already, 'overlay_commit' => $manifest['commit'] ?? '']);
        },
    ]);

    register_rest_route($namespace, '/rollback', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($restore_all) { return $restore_all(); },
    ]);

    register_rest_route($namespace, '/finalize', [
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
  return wpRequest(`/wp-json/${promotionNamespace}/${endpoint}`, {
    method: 'POST',
    headers: { 'X-DTF-Route-Promotion-Token': repairToken },
    json: { _dtf_route_promotion_token: repairToken },
  });
}

async function probe(route) {
  const url = new URL(route, siteUrl);
  url.searchParams.set('dtf_route_promotion', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'user-agent': 'DTFSeeds-Route-Promotion/2.0',
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
    },
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  return { response, text };
}

async function verifyOwnPage(route, marker = '/_next/static/') {
  let last = '';
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const { response, text } = await probe(route);
      last = `HTTP ${response.status} ${response.headers.get('location') || ''}`;
      if (response.status === 200
          && !response.headers.get('location')
          && text.includes(marker)
          && text.includes('https://dtfseeds.com')
          && !/https?:\/\/(?:www\.)?dtf420\.com/i.test(text)) return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000 + attempt * 700);
  }
  throw new Error(`Promoted DTFSeeds route failed verification: ${route} (${last})`);
}

async function verifySeedAscent() {
  let last = '';
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const wrapper = await probe('/games/seed-ascent/');
      const launcher = await probe('/seed-ascent.html');
      const engine = await probe('/seed-ascent/engine.js');
      const levels = await probe('/seed-ascent/levels.js');
      const styles = await probe('/seed-ascent/styles.css');

      const wrapperOk = wrapper.response.status === 200
        && !wrapper.response.headers.get('location')
        && /Seed Ascent/i.test(wrapper.text)
        && wrapper.text.includes('<iframe')
        && wrapper.text.includes('/seed-ascent.html')
        && wrapper.text.includes('/_next/static/')
        && wrapper.text.includes('https://dtfseeds.com')
        && !/https?:\/\/(?:www\.)?dtf420\.com/i.test(wrapper.text)
        && !/wp-content|wp-includes|wordpress/i.test(wrapper.text);
      const launcherOk = launcher.response.status === 200
        && !launcher.response.headers.get('location')
        && /Seed Ascent/i.test(launcher.text)
        && launcher.text.includes('id="game"')
        && launcher.text.includes('/seed-ascent/levels.js')
        && launcher.text.includes('/seed-ascent/engine.js');
      const engineOk = engine.response.status === 200
        && !engine.response.headers.get('location')
        && engine.text.includes('__seedAscentDebug')
        && engine.text.includes('doubleUsed');
      const levelsOk = levels.response.status === 200
        && !levels.response.headers.get('location')
        && levels.text.includes('SEED_ASCENT_LEVELS');
      const stylesOk = styles.response.status === 200
        && !styles.response.headers.get('location')
        && styles.text.length > 500;

      last = `wrapper=${wrapper.response.status}/${wrapperOk} launcher=${launcher.response.status}/${launcherOk} engine=${engine.response.status}/${engineOk} levels=${levels.response.status}/${levelsOk} styles=${styles.response.status}/${stylesOk}`;
      if (wrapperOk && launcherOk && engineOk && levelsOk && stylesOk) return;
      console.warn(`[seed-ascent-verify] attempt ${attempt}/8 did not converge: ${last}`);
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      console.warn(`[seed-ascent-verify] attempt ${attempt}/8 failed: ${last}`);
    }
    await sleep(1200 + attempt * 900);
  }
  throw new Error(`Seed Ascent wrapper/runtime verification failed after promotion (${last}).`);
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

  for (const route of [
    '/learn/academy/',
    '/learn/atlas/seed-germination/seed-anatomy/',
    '/learn/cultivation-science/outdoor-site-and-sun-mapping/',
    '/learn/glossary/',
    '/learn/plant-health/two-spotted-spider-mite/',
    '/learn/sops/ph-meter-calibration-and-measurement/',
    '/learn/symptoms/lower-leaf-yellowing/',
    '/learn/tools/plant-health-intake/',
    '/community/grow-offs/solo-cup-grow-off/',
  ]) {
    await verifyOwnPage(route);
  }

  // Seed Ascent is intentionally a Dtf420 Next.js wrapper around a dedicated
  // standalone runtime. Verify those two ownership layers independently so a valid
  // wrapper is never mistaken for the raw game canvas (or vice versa).
  await verifySeedAscent();

  const learnHub = await probe('/learn/');
  if (learnHub.response.status !== 200 || learnHub.response.headers.get('location')) {
    throw new Error(`WordPress-owned /learn/ hub was not preserved: HTTP ${learnHub.response.status}`);
  }
}

async function cleanup() {
  if (snippetId && !rollbackFailed) {
    let suffix = '';
    if (!(await waitForSnippetApi())) {
      if (await waitForSnippetApi(true)) suffix = '?snippets-safe-mode=1';
    }
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate${suffix}`, { method: 'POST', allow: [400, 404, 500] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
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
      name: `DTF Public Route Promotion ${runId}`,
      desc: 'Temporary authenticated promotion of canonical game routes and reviewed Dtf420 child-route rewrites.',
      code: snippetCode,
      tags: ['dtf-release', 'temporary', 'route-promotion'],
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
  if (result.body?.ok !== true) throw new Error(`Route promotion did not report success: ${JSON.stringify(result.body).slice(0, 900)}`);
  applied = true;

  await verifyPromotion();

  const finalized = await callPromotion('finalize');
  if (finalized.body?.ok !== true) throw new Error(`Route promotion finalization failed: ${JSON.stringify(finalized.body).slice(0, 700)}`);
  applied = false;
  console.log(JSON.stringify({
    ok: true,
    routePromotion: 'finalized',
    namespace: promotionNamespace,
    overlayCommit: result.body.overlay_commit || '',
    changed: result.body.changed || [],
    already: result.body.already || [],
  }));
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
