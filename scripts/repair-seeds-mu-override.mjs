import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const expectedSha = 'a32f9a10a5f79580d665d8d2c4718993a9d4bc14070eb8a26a4a2386f8535a3c';
const staleSeeds = 'DTF Genetics catalog pages built around strain identity and grow context.';
const canonicalSeeds = 'DTF Genetics library';
const requiredSeedsMarkers = [
  'Open Berry Blue profile',
  'Open Berry Lemonade profile',
  'Open Zestberry profile',
  'Open Blue Bubblegum profile',
  'Open Blue Cali Glue profile',
  'Open Blue Mango profile',
  'Open Blue Mango BX1 profile',
  'Open Mango Bubbles profile',
  'Open Blue Frequency profile',
  'Open Rainbow Bubblegum profile',
  'Open Mystery Line profile',
];
const staleHome = 'THC Grow Doc, genetics, cultivation education, and games in one home.';
const staleLearn = 'Grow education belongs in a clean, readable library.';
const mcpEndpoint = `${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
let mcpSession = '';

async function wpRequest(path, { method = 'GET', json, headers = {}, allow = [], redirect = 'follow', timeout = 45_000 } = {}) {
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
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WP ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body, text, headers: Object.fromEntries(response.headers.entries()) };
}

async function wpGetRetry(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { last = error; await sleep(900 + attempt * 700); }
  }
  throw last || new Error(`GET ${path} failed after retries.`);
}

function parseRpcText(text) {
  try { return JSON.parse(text); } catch {}
  const lines = String(text).split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).filter(Boolean);
  for (const line of lines) { try { return JSON.parse(line); } catch {} }
  return null;
}

async function mcpRpc(payload) {
  const headers = { Authorization: auth, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
  if (mcpSession) headers['Mcp-Session-Id'] = mcpSession;
  const response = await fetch(mcpEndpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(45_000) });
  const next = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id');
  if (next) mcpSession = next;
  const text = await response.text();
  const body = parseRpcText(text);
  if (!response.ok || !body || body.error) throw new Error(`Hostinger MCP request failed (${response.status})`);
  return body;
}

async function flushHostingerCacheBestEffort() {
  try {
    let initialized = false;
    for (const protocolVersion of ['2025-06-18', '2025-03-26', '2024-11-05']) {
      try {
        mcpSession = '';
        await mcpRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'DTFSeedsMuRepair', version: '1.0.0' } } });
        initialized = true;
        break;
      } catch {}
    }
    if (!initialized) throw new Error('MCP initialization failed.');
    try { await mcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }); } catch {}
    const result = await mcpRpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'hostinger-ai-assistant-litespeed-cache-flush', arguments: {} } });
    if (result?.result?.isError === true) throw new Error('LiteSpeed cache tool returned isError.');
    return true;
  } catch (error) {
    console.warn(`Hostinger cache purge unavailable; continuing with WordPress/object-cache purge and no-cache verification: ${error.message}`);
    return false;
  }
}

function contains(text, needle) {
  return String(text).toLowerCase().includes(String(needle).toLowerCase());
}

function seedsState(text) {
  return {
    bytes: Buffer.byteLength(String(text)),
    sha256: crypto.createHash('sha256').update(String(text)).digest('hex'),
    canonical: contains(text, canonicalSeeds),
    stale: contains(text, staleSeeds),
    growNotes: contains(text, 'Grow Notes'),
    profiles: Object.fromEntries(requiredSeedsMarkers.map((marker) => [marker, contains(text, marker)])),
    profileCount: requiredSeedsMarkers.filter((marker) => contains(text, marker)).length,
  };
}

const token = crypto.randomBytes(32).toString('hex');
const code = String.raw`
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    $expected = '${expectedSha}';
    $target = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-homepage-override.php');
    $disabled = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-homepage-override.php.dtf-disabled');
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-repair-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };
    $describe = static function () use ($target, $disabled, $expected) {
        $live = is_file($target);
        $backup = is_file($disabled);
        $path = $live ? $target : ($backup ? $disabled : '');
        $content = $path !== '' && is_readable($path) ? (string) file_get_contents($path) : '';
        $sha = $path !== '' ? hash_file('sha256', $path) : null;
        return [
            'live' => $live,
            'backup' => $backup,
            'sha256' => $sha,
            'expected_sha256' => $expected,
            'hash_matches' => $sha !== null && hash_equals($expected, $sha),
            'bytes' => $path !== '' ? filesize($path) : 0,
            'markers' => [
                'template_redirect' => stripos($content, 'template_redirect') !== false,
                'stale_home' => stripos($content, 'THC Grow Doc, genetics, cultivation education, and games in one home.') !== false,
                'stale_learn' => stripos($content, 'Grow education belongs in a clean, readable library.') !== false || stripos($content, 'MOPS, cultivation notes, THC basics') !== false,
                'stale_seeds' => stripos($content, 'DTF Genetics catalog pages built around strain identity and grow context.') !== false,
                'seeds_path' => stripos($content, '/seeds/') !== false || stripos($content, "is_page('seeds')") !== false || stripos($content, 'is_page("seeds")') !== false,
            ],
        ];
    };

    register_rest_route('dtf-seeds-mu-repair/v1', '/state', [
        'methods' => 'GET',
        'permission_callback' => $permission,
        'callback' => static function () use ($describe) { return rest_ensure_response(['ok' => true, 'state' => $describe()]); },
    ]);

    register_rest_route('dtf-seeds-mu-repair/v1', '/disable', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($target, $disabled, $expected, $describe) {
            if (!is_dir(WPMU_PLUGIN_DIR) || !is_writable(WPMU_PLUGIN_DIR)) return new WP_Error('dtf_mu_dir', 'MU plugin directory is not writable.', ['status' => 500]);
            if (!is_file($target) && is_file($disabled)) {
                $sha = hash_file('sha256', $disabled);
                if (!hash_equals($expected, $sha)) return new WP_Error('dtf_mu_disabled_hash', 'Existing disabled backup does not match the confirmed override hash.', ['status' => 409, 'sha256' => $sha]);
                return rest_ensure_response(['ok' => true, 'changed' => false, 'state' => $describe()]);
            }
            if (!is_file($target) || !is_readable($target)) return new WP_Error('dtf_mu_missing', 'Confirmed live MU override is unavailable.', ['status' => 409]);
            if (is_file($disabled)) return new WP_Error('dtf_mu_collision', 'Disabled backup path already exists while live override remains present.', ['status' => 409]);
            $content = (string) file_get_contents($target);
            $sha = hash_file('sha256', $target);
            if (!hash_equals($expected, $sha)) return new WP_Error('dtf_mu_hash', 'MU override hash changed; refusing repair.', ['status' => 409, 'sha256' => $sha]);
            if (stripos($content, 'template_redirect') === false ||
                stripos($content, 'THC Grow Doc, genetics, cultivation education, and games in one home.') === false ||
                (stripos($content, 'Grow education belongs in a clean, readable library.') === false && stripos($content, 'MOPS, cultivation notes, THC basics') === false)) {
                return new WP_Error('dtf_mu_markers', 'MU override no longer matches the confirmed stale full-page renderer.', ['status' => 409]);
            }
            $mode = fileperms($target) & 0777;
            if (!rename($target, $disabled)) return new WP_Error('dtf_mu_rename', 'Could not disable the confirmed MU override.', ['status' => 500]);
            clearstatcache(true, $target); clearstatcache(true, $disabled);
            if (is_file($target) || !is_file($disabled) || !hash_equals($expected, hash_file('sha256', $disabled))) {
                @rename($disabled, $target);
                return new WP_Error('dtf_mu_verify', 'Disable verification failed; original override restored.', ['status' => 500]);
            }
            @chmod($disabled, $mode);
            update_option('dtf_seeds_mu_override_repair_v1', ['status' => 'disabled', 'sha256' => $expected, 'updated_at' => gmdate('c')], false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'changed' => true, 'state' => $describe()]);
        },
    ]);

    register_rest_route('dtf-seeds-mu-repair/v1', '/restore', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($target, $disabled, $expected, $describe) {
            if (is_file($target) && hash_equals($expected, hash_file('sha256', $target))) return rest_ensure_response(['ok' => true, 'restored' => false, 'state' => $describe()]);
            if (!is_file($disabled) || !hash_equals($expected, hash_file('sha256', $disabled))) return new WP_Error('dtf_mu_restore_source', 'Verified disabled backup is unavailable.', ['status' => 409]);
            if (is_file($target)) return new WP_Error('dtf_mu_restore_collision', 'Live MU override path is occupied.', ['status' => 409]);
            if (!rename($disabled, $target)) return new WP_Error('dtf_mu_restore', 'Could not restore MU override.', ['status' => 500]);
            update_option('dtf_seeds_mu_override_repair_v1', ['status' => 'restored', 'sha256' => $expected, 'updated_at' => gmdate('c')], false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'restored' => true, 'state' => $describe()]);
        },
    ]);
});
`.trim();

let snippetId = 0;
let overrideDisabled = false;
let rollbackFailed = false;

async function cleanupSnippet() {
  if (!snippetId || rollbackFailed) return;
  try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
  try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
}

async function createRepairBridge() {
  const ready = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (!ready.ok) throw new Error('Code Snippets REST API is unavailable; refusing to use plugin-management fallback.');
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Seeds MU Override Repair ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary hash-gated transaction that disables the confirmed stale DTF MU full-page renderer and rolls back if Seeds does not converge.',
      code,
      tags: ['dtf-repair', 'seeds', 'mu-override', 'temporary'],
      scope: 'global', priority: 1, active: false, network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary repair snippet did not return an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });
}

async function verifyRestCanonical() {
  const edit = await wpGetRetry('/wp-json/wp/v2/pages/868?context=edit&_fields=id,slug,status,modified_gmt,content');
  const raw = edit.body?.content?.raw || '';
  const rendered = edit.body?.content?.rendered || '';
  const rawState = seedsState(raw);
  const renderedState = seedsState(rendered);
  if (!rawState.canonical || rawState.stale || rawState.profileCount !== requiredSeedsMarkers.length) {
    throw new Error(`Page 868 REST raw content is not canonical after repair: ${JSON.stringify(rawState)}`);
  }
  if (!renderedState.canonical || renderedState.stale || renderedState.profileCount !== requiredSeedsMarkers.length) {
    throw new Error(`Page 868 REST rendered content is not canonical after repair: ${JSON.stringify(renderedState)}`);
  }
  return { raw: rawState, rendered: renderedState, modified_gmt: edit.body?.modified_gmt || null };
}

async function verifyPublicRoute(path, label) {
  let lastState = null;
  let lastHeaders = null;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const joiner = path.includes('?') ? '&' : '?';
    try {
      const response = await wpRequest(`${path}${joiner}dtf_seeds_mu_repair=${process.env.GITHUB_RUN_ID || Date.now()}-${attempt}-${crypto.randomBytes(5).toString('hex')}`, {
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-MU-Repair/1.0' },
      });
      lastState = seedsState(response.text);
      lastHeaders = response.headers;
      if (response.ok && lastState.canonical && !lastState.stale && !lastState.growNotes && lastState.profileCount === requiredSeedsMarkers.length) {
        return { label, path, status: response.status, headers: lastHeaders, content: lastState };
      }
    } catch (error) {
      lastState = { error: error.message };
    }
    await sleep(1200 + attempt * 600);
  }
  throw new Error(`${label} did not converge to the 11-profile Genetics library: ${JSON.stringify({ state: lastState, headers: lastHeaders })}`);
}

async function verifyCollateralRoutes() {
  const checks = [
    ['/', staleHome],
    ['/learn/', staleLearn],
  ];
  const results = [];
  for (const [path, staleMarker] of checks) {
    const response = await wpRequest(`${path}${path.includes('?') ? '&' : '?'}dtf_mu_collateral=${crypto.randomBytes(6).toString('hex')}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-MU-Repair/1.0' },
    });
    if (!response.ok || contains(response.text, staleMarker) || Buffer.byteLength(response.text) < 1000) {
      throw new Error(`Collateral route ${path} failed after MU override disable: status=${response.status}, stale=${contains(response.text, staleMarker)}, bytes=${Buffer.byteLength(response.text)}`);
    }
    results.push({ path, status: response.status, bytes: Buffer.byteLength(response.text), stale: false });
  }
  return results;
}

