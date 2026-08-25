import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import process from 'node:process';

const execFileAsync = promisify(execFile);
const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const mcpEndpoint = `${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const runId = String(process.env.GITHUB_RUN_ID || Date.now());
const repairToken = crypto.randomBytes(32).toString('hex');
const repairKey = `game_${runId.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 40)}`;
const stateOption = `dtf_game_repair_state_${repairKey}`;
const backupPrefix = `dtf_game_repair_backup_${repairKey}_`;
let mcpSession = '';
let snippetId = null;
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedByRepair = false;
let activatedByRepair = false;
let pluginRestId = 'code-snippets/code-snippets';
let repairChanged = [];
let rollbackFailed = false;
let repairSucceeded = false;

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
        params: { protocolVersion, capabilities: {}, clientInfo: { name: 'DTFGameRouteRepair', version: '1.0.0' } },
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

async function mcpTool(name, args = {}) {
  const body = await mcpRpc({
    jsonrpc: '2.0', id: crypto.randomInt(1000, 9000000), method: 'tools/call',
    params: { name, arguments: args },
  });
  if (mcpToolFailed(body)) throw new Error(`Hostinger MCP tool ${name} reported failure.`);
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
  console.warn(`Hostinger cache purge unavailable; cache-busted verification will continue: ${lastError?.message || 'unknown error'}`);
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
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
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
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(1200 + attempt * 900); }
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
  return `/wp-json/wp/v2/plugins/${String(pluginId || 'code-snippets/code-snippets').split('/').map(encodeURIComponent).join('/')}`;
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
    const result = await wpRequest('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
    if (result.body?.plugin) return result.body;
  } catch (error) { installError = error; }
  const recovered = await waitForCodeSnippetsPlugin();
  if (recovered) return recovered;
  throw installError || new Error('WordPress native plugin install did not produce Code Snippets.');
}

async function setPluginStatus(pluginId, status) {
  return wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status } });
}

async function collectDirectory(sourceDir, relativePrefix) {
  const output = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name !== '.gitkeep') {
        const relWithin = relative(sourceDir, full).split(sep).join('/');
        output.push({ source: full, rel: `${relativePrefix}/${relWithin}` });
      }
    }
  }
  await walk(sourceDir);
  return output;
}

async function collectPayloadFiles() {
  const specs = [
    { source: join(process.cwd(), 'site/public-route-patch/games/index.html'), rel: 'games/index.html' },
    { source: join(process.cwd(), 'site/public-route-patch/games/dtf-route.css'), rel: 'games/dtf-route.css' },
    ...(await collectDirectory(join(process.cwd(), 'site/public-route-patch/games/high-iq'), 'games/high-iq')),
    ...(await collectDirectory(join(process.cwd(), 'site/public-route-patch/games/grower-conversations'), 'games/grower-conversations')),
  ];
  specs.sort((a, b) => a.rel.localeCompare(b.rel));
  const seen = new Set();
  const payload = [];
  for (const spec of specs) {
    if (seen.has(spec.rel)) throw new Error(`Duplicate repair path: ${spec.rel}`);
    seen.add(spec.rel);
    const raw = await readFile(spec.source);
    if (!raw.length) continue;
    payload.push({
      rel: spec.rel,
      sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      content_b64: raw.toString('base64'),
      bytes: raw.length,
    });
  }
  if (payload.length < 8) throw new Error(`Expected a complete game-route payload; found only ${payload.length} files.`);
  return payload;
}

function batches(files, maxRawBytes = 75_000) {
  const out = [];
  let batch = [];
  let bytes = 0;
  for (const file of files) {
    if (file.bytes > 240_000) throw new Error(`Repair file exceeds per-file safety limit: ${file.rel}`);
    if (batch.length && bytes + file.bytes > maxRawBytes) {
      out.push(batch); batch = []; bytes = 0;
    }
    batch.push(file); bytes += file.bytes;
  }
  if (batch.length) out.push(batch);
  return out;
}

const tokenLiteral = JSON.stringify(repairToken);
const stateLiteral = JSON.stringify(stateOption);
const backupLiteral = JSON.stringify(backupPrefix);
const snippetCode = `
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $state_key = ${stateLiteral};
    $backup_prefix = ${backupLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-repair-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };
    $allowed = static function ($rel) {
        if (!is_string($rel) || $rel === '' || strlen($rel) > 220) return false;
        if ($rel[0] === '/' || strpos($rel, '..') !== false || strpos($rel, '\\\\') !== false || strpos($rel, '//') !== false) return false;
        if (!preg_match('#^[A-Za-z0-9._/-]+$#', $rel)) return false;
        if ($rel === 'games/index.html' || $rel === 'games/dtf-route.css') return true;
        if (strpos($rel, 'games/high-iq/') === 0) return true;
        if (strpos($rel, 'games/grower-conversations/') === 0) return true;
        return false;
    };
    $backup_key = static function ($rel) use ($backup_prefix) { return $backup_prefix . md5($rel); };
    $safe_path = static function ($rel) {
        $root = trailingslashit(wp_normalize_path(ABSPATH));
        $path = wp_normalize_path(ABSPATH . $rel);
        if (strpos($path, $root) !== 0) return false;
        return $path;
    };
    $rollback = static function () use ($state_key, $backup_key, $safe_path) {
        $state = get_option($state_key, []);
        $written = is_array($state['written'] ?? null) ? array_reverse($state['written']) : [];
        $restored = [];
        foreach ($written as $rel) {
            $backup = get_option($backup_key($rel));
            $path = $safe_path($rel);
            if (!$path || !is_array($backup)) continue;
            if (!empty($backup['existed'])) {
                $raw = base64_decode((string) ($backup['content_b64'] ?? ''), true);
                if ($raw === false) return new WP_Error('dtf_restore_decode_failed', 'Backup decode failed.', ['status' => 500, 'path' => $rel]);
                if (!is_dir(dirname($path)) && !wp_mkdir_p(dirname($path))) return new WP_Error('dtf_restore_mkdir_failed', 'Restore directory creation failed.', ['status' => 500, 'path' => $rel]);
                if (file_put_contents($path, $raw, LOCK_EX) === false) return new WP_Error('dtf_restore_write_failed', 'Backup restore failed.', ['status' => 500, 'path' => $rel]);
                @chmod($path, (int) ($backup['mode'] ?? 0644));
                if (!hash_equals((string) ($backup['sha256'] ?? ''), hash_file('sha256', $path))) return new WP_Error('dtf_restore_hash_failed', 'Restored file hash mismatch.', ['status' => 500, 'path' => $rel]);
            } else if (is_file($path)) {
                if (!unlink($path)) return new WP_Error('dtf_restore_unlink_failed', 'Could not remove newly created file.', ['status' => 500, 'path' => $rel]);
            }
            $restored[] = $rel;
        }
        update_option($state_key, ['status' => 'rolled-back', 'written' => [], 'restored' => $restored, 'updated_at' => gmdate('c')], false);
        if (function_exists('wp_cache_flush')) wp_cache_flush();
        return ['ok' => true, 'restored' => $restored];
    };

    register_rest_route('dtf-game-repair/v1', '/state', [
        'methods' => 'GET', 'permission_callback' => $permission,
        'callback' => static function () use ($state_key) {
            $state = get_option($state_key, []);
            return rest_ensure_response(is_array($state) ? $state : []);
        },
    ]);

    register_rest_route('dtf-game-repair/v1', '/write-files', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function (WP_REST_Request $request) use ($allowed, $backup_key, $safe_path, $state_key, $rollback) {
            $payload = $request->get_json_params();
            $files = is_array($payload['files'] ?? null) ? $payload['files'] : [];
            if (!$files || count($files) > 25) return new WP_Error('dtf_invalid_batch', 'Repair batch must contain 1-25 files.', ['status' => 400]);
            $total = 0;
            $prepared = [];
            foreach ($files as $item) {
                $rel = (string) ($item['rel'] ?? '');
                $sha = strtolower((string) ($item['sha256'] ?? ''));
                $encoded = (string) ($item['content_b64'] ?? '');
                if (!$allowed($rel) || !preg_match('/^[a-f0-9]{64}$/', $sha)) return new WP_Error('dtf_invalid_path_or_hash', 'File path or hash rejected.', ['status' => 400, 'path' => $rel]);
                $raw = base64_decode($encoded, true);
                if ($raw === false) return new WP_Error('dtf_invalid_base64', 'File payload could not be decoded.', ['status' => 400, 'path' => $rel]);
                $len = strlen($raw); $total += $len;
                if ($len > 240000 || $total > 300000) return new WP_Error('dtf_payload_too_large', 'Repair payload exceeded safety limits.', ['status' => 413]);
                if (!hash_equals($sha, hash('sha256', $raw))) return new WP_Error('dtf_payload_hash', 'Payload SHA-256 mismatch.', ['status' => 400, 'path' => $rel]);
                $path = $safe_path($rel);
                if (!$path) return new WP_Error('dtf_unsafe_path', 'Repair path escaped ABSPATH.', ['status' => 500, 'path' => $rel]);
                $prepared[] = ['rel' => $rel, 'sha' => $sha, 'raw' => $raw, 'path' => $path];
            }

            $state = get_option($state_key, []);
            if (!is_array($state)) $state = [];
            $written = is_array($state['written'] ?? null) ? $state['written'] : [];
            $unchanged = [];
            $changed = [];

            foreach ($prepared as $item) {
                $rel = $item['rel']; $path = $item['path']; $sha = $item['sha'];
                if (is_file($path) && hash_equals($sha, hash_file('sha256', $path))) { $unchanged[] = $rel; continue; }
                $key = $backup_key($rel);
                if (get_option($key, null) === null) {
                    $existed = is_file($path);
                    $old = $existed ? file_get_contents($path) : '';
                    if ($existed && $old === false) { $rollback(); return new WP_Error('dtf_backup_read_failed', 'Could not read existing file.', ['status' => 500, 'path' => $rel]); }
                    $backup = [
                        'path' => $rel,
                        'existed' => $existed,
                        'sha256' => $existed ? hash('sha256', $old) : '',
                        'content_b64' => $existed ? base64_encode($old) : '',
                        'mode' => $existed ? (fileperms($path) & 0777) : 0644,
                        'backed_at' => gmdate('c'),
                    ];
                    update_option($key, $backup, false);
                    $stored = get_option($key);
                    if (!is_array($stored) || (bool) ($stored['existed'] ?? false) !== $existed || ($existed && !hash_equals($backup['sha256'], (string) ($stored['sha256'] ?? '')))) {
                        $rollback(); return new WP_Error('dtf_backup_verify_failed', 'Database backup verification failed.', ['status' => 500, 'path' => $rel]);
                    }
                }
                if (!is_dir(dirname($path)) && !wp_mkdir_p(dirname($path))) { $rollback(); return new WP_Error('dtf_mkdir_failed', 'Could not create target directory.', ['status' => 500, 'path' => $rel]); }
                if (!is_writable(dirname($path))) { $rollback(); return new WP_Error('dtf_not_writable', 'Target directory is not writable by WordPress.', ['status' => 500, 'path' => $rel]); }
                $tmp = $path . '.dtf-game-repair.tmp';
                if (file_put_contents($tmp, $item['raw'], LOCK_EX) === false) { @unlink($tmp); $rollback(); return new WP_Error('dtf_temp_write_failed', 'Temporary file write failed.', ['status' => 500, 'path' => $rel]); }
                @chmod($tmp, 0644);
                if (!hash_equals($sha, hash_file('sha256', $tmp))) { @unlink($tmp); $rollback(); return new WP_Error('dtf_temp_hash_failed', 'Temporary file SHA-256 mismatch.', ['status' => 500, 'path' => $rel]); }
                if (!@rename($tmp, $path)) { @unlink($tmp); $rollback(); return new WP_Error('dtf_rename_failed', 'Atomic replacement failed.', ['status' => 500, 'path' => $rel]); }
                if (!hash_equals($sha, hash_file('sha256', $path))) { $rollback(); return new WP_Error('dtf_live_hash_failed', 'Published file SHA-256 mismatch.', ['status' => 500, 'path' => $rel]); }
                if (!in_array($rel, $written, true)) $written[] = $rel;
                $changed[] = $rel;
                update_option($state_key, ['status' => 'writing', 'written' => $written, 'updated_at' => gmdate('c')], false);
            }
            update_option($state_key, ['status' => 'written', 'written' => $written, 'updated_at' => gmdate('c')], false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            return rest_ensure_response(['ok' => true, 'changed' => $changed, 'unchanged' => $unchanged, 'written_total' => count($written)]);
        },
    ]);

    register_rest_route('dtf-game-repair/v1', '/rollback', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($rollback) {
            $result = $rollback();
            return is_wp_error($result) ? $result : rest_ensure_response($result);
        },
    ]);

    register_rest_route('dtf-game-repair/v1', '/finalize', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($state_key, $backup_key) {
            $state = get_option($state_key, []);
            $written = is_array($state['written'] ?? null) ? $state['written'] : [];
            $deleted = 0;
            foreach ($written as $rel) {
                $key = $backup_key($rel);
                if (get_option($key, null) !== null && delete_option($key)) $deleted++;
            }
            delete_option($state_key);
            return rest_ensure_response(['ok' => true, 'backup_options_deleted' => $deleted]);
        },
    ]);
});
`.trim();

async function cleanupTemporaryTools() {
  if (snippetId && !rollbackFailed) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (rollbackFailed) {
    console.error('Rollback failed; leaving temporary game-route repair tooling in place for recovery.');
    return;
  }
  if (installedByRepair && !pluginWasInstalled) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByRepair && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
}

async function repairState() {
  try {
    const state = await wpGetRetry('/wp-json/dtf-game-repair/v1/state', {
      headers: { 'X-DTF-Repair-Token': repairToken }, allow: [404],
    });
    return state.ok && state.body && typeof state.body === 'object' ? state.body : null;
  } catch { return null; }
}

async function verifyLiveCore() {
  const checks = [
    ['/games/', ['Pick what is playable. See what is coming next.', 'href="/seeds/"', 'href="/shop/"'], ['server-engine alpha', 'implementation gates']],
    ['/games/high-iq/', ['/games/dtf-route.css', './high-iq.css', './app.js'], ['/assets/dtf-gateway-v2.css']],
    ['/games/grower-conversations/', ['./grower-conversations.css', './app.js'], ['/assets/dtf-gateway-v2.css']],
  ];
  for (const [route, required, forbidden] of checks) {
    let verified = false;
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const response = await fetch(`${siteUrl}${route}?dtf_game_repair=${encodeURIComponent(runId)}-${attempt}`, {
          headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' }, redirect: 'follow', signal: AbortSignal.timeout(45_000),
        });
        const body = await response.text();
        if (response.ok && required.every(marker => body.toLowerCase().includes(marker.toLowerCase())) && forbidden.every(marker => !body.toLowerCase().includes(marker.toLowerCase()))) {
          verified = true; break;
        }
      } catch {}
      await sleep(2500 + attempt * 700);
    }
    if (!verified) throw new Error(`Live route verification failed for ${route}`);
  }
  const assets = [
    '/games/dtf-route.css',
    '/games/high-iq/high-iq.css',
    '/games/high-iq/app.js',
    '/games/high-iq/data/manifest.json',
    '/games/grower-conversations/grower-conversations.css',
    '/games/grower-conversations/app.js',
    '/games/grower-conversations/data/prompt-bank.json',
  ];
  for (const route of assets) {
    const response = await fetch(`${siteUrl}${route}?dtf_game_repair=${encodeURIComponent(runId)}`, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`Published asset failed HTTP verification: ${route} (${response.status})`);
  }
}

async function runFullLiveAudits() {
  for (const script of ['scripts/validate-public-navigation.mjs', 'scripts/audit-game-route-integrity.mjs']) {
    const { stdout, stderr } = await execFileAsync(process.execPath, [script], {
      cwd: process.cwd(), env: { ...process.env, BASE_URL: siteUrl }, maxBuffer: 8 * 1024 * 1024,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }
}

try {
  const files = await collectPayloadFiles();
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  console.log(`Prepared ${files.length} whitelisted game-route files (${totalBytes} bytes).`);

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
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.');
  }

  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Game Route Repair ${runId}`,
      desc: 'Temporary authenticated transactional publisher for the reviewed DTF Game Hub, High IQ, and Grower Conversations static routes.',
      code: snippetCode,
      tags: ['dtf-repair', 'game-routes', 'temporary'],
      scope: 'global', priority: 1, active: false, network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary game-route repair snippet was created without a usable ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  for (const [index, batch] of batches(files).entries()) {
    const result = await wpRequest('/wp-json/dtf-game-repair/v1/write-files', {
      method: 'POST', headers: { 'X-DTF-Repair-Token': repairToken },
      json: { files: batch.map(({ rel, sha256, content_b64 }) => ({ rel, sha256, content_b64 })) },
    });
    if (result.body?.ok !== true) throw new Error(`Game-route batch ${index + 1} failed: ${JSON.stringify(result.body).slice(0, 700)}`);
    repairChanged.push(...(Array.isArray(result.body.changed) ? result.body.changed : []));
    console.log(`Published repair batch ${index + 1}; changed=${result.body.changed?.length || 0}, unchanged=${result.body.unchanged?.length || 0}.`);
  }

  const state = await repairState();
  if (!state || state.status !== 'written') throw new Error(`Repair state was not committed: ${JSON.stringify(state).slice(0, 500)}`);

  await flushHostingerCacheBestEffort();
  await verifyLiveCore();
  await runFullLiveAudits();

  const finalized = await wpRequest('/wp-json/dtf-game-repair/v1/finalize', {
    method: 'POST', headers: { 'X-DTF-Repair-Token': repairToken },
  });
  if (finalized.body?.ok !== true) throw new Error('Game-route repair backups could not be finalized.');
  repairSucceeded = true;
  console.log(`Transactional game-route repair succeeded. Changed files: ${repairChanged.length}. Full live audit passed before backup finalization.`);
} catch (error) {
  const state = snippetId ? await repairState() : null;
  const hasWrites = Array.isArray(state?.written) && state.written.length > 0;
  if (snippetId && hasWrites) {
    try {
      const rolled = await wpRequest('/wp-json/dtf-game-repair/v1/rollback', {
        method: 'POST', headers: { 'X-DTF-Repair-Token': repairToken },
      });
      if (rolled.body?.ok !== true) throw new Error(`Rollback endpoint returned: ${JSON.stringify(rolled.body).slice(0, 500)}`);
      await flushHostingerCacheBestEffort();
      console.error(`Automatic rollback restored ${rolled.body.restored?.length || 0} game-route files.`);
    } catch (rollbackError) {
      rollbackFailed = true;
      console.error(`Automatic game-route rollback also failed: ${rollbackError.message}`);
    }
  }
  throw error;
} finally {
  await cleanupTemporaryTools();
  console.log(`Temporary game-route repair cleanup complete. Success=${repairSucceeded ? 'yes' : 'no'}; changed=${repairChanged.length}; rollbackFailed=${rollbackFailed ? 'yes' : 'no'}.`);
}
