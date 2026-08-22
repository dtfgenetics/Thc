import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const expectedSha = 'a32f9a10a5f79580d665d8d2c4718993a9d4bc14070eb8a26a4a2386f8535a3c';
const mcpEndpoint = `${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
let mcpSession = '';

async function wpRequest(path, { method = 'GET', json, headers = {}, allow = [], redirect = 'follow' } = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect,
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WP ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body, text, headers: response.headers };
}

async function wpGetRetry(path, options = {}) {
  let last;
  for (let i = 1; i <= 6; i++) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { last = error; await sleep(1000 + i * 900); }
  }
  throw last || new Error(`GET ${path} failed after retries.`);
}

function pluginEndpoint(id) {
  return `/wp-json/wp/v2/plugins/${String(id || 'code-snippets/code-snippets').split('/').map(encodeURIComponent).join('/')}`;
}

async function queryPlugin() {
  const r = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!r.ok || !Array.isArray(r.body)) return null;
  return r.body.find(p => String(p?.plugin || '').startsWith('code-snippets/')) || null;
}

async function waitForPlugin() {
  for (let i = 0; i < 8; i++) {
    const p = await queryPlugin().catch(() => null);
    if (p) return p;
    await sleep(1200 + i * 700);
  }
  return null;
}

async function waitForSnippetApi() {
  for (let i = 0; i < 10; i++) {
    const r = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] }).catch(() => null);
    if (r?.ok) return true;
    await sleep(1000 + i * 650);
  }
  return false;
}

function parseRpcText(text) {
  try { return JSON.parse(text); } catch {}
  const lines = String(text).split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).filter(Boolean);
  for (const line of lines) { try { return JSON.parse(line); } catch {} }
  return null;
}

async function mcpRpc(payload) {
  const headers = { Authorization: auth, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
  if (mcpSession) headers['Mcp-Session-Id'] = mcpSession;
  const response = await fetch(mcpEndpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
  const next = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id');
  if (next) mcpSession = next;
  const text = await response.text();
  const body = parseRpcText(text);
  if (!response.ok || !body || body.error) throw new Error(`Hostinger MCP request failed (${response.status})`);
  return body;
}

async function flushHostingerCache() {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      mcpSession = '';
      let initialized = false;
      for (const protocolVersion of ['2025-06-18', '2025-03-26', '2024-11-05']) {
        try {
          await mcpRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'DTFOverrideRepair', version: '1.0.0' } } });
          initialized = true;
          break;
        } catch (error) { last = error; mcpSession = ''; }
      }
      if (!initialized) throw last || new Error('MCP initialization failed.');
      try { await mcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }); } catch {}
      const result = await mcpRpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'hostinger-ai-assistant-litespeed-cache-flush', arguments: {} } });
      if (result?.result?.isError === true) throw new Error('LiteSpeed cache tool returned isError.');
      console.log('Hostinger LiteSpeed cache purge succeeded.');
      return true;
    } catch (error) {
      last = error;
      await sleep(attempt * 2500);
    }
  }
  throw last || new Error('Hostinger cache purge failed.');
}

let plugin = await queryPlugin();
const pluginWasInstalled = Boolean(plugin);
const pluginWasActive = plugin?.status === 'active';
let installed = false;
let activated = false;
let pluginId = plugin?.plugin || 'code-snippets/code-snippets';
let snippetId = 0;
let overrideDisabled = false;
let rollbackFailed = false;

async function cleanup() {
  if (snippetId && !rollbackFailed) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (rollbackFailed) return;
  if (installed && !pluginWasInstalled) {
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400, 404] }); } catch {}
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activated && !pluginWasActive) {
    try { await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400, 404] }); } catch {}
  }
}

const token = crypto.randomBytes(32).toString('hex');
const tokenLiteral = JSON.stringify(token);
const code = `
add_filter('redirect_canonical', function ($redirect, $requested) {
    $token = ${tokenLiteral};
    $supplied = isset($_GET['dtf_origin_check']) ? (string) $_GET['dtf_origin_check'] : '';
    if ($supplied !== '' && hash_equals($token, $supplied)) return false;
    return $redirect;
}, 999, 2);

