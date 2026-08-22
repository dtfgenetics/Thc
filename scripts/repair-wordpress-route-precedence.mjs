import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mcpEndpoint = `${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
let mcpSession = '';

function parseRpcText(text) {
  try { return JSON.parse(text); } catch {}
  const dataLines = String(text).split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .filter(Boolean);
  for (const line of dataLines) {
    try { return JSON.parse(line); } catch {}
  }
  return null;
}

async function mcpRpc(payload) {
  const headers = {
    Authorization: auth,
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };
  if (mcpSession) headers['Mcp-Session-Id'] = mcpSession;
  const response = await fetch(mcpEndpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
  const nextSession = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id');
  if (nextSession) mcpSession = nextSession;
  const text = await response.text();
  const body = parseRpcText(text);
  if (!response.ok || !body || body.error) {
    throw new Error(`Hostinger MCP request failed (${response.status}): ${JSON.stringify(body?.error || body || text.slice(0, 500))}`);
  }
  return body;
}

async function initMcp() {
  let lastError;
  for (const protocolVersion of ['2025-06-18', '2025-03-26', '2024-11-05']) {
    try {
      await mcpRpc({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion, capabilities: {}, clientInfo: { name: 'DTFSeedsRoutePrecedenceRepair', version: '1.1.0' } },
      });
      try { await mcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }); } catch {}
      return;
    } catch (error) {
      lastError = error;
      mcpSession = '';
    }
  }
  throw lastError || new Error('Unable to initialize Hostinger MCP.');
}

function mcpToolFailed(body) {
  const result = body?.result;
  if (!result || result.isError === true) return true;
  const text = Array.isArray(result.content)
    ? result.content.map(item => item?.text || '').join('\n')
    : JSON.stringify(result);
  return /(^|\b)(error|failed|failure)(\b|:)/i.test(text) && !/no error/i.test(text);
}

async function flushHostingerCacheBestEffort() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      mcpSession = '';
      await initMcp();
      const body = await mcpRpc({
        jsonrpc: '2.0', id: crypto.randomInt(1000, 9000000), method: 'tools/call',
        params: { name: 'hostinger-ai-assistant-litespeed-cache-flush', arguments: {} },
      });
      if (mcpToolFailed(body)) throw new Error('Hostinger LiteSpeed cache tool reported failure.');
      console.log('Hostinger LiteSpeed cache purge succeeded.');
      return true;
    } catch (error) {
      lastError = error;
      await sleep(attempt * 2500);
    }
  }
  console.warn(`Hostinger cache purge unavailable; continuing with cache-busted checks: ${lastError?.message || 'unknown error'}`);
  return false;
}

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
  return list.body.find(plugin => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(pluginId) {
  const safe = String(pluginId || 'code-snippets/code-snippets')
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `/wp-json/wp/v2/plugins/${safe}`;
}

async function waitForCodeSnippetsPlugin() {
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const plugin = await queryCodeSnippetsPlugin();
      if (plugin) return plugin;
    } catch {}
    await sleep(1500 + attempt * 800);
  }
  return null;
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const check = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
      if (check.ok) return true;
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
        $supplied = (string) $request->get_header('x-dtf-repair-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };

    $path = wp_normalize_path(ABSPATH . '.htaccess');
    $backup_key = 'dtf_route_precedence_htaccess_backup_v1';
    $state_key = 'dtf_route_precedence_state_v1';

    $legacy = [
        'directory_index' => 'DirectoryIndex index.html index.php',
        'root' => 'RewriteRule ^$ /index.html [L]',
        'sections' => 'RewriteRule ^(seeds|learn|about|contact|gallery|community|shop)/?$ /$1/index.html [L]',
    ];
    $canonical = [
        'directory_index' => 'DirectoryIndex index.php index.html',
        'root' => 'RewriteRule ^$ /index.php [L]',
        'sections' => "RewriteRule ^learn/infographics/?$ /index.php [L]\nRewriteRule ^(seeds|learn|about|contact|gallery|community|shop)/?$ /index.php [L]",
    ];

    register_rest_route('dtf-repair/v1', '/route-precedence-state', [
        'methods' => 'GET',
        'permission_callback' => $permission,
        'callback' => static function () use ($state_key) {
            $state = get_option($state_key, []);
            return rest_ensure_response(is_array($state) ? $state : []);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/apply-route-precedence', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($path, $backup_key, $state_key, $legacy, $canonical) {
            if (!is_file($path) || !is_readable($path) || !is_writable($path)) {
                return new WP_Error('dtf_htaccess_unavailable', '.htaccess is not safely readable and writable.', ['status' => 500]);
            }
            $content = file_get_contents($path);
            if ($content === false) return new WP_Error('dtf_htaccess_read', 'Could not read .htaccess.', ['status' => 500]);

            $already = strpos($content, $canonical['directory_index']) !== false
                && strpos($content, $canonical['root']) !== false
                && strpos($content, $canonical['sections']) !== false;
            if ($already) {
                update_option($state_key, ['status' => 'already-canonical', 'changed' => false, 'updated_at' => gmdate('c')], false);
                return rest_ensure_response(['ok' => true, 'changed' => false]);
            }

            foreach ($legacy as $key => $directive) {
                if (substr_count($content, $directive) !== 1) {
                    return new WP_Error('dtf_unexpected_htaccess', 'Expected exactly one legacy routing directive.', ['status' => 409, 'directive' => $key]);
                }
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

            $next = $content;
            foreach ($legacy as $key => $directive) {
                $next = str_replace($directive, $canonical[$key], $next, $count);
                if ($count !== 1) {
                    return new WP_Error('dtf_htaccess_replace', 'Route replacement count was not exactly one.', ['status' => 409, 'directive' => $key, 'count' => $count]);
                }
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
            return rest_ensure_response(['ok' => true, 'changed' => true, 'after_sha256' => $state['after_sha256']]);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/restore-route-precedence', [
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

    register_rest_route('dtf-repair/v1', '/finalize-route-precedence', [
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
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (rollbackFailed) {
    console.error('Rollback failed; leaving temporary repair tooling in place for recovery.');
    return;
  }
  if (installedByRepair && !pluginWasInstalled) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByRepair && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
}

async function recoverState() {
  try {
    const state = await wpGetRetry('/wp-json/dtf-repair/v1/route-precedence-state', {
      headers: { 'X-DTF-Repair-Token': repairToken },
      allow: [404],
    });
    if (state.ok && ['applied', 'already-canonical'].includes(state.body?.status)) return state.body;
  } catch {}
  return null;
}

async function verifyLive(runId) {
  const checks = [
    ['/', 'Genetics. Plant science. Tools. Games. Community.'],
    ['/learn/', 'Explore by subject'],
    ['/learn/infographics/', 'Visual plant science and cultivation library.'],
  ];
  for (const [path, marker] of checks) {
    let seen = false;
    let lastStatus = 0;
    let lastExcerpt = '';
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const response = await fetch(`${siteUrl}${path}?dtf_route_precedence=${encodeURIComponent(runId)}-${attempt}`, {
          headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
          redirect: 'follow',
        });
        const text = await response.text();
        lastStatus = response.status;
        lastExcerpt = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
        const stale = [
          'THC Grow Doc, genetics, cultivation education, and games in one home.',
          'Grow education belongs in a clean, readable library.',
          'MOPS, cultivation notes, THC basics',
          'being rebuilt',
          'Reserved strain card',
          'Tool-ready rebuild',
        ].some(value => text.toLowerCase().includes(value.toLowerCase()));
        if (response.ok && text.toLowerCase().includes(marker.toLowerCase()) && !stale) {
          seen = true;
          break;
        }
      } catch {}
      await sleep(2500 + attempt * 900);
    }
    if (!seen) throw new Error(`Live route ${path} did not verify after route repair (last HTTP ${lastStatus}). Excerpt: ${lastExcerpt}`);
    console.log(`${path} verified after route-precedence repair.`);
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
    if (!plugin) {
      plugin = await installCodeSnippetsNative();
      installedByRepair = true;
    }
    if (plugin?.plugin) pluginRestId = plugin.plugin;
    if (plugin?.status !== 'active') {
      const activated = await setPluginStatus(pluginRestId, 'active');
      activatedByRepair = true;
      if (activated.body?.plugin) pluginRestId = activated.body.plugin;
    } else if (!pluginWasActive) {
      activatedByRepair = true;
    }
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available after native WordPress installation/activation.');
  }

  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Route Precedence Repair ${runId}`,
      desc: 'Temporary authenticated transaction that makes WordPress canonical routes take precedence over obsolete static HTML shadows.',
      code: snippetCode,
      tags: ['dtf-repair', 'routing', 'temporary'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary route repair snippet was created without a usable ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  let applied;
  try {
    applied = await wpRequest('/wp-json/dtf-repair/v1/apply-route-precedence', {
      method: 'POST',
      headers: { 'X-DTF-Repair-Token': repairToken },
    });
    if (applied.body?.ok !== true) throw new Error(`Route repair endpoint did not return success: ${JSON.stringify(applied.body).slice(0, 500)}`);
    routeChanged = applied.body?.changed === true;
  } catch (error) {
    const state = await recoverState();
    if (!state) throw error;
    routeChanged = state.status === 'applied' && state.changed !== false;
    console.warn('Recovered route-precedence state after an ambiguous HTTP failure.');
  }

  await flushHostingerCacheBestEffort();
  await verifyLive(runId);

  await wpRequest('/wp-json/dtf-repair/v1/finalize-route-precedence', {
    method: 'POST',
    headers: { 'X-DTF-Repair-Token': repairToken },
  });
  repairSucceeded = true;
} catch (error) {
  if (snippetId && routeChanged) {
    try {
      await wpRequest('/wp-json/dtf-repair/v1/restore-route-precedence', {
        method: 'POST',
        headers: { 'X-DTF-Repair-Token': repairToken },
      });
      await flushHostingerCacheBestEffort();
      console.warn('Route-precedence repair failed verification; original .htaccess was restored.');
    } catch (restoreError) {
      rollbackFailed = true;
      console.error(`Automatic .htaccess rollback also failed: ${restoreError.message}`);
    }
  }
  throw error;
} finally {
  await cleanupTemporaryTools();
  console.log(`Route-precedence repair complete. Success: ${repairSucceeded ? 'yes' : 'no'}. Changed: ${routeChanged ? 'yes' : 'no'}.`);
}
