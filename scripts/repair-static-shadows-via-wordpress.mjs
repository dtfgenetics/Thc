import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const mcpEndpoint = `${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
let mcpSession = '';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
        params: { protocolVersion, capabilities: {}, clientInfo: { name: 'DTFSeedsStaticShadowRepair', version: '2.0.0' } },
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
  if (!result) return true;
  if (result.isError === true) return true;
  const text = Array.isArray(result.content)
    ? result.content.map(item => item?.text || '').join('\n')
    : JSON.stringify(result);
  return /(^|\b)(error|failed|failure)(\b|:)/i.test(text) && !/no error/i.test(text);
}

async function mcpTool(name, args = {}, { allowFailure = false } = {}) {
  const body = await mcpRpc({ jsonrpc: '2.0', id: crypto.randomInt(1000, 9000000), method: 'tools/call', params: { name, arguments: args } });
  if (!allowFailure && mcpToolFailed(body)) {
    throw new Error(`Hostinger MCP tool ${name} reported failure.`);
  }
  return body;
}

async function flushHostingerCacheBestEffort() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      mcpSession = '';
      await initMcp();
      await mcpTool('hostinger-ai-assistant-litespeed-cache-flush', {});
      console.log('Hostinger LiteSpeed cache purge succeeded.');
      return true;
    } catch (error) {
      lastError = error;
      await sleep(attempt * 2500);
    }
  }
  console.warn(`Hostinger cache purge was unavailable; continuing with cache-busted verification: ${lastError?.message || 'unknown error'}`);
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
      await sleep(1500 + attempt * 1000);
    }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const check = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
      if (check.ok) return true;
    } catch {}
    await sleep(1200 + attempt * 700);
  }
  return false;
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
    await sleep(1500 + attempt * 900);
  }
  return null;
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
  return wpRequest(pluginEndpoint(pluginId), {
    method: 'POST',
    json: { status },
  });
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

    $targets = [
        ['rel' => 'index.html', 'markers' => ['dtf-home.css', 'THC Grow Doc, genetics, cultivation education, and games in one home.']],
        ['rel' => 'learn/index.html', 'markers' => ['Grow education belongs in a clean, readable library.', 'MOPS, cultivation notes, THC basics']],
        ['rel' => 'learn/infographics/index.html', 'markers' => ['being rebuilt', 'Reserved strain card', 'Tool-ready rebuild']],
    ];

    $backup_key = static function ($rel) { return 'dtf_shadow_backup_' . md5($rel); };
    $state_key = 'dtf_shadow_repair_state';

    register_rest_route('dtf-repair/v1', '/static-shadow-state', [
        'methods' => 'GET',
        'permission_callback' => $permission,
        'callback' => static function () use ($state_key) {
            $state = get_option($state_key, []);
            return rest_ensure_response(is_array($state) ? $state : []);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/retire-static-shadows', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_key, $state_key) {
            $root = trailingslashit(wp_normalize_path(ABSPATH));
            $prepared = [];
            $skipped = [];

            foreach ($targets as $target) {
                $rel = $target['rel'];
                $path = wp_normalize_path(ABSPATH . $rel);
                if (strpos($path, $root) !== 0) {
                    return new WP_Error('dtf_unsafe_path', 'Repair path escaped ABSPATH.', ['status' => 500]);
                }
                if (!is_file($path)) {
                    $skipped[] = ['path' => $rel, 'reason' => 'missing'];
                    continue;
                }
                $content = file_get_contents($path);
                if ($content === false) {
                    return new WP_Error('dtf_read_failed', 'Could not read candidate shadow file.', ['status' => 500, 'path' => $rel]);
                }
                $matched = false;
                foreach ($target['markers'] as $marker) {
                    if (stripos($content, $marker) !== false) { $matched = true; break; }
                }
                if (!$matched) {
                    $skipped[] = ['path' => $rel, 'reason' => 'marker-mismatch'];
                    continue;
                }
                if (!is_writable($path) || !is_writable(dirname($path))) {
                    return new WP_Error('dtf_not_writable', 'Candidate shadow file is not writable by WordPress.', ['status' => 500, 'path' => $rel]);
                }
                $key = $backup_key($rel);
                $backup = [
                    'path' => $rel,
                    'sha256' => hash('sha256', $content),
                    'content_b64' => base64_encode($content),
                    'mode' => fileperms($path) & 0777,
                    'backed_at' => gmdate('c'),
                ];
                update_option($key, $backup, false);
                $stored = get_option($key);
                if (!is_array($stored) || ($stored['sha256'] ?? '') !== $backup['sha256']) {
                    return new WP_Error('dtf_backup_failed', 'Database backup verification failed.', ['status' => 500, 'path' => $rel]);
                }
                $prepared[] = ['path' => $path, 'rel' => $rel, 'key' => $key, 'backup' => $backup];
            }

            $removed = [];
            foreach ($prepared as $item) {
                if (!unlink($item['path'])) {
                    foreach ($removed as $prior) {
                        $raw = base64_decode($prior['backup']['content_b64'], true);
                        if ($raw !== false) {
                            file_put_contents($prior['path'], $raw, LOCK_EX);
                            @chmod($prior['path'], (int) $prior['backup']['mode']);
                        }
                    }
                    return new WP_Error('dtf_delete_failed', 'A shadow file could not be removed; prior removals were restored.', ['status' => 500, 'path' => $item['rel']]);
                }
                $removed[] = $item;
            }

            $state = [
                'status' => 'retired',
                'removed' => array_values(array_map(static fn($item) => $item['rel'], $removed)),
                'skipped' => $skipped,
                'updated_at' => gmdate('c'),
            ];
            update_option($state_key, $state, false);
            flush_rewrite_rules(true);
            if (function_exists('wp_cache_flush')) { wp_cache_flush(); }
            return rest_ensure_response([
                'ok' => true,
                'removed' => $state['removed'],
                'skipped' => $skipped,
                'backup_keys' => array_values(array_map(static fn($item) => $item['key'], $removed)),
            ]);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/restore-static-shadows', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_key, $state_key) {
            $restored = [];
            foreach ($targets as $target) {
                $rel = $target['rel'];
                $backup = get_option($backup_key($rel));
                if (!is_array($backup) || empty($backup['content_b64'])) { continue; }
                $raw = base64_decode($backup['content_b64'], true);
                if ($raw === false) { continue; }
                $path = wp_normalize_path(ABSPATH . $rel);
                if (file_put_contents($path, $raw, LOCK_EX) === false) {
                    return new WP_Error('dtf_restore_failed', 'Could not restore a backed-up shadow file.', ['status' => 500, 'path' => $rel]);
                }
                @chmod($path, (int) ($backup['mode'] ?? 0644));
                $restored[] = $rel;
            }
            update_option($state_key, ['status' => 'restored', 'restored' => $restored, 'updated_at' => gmdate('c')], false);
            flush_rewrite_rules(true);
            if (function_exists('wp_cache_flush')) { wp_cache_flush(); }
            return rest_ensure_response(['ok' => true, 'restored' => $restored]);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/finalize-static-shadows', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($targets, $backup_key, $state_key) {
            $deleted = [];
            foreach ($targets as $target) {
                $key = $backup_key($target['rel']);
                if (get_option($key, null) !== null) {
                    delete_option($key);
                    $deleted[] = $key;
                }
            }
            delete_option($state_key);
            return rest_ensure_response(['ok' => true, 'backup_options_deleted' => count($deleted)]);
        },
    ]);
});
`.trim();