add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-repair-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };
    $target = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-homepage-override.php');
    $disabled = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-homepage-override.php.dtf-disabled');
    $expected = '${expectedSha}';
    $state_key = 'dtf_mu_override_repair_state_v1';

    register_rest_route('dtf-repair/v1', '/disable-stale-mu-override', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($target, $disabled, $expected, $state_key) {
            if (!is_dir(WPMU_PLUGIN_DIR) || !is_writable(WPMU_PLUGIN_DIR)) return new WP_Error('dtf_mu_dir', 'MU plugin directory is not writable.', ['status' => 500]);
            if (!is_file($target) && is_file($disabled)) {
                $sha = hash_file('sha256', $disabled);
                if ($sha !== $expected) return new WP_Error('dtf_disabled_mismatch', 'Existing disabled backup hash does not match expected stale override.', ['status' => 409]);
                update_option($state_key, ['status' => 'already-disabled', 'sha256' => $sha, 'updated_at' => gmdate('c')], false);
                return rest_ensure_response(['ok' => true, 'changed' => false, 'sha256' => $sha]);
            }
            if (!is_file($target) || !is_readable($target) || !is_writable($target)) return new WP_Error('dtf_mu_missing', 'Expected stale MU override is unavailable.', ['status' => 409]);
            if (is_file($disabled)) return new WP_Error('dtf_mu_backup_exists', 'Disabled backup path already exists while live override is present.', ['status' => 409]);
            $content = file_get_contents($target);
            if ($content === false) return new WP_Error('dtf_mu_read', 'Could not read MU override.', ['status' => 500]);
            $sha = hash('sha256', $content);
            if ($sha !== $expected) return new WP_Error('dtf_mu_hash', 'MU override hash changed; refusing destructive repair.', ['status' => 409, 'sha256' => $sha]);
            if (stripos($content, 'THC Grow Doc, genetics, cultivation education, and games in one home.') === false ||
                (stripos($content, 'Grow education belongs in a clean, readable library.') === false && stripos($content, 'MOPS, cultivation notes, THC basics') === false) ||
                stripos($content, 'template_redirect') === false) {
                return new WP_Error('dtf_mu_markers', 'MU override no longer matches the confirmed stale renderer.', ['status' => 409]);
            }
            $mode = fileperms($target) & 0777;
            if (!rename($target, $disabled)) return new WP_Error('dtf_mu_rename', 'Could not disable stale MU override.', ['status' => 500]);
            clearstatcache(true, $target); clearstatcache(true, $disabled);
            if (is_file($target) || !is_file($disabled) || hash_file('sha256', $disabled) !== $expected) {
                @rename($disabled, $target);
                return new WP_Error('dtf_mu_verify', 'MU override disable did not verify; original restored.', ['status' => 500]);
            }
            @chmod($disabled, $mode);
            $state = ['status' => 'disabled', 'changed' => true, 'sha256' => $expected, 'backup' => basename($disabled), 'updated_at' => gmdate('c')];
            update_option($state_key, $state, false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'changed' => true, 'sha256' => $expected]);
        },
    ]);

    register_rest_route('dtf-repair/v1', '/restore-stale-mu-override', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($target, $disabled, $expected, $state_key) {
            if (is_file($target) && hash_file('sha256', $target) === $expected) return rest_ensure_response(['ok' => true, 'restored' => false, 'already_live' => true]);
            if (!is_file($disabled) || hash_file('sha256', $disabled) !== $expected) return new WP_Error('dtf_mu_restore_source', 'Verified disabled MU backup is unavailable.', ['status' => 409]);
            if (is_file($target)) return new WP_Error('dtf_mu_restore_collision', 'Live MU override path is occupied.', ['status' => 409]);
            if (!rename($disabled, $target)) return new WP_Error('dtf_mu_restore', 'Could not restore MU override backup.', ['status' => 500]);
            update_option($state_key, ['status' => 'restored', 'sha256' => $expected, 'updated_at' => gmdate('c')], false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'restored' => true]);
        },
    ]);
});
`.trim();

async function ensureSnippetBridge() {
  const ready = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (!ready.ok) {
    if (!plugin) {
      try {
        const r = await wpRequest('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
        plugin = r.body; installed = true;
      } catch (error) {
        plugin = await waitForPlugin();
        if (!plugin) throw error;
      }
    }
    pluginId = plugin?.plugin || pluginId;
    if (plugin?.status !== 'active') {
      const r = await wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'active' } });
      plugin = r.body; activated = true;
    }
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets API did not become available.');
  }
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Stale MU Override Repair ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary transactional repair that disables the confirmed stale DTF homepage/Learn MU renderer.',
      code,
      tags: ['dtf-repair', 'mu-override', 'temporary'],
      scope: 'global', priority: 1, active: false, network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Repair snippet missing ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });
}

function contains(text, value) { return String(text).toLowerCase().includes(value.toLowerCase()); }

async function verifyWordPressOrigin() {
  const checks = [
    [`/index.php?dtf_origin_check=${encodeURIComponent(token)}`, 'Genetics, cultivation education, practical tools, and original cannabis games.', 'THC Grow Doc, genetics, cultivation education, and games in one home.'],
    [`/index.php?pagename=learn&dtf_origin_check=${encodeURIComponent(token)}`, 'Understand the plant. Build the environment. Make better decisions.', 'Grow education belongs in a clean, readable library.'],
  ];
  for (const [path, currentMarker, oldMarker] of checks) {
    let ok = false;
    let excerpt = '';
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const r = await wpRequest(`${path}&attempt=${attempt}`, { headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' } });
        excerpt = r.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700);
        if (r.ok && contains(r.text, currentMarker) && !contains(r.text, oldMarker)) { ok = true; break; }
      } catch {}
      await sleep(1800 + attempt * 700);
    }
    if (!ok) throw new Error(`WordPress origin did not expose current content after MU override disable: ${path}. Excerpt: ${excerpt}`);
  }
}

try {
  await ensureSnippetBridge();
  const result = await wpRequest('/wp-json/dtf-repair/v1/disable-stale-mu-override', {
    method: 'POST', headers: { 'X-DTF-Repair-Token': token },
  });
  if (result.body?.ok !== true) throw new Error('MU override disable endpoint did not return success.');
  overrideDisabled = true;
  await flushHostingerCache();
  await verifyWordPressOrigin();
  console.log(JSON.stringify({ ok: true, changed: Boolean(result.body?.changed), sha256: result.body?.sha256 || expectedSha, origin_verified: true }));
} catch (error) {
  if (snippetId && overrideDisabled) {
    try {
      await wpRequest('/wp-json/dtf-repair/v1/restore-stale-mu-override', { method: 'POST', headers: { 'X-DTF-Repair-Token': token } });
      await flushHostingerCache();
      overrideDisabled = false;
      console.error('MU override repair failed; verified stale override was restored.');
    } catch (restoreError) {
      rollbackFailed = true;
      console.error(`MU override rollback failed: ${restoreError.message}`);
    }
  }
  throw error;
} finally {
  await cleanup();
}