try {
  await createRepairBridge();

  const before = await wpGetRetry('/wp-json/dtf-seeds-mu-repair/v1/state', { headers: { 'X-DTF-Repair-Token': token } });
  if (before.body?.state?.hash_matches !== true) {
    throw new Error(`Loaded MU override does not match the confirmed repair hash: ${JSON.stringify(before.body?.state || before.body)}`);
  }

  const disabled = await wpRequest('/wp-json/dtf-seeds-mu-repair/v1/disable', { method: 'POST', headers: { 'X-DTF-Repair-Token': token } });
  if (disabled.body?.ok !== true) throw new Error('MU override disable endpoint did not return success.');
  overrideDisabled = true;

  const hostingerCachePurged = await flushHostingerCacheBestEffort();
  const rest = await verifyRestCanonical();
  const pretty = await verifyPublicRoute('/seeds/', 'pretty-permalink');
  const direct = await verifyPublicRoute('/index.php?page_id=868', 'direct-page-id');
  const collateral = await verifyCollateralRoutes();

  console.log(JSON.stringify({
    ok: true,
    changed: Boolean(disabled.body?.changed),
    expected_sha256: expectedSha,
    hostinger_cache_purged: hostingerCachePurged,
    before: before.body?.state || null,
    after: disabled.body?.state || null,
    rest,
    public: [pretty, direct],
    collateral,
  }));
} catch (error) {
  if (snippetId && overrideDisabled) {
    try {
      await wpRequest('/wp-json/dtf-seeds-mu-repair/v1/restore', { method: 'POST', headers: { 'X-DTF-Repair-Token': token } });
      await flushHostingerCacheBestEffort();
      overrideDisabled = false;
      console.error('Seeds MU repair verification failed; the confirmed override was restored.');
    } catch (restoreError) {
      rollbackFailed = true;
      console.error(`CRITICAL: MU override rollback failed: ${restoreError.message}`);
    }
  }
  throw error;
} finally {
  await cleanupSnippet();
}