let snippetId = null;
let pluginWasActive = false;
let pluginWasInstalled = false;
let installedByRepair = false;
let activatedByRepair = false;
let pluginRestId = 'code-snippets/code-snippets';
let removedFiles = [];
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

async function recoverRepairState() {
  try {
    const state = await wpGetRetry('/wp-json/dtf-repair/v1/static-shadow-state', {
      headers: { 'X-DTF-Repair-Token': repairToken },
      allow: [404],
    });
    if (state.ok && state.body?.status === 'retired' && Array.isArray(state.body.removed)) {
      removedFiles = state.body.removed;
      return state.body;
    }
  } catch {}
  return null;
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

    if (!(await waitForSnippetApi())) {
      throw new Error('Code Snippets REST API did not become available after native WordPress installation/activation.');
    }
  }

  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Static Shadow Repair ${runId}`,
      desc: 'Temporary, authenticated, transactional cleanup for stale static HTML files shadowing current WordPress routes.',
      code: snippetCode,
      tags: ['dtf-repair', 'temporary'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary repair snippet was created without a usable ID.');

  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  let repair;
  try {
    repair = await wpRequest('/wp-json/dtf-repair/v1/retire-static-shadows', {
      method: 'POST',
      headers: { 'X-DTF-Repair-Token': repairToken },
    });
    if (repair.body?.ok !== true) throw new Error(`Repair endpoint did not return success: ${JSON.stringify(repair.body).slice(0, 500)}`);
    removedFiles = Array.isArray(repair.body.removed) ? repair.body.removed : [];
  } catch (error) {
    const recovered = await recoverRepairState();
    if (!recovered) throw error;
    console.warn('Recovered successful shadow-removal state after an ambiguous HTTP failure.');
  }

  if (removedFiles.length < 1) {
    throw new Error(`No known stale static shadow file was removed. Result: ${JSON.stringify(repair?.body || {}).slice(0, 900)}`);
  }

  await flushHostingerCacheBestEffort();

  const checks = [
    ['/', 'Genetics. Plant science. Tools. Games. Community.'],
    ['/learn/', 'Explore by subject'],
    ['/learn/infographics/', 'Visual plant science and cultivation library.'],
  ];
  for (const [path, marker] of checks) {
    let seen = false;
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const response = await fetch(`${siteUrl}${path}?dtf_static_repair=${encodeURIComponent(runId)}-${attempt}`, {
          headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
          redirect: 'follow',
        });
        const text = await response.text();
        if (response.ok && text.toLowerCase().includes(marker.toLowerCase())) {
          seen = true;
          break;
        }
      } catch {}
      await sleep(3500 + attempt * 900);
    }
    if (!seen) throw new Error(`Visitor-facing route ${path} did not expose expected current marker after shadow removal.`);
  }

  await wpRequest('/wp-json/dtf-repair/v1/finalize-static-shadows', {
    method: 'POST',
    headers: { 'X-DTF-Repair-Token': repairToken },
  });
  repairSucceeded = true;
} catch (error) {
  if (snippetId && removedFiles.length === 0) await recoverRepairState();
  if (snippetId && removedFiles.length) {
    try {
      await wpRequest('/wp-json/dtf-repair/v1/restore-static-shadows', {
        method: 'POST',
        headers: { 'X-DTF-Repair-Token': repairToken },
      });
      await flushHostingerCacheBestEffort();
    } catch (restoreError) {
      rollbackFailed = true;
      console.error(`Automatic rollback also failed: ${restoreError.message}`);
    }
  }
  throw error;
} finally {
  await cleanupTemporaryTools();
  console.log(`Temporary repair cleanup complete. Repair success: ${repairSucceeded ? 'yes' : 'no'}. Stale files retired: ${removedFiles.length}.`);
}
