import fs from 'node:fs';
import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const archivePath = process.argv[2] || process.env.DTF_SUITE_ARCHIVE || '';
if (!username || !password) throw new Error('WordPress credentials are required.');
if (!archivePath || !fs.existsSync(archivePath)) throw new Error(`Public-suite archive not found: ${archivePath || '(missing)'}`);

const archive = fs.readFileSync(archivePath);
const archiveBytes = archive.length;
const archiveSha256 = crypto.createHash('sha256').update(archive).digest('hex');
if (archiveBytes < 1 || archiveBytes > 64 * 1024 * 1024) throw new Error(`Archive size ${archiveBytes} is outside the protected 1..64 MiB deployment limit.`);

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const repairToken = crypto.randomBytes(32).toString('hex');
const deploymentId = crypto.randomBytes(12).toString('hex');
const tokenLiteral = JSON.stringify(repairToken);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let mcpSession = '';
const mcpEndpoint = `${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
let snippetId = null;
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedByDeploy = false;
let activatedByDeploy = false;
let pluginRestId = 'code-snippets/code-snippets';
let deploymentCommitted = false;
let rollbackFailed = false;

function parseRpcText(text) {
  try { return JSON.parse(text); } catch {}
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    try { return JSON.parse(line.slice(5).trim()); } catch {}
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
  if (!response.ok || !body || body.error) throw new Error(`Hostinger MCP request failed (${response.status}): ${JSON.stringify(body?.error || body || text.slice(0, 500))}`);
  return body;
}

async function initMcp() {
  let lastError;
  for (const protocolVersion of ['2025-06-18', '2025-03-26', '2024-11-05']) {
    try {
      await mcpRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'DTFSeedsPublicSuiteDeploy', version: '1.0.0' } } });
      try { await mcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }); } catch {}
      return;
    } catch (error) { lastError = error; mcpSession = ''; }
  }
  throw lastError || new Error('Unable to initialize Hostinger MCP.');
}

function mcpToolFailed(body) {
  const result = body?.result;
  if (!result || result.isError === true) return true;
  const text = Array.isArray(result.content) ? result.content.map(item => item?.text || '').join('\n') : JSON.stringify(result);
  return /(^|\b)(error|failed|failure)(\b|:)/i.test(text) && !/no error/i.test(text);
}

async function mcpTool(name, args = {}) {
  const body = await mcpRpc({ jsonrpc: '2.0', id: crypto.randomInt(1000, 9000000), method: 'tools/call', params: { name, arguments: args } });
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
    } catch (error) { lastError = error; await sleep(attempt * 2500); }
  }
  console.warn(`Hostinger cache purge unavailable; continuing with cache-busted verification: ${lastError?.message || 'unknown error'}`);
  return false;
}

async function wpRequest(path, { method = 'GET', json, headers = {}, allow = [], rawBody } = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: rawBody !== undefined ? rawBody : (json !== undefined ? JSON.stringify(json) : undefined),
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
    catch (error) { lastError = error; await sleep(1200 + attempt * 900); }
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
    await sleep(1200 + attempt * 600);
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
    await sleep(1500 + attempt * 800);
  }
  throw installError || new Error('WordPress native plugin install did not produce Code Snippets.');
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-suite-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };

    $work_root = wp_normalize_path(ABSPATH . '.dtf-suite-work');
    $lock_key = 'dtf_suite_deploy_lock';
    $max_archive = 64 * 1024 * 1024;
    $max_uncompressed = 256 * 1024 * 1024;
    $max_file = 64 * 1024 * 1024;
    $max_files = 5000;
    $targets = [
        'games/index.html',
        'games/dtf-route.css',
        'games/high-land',
        'games/high-iq',
        'games/high-life',
        'games/grower-conversations',
        'games/seed-man-platformer',
        'games/weedopolis',
        'games/crossword',
        'games/who-took-it',
        'growlens',
        'thc-grow-doc',
        'tools',
        'projects',
        'puzzles',
    ];
    $exact_files = ['games/index.html', 'games/dtf-route.css'];
    $prefixes = [
        'games/high-land/', 'games/high-iq/', 'games/high-life/', 'games/grower-conversations/',
        'games/seed-man-platformer/', 'games/weedopolis/', 'games/crossword/', 'games/who-took-it/',
        'growlens/', 'thc-grow-doc/', 'tools/', 'projects/', 'puzzles/',
    ];

    $state_key = static function ($id) { return 'dtf_suite_state_' . $id; };
    $safe_id = static function ($id) { return is_string($id) && preg_match('/^[a-f0-9]{24}$/', $id); };
    $safe_sha = static function ($sha) { return is_string($sha) && preg_match('/^[a-f0-9]{64}$/', $sha); };
    $under_root = static function ($path, $root) {
        $path = wp_normalize_path($path);
        $root = trailingslashit(wp_normalize_path($root));
        return strpos($path, $root) === 0;
    };
    $allowed_file = static function ($rel) use ($exact_files, $prefixes) {
        if (in_array($rel, $exact_files, true)) return true;
        foreach ($prefixes as $prefix) if (strpos($rel, $prefix) === 0) return true;
        return false;
    };
    $allowed_dir = static function ($rel) use ($prefixes) {
        if ($rel === 'games/') return true;
        foreach ($prefixes as $prefix) {
            if ($rel === $prefix || strpos($rel, $prefix) === 0 || strpos($prefix, $rel) === 0) return true;
        }
        return false;
    };
    $safe_archive_name = static function ($name) {
        if (!is_string($name) || $name === '' || strpos($name, "\0") !== false || strpos($name, '\\') !== false) return false;
        if ($name[0] === '/' || preg_match('/^[A-Za-z]:\//', $name)) return false;
        foreach (explode('/', rtrim($name, '/')) as $part) if ($part === '..' || $part === '.') return false;
        return true;
    };
    $remove_tree = null;
    $remove_tree = static function ($path) use (&$remove_tree) {
        if (!file_exists($path) && !is_link($path)) return true;
        if (is_link($path) || is_file($path)) return @unlink($path);
        if (!is_dir($path)) return false;
        $items = scandir($path);
        if ($items === false) return false;
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            if (!$remove_tree($path . DIRECTORY_SEPARATOR . $item)) return false;
        }
        return @rmdir($path);
    };
    $dir_size = null;
    $dir_size = static function ($path) use (&$dir_size) {
        if (is_link($path)) return 0;
        if (is_file($path)) return (int) @filesize($path);
        if (!is_dir($path)) return 0;
        $sum = 0; $items = scandir($path); if ($items === false) return 0;
        foreach ($items as $item) if ($item !== '.' && $item !== '..') $sum += $dir_size($path . DIRECTORY_SEPARATOR . $item);
        return $sum;
    };
    $ensure_dir = static function ($path) {
        return is_dir($path) || wp_mkdir_p($path);
    };
    $owns_lock = static function ($id) use ($lock_key) {
        $lock = get_option($lock_key, []);
        return is_array($lock) && ($lock['id'] ?? '') === $id;
    };
    $rollback_state = static function ($id, $state, $remove_tree, $state_key, $lock_key) {
        $applied = is_array($state['applied'] ?? null) ? $state['applied'] : [];
        for ($i = count($applied) - 1; $i >= 0; $i--) {
            $item = $applied[$i];
            $rel = $item['rel'];
            $dst = wp_normalize_path(ABSPATH . $rel);
            $bak = $state['backup_dir'] . '/' . $rel;
            if (file_exists($dst) || is_link($dst)) {
                if (!$remove_tree($dst)) return new WP_Error('dtf_rollback_remove_failed', 'Could not remove deployed target during rollback.', ['status' => 500, 'path' => $rel]);
            }
            if (!empty($item['had_backup']) && (file_exists($bak) || is_link($bak))) {
                if (!is_dir(dirname($dst)) && !wp_mkdir_p(dirname($dst))) return new WP_Error('dtf_rollback_parent_failed', 'Could not restore target parent.', ['status' => 500, 'path' => $rel]);
                if (!@rename($bak, $dst)) return new WP_Error('dtf_rollback_restore_failed', 'Could not restore backed-up target.', ['status' => 500, 'path' => $rel]);
            }
        }
        $state['status'] = 'rolled_back';
        $state['rolled_back_at'] = gmdate('c');
        update_option($state_key($id), $state, false);
        delete_option($lock_key);
        if (function_exists('wp_cache_flush')) wp_cache_flush();
        return rest_ensure_response(['ok' => true, 'status' => 'rolled_back']);
    };

    register_rest_route('dtf-suite/v1', '/state/(?P<id>[a-f0-9]{24})', [
        'methods' => 'GET',
        'permission_callback' => $permission,
        'callback' => static function (WP_REST_Request $request) use ($state_key) {
            $state = get_option($state_key((string) $request['id']), []);
            return rest_ensure_response(is_array($state) ? $state : []);
        },
    ]);

    register_rest_route('dtf-suite/v1', '/init', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function (WP_REST_Request $request) use ($safe_id, $safe_sha, $work_root, $lock_key, $state_key, $max_archive, $remove_tree, $ensure_dir) {
            $id = (string) $request->get_param('deployment_id');
            $bytes = (int) $request->get_param('archive_bytes');
            $sha = strtolower((string) $request->get_param('archive_sha256'));
            if (!$safe_id($id) || !$safe_sha($sha) || $bytes < 1 || $bytes > $max_archive) return new WP_Error('dtf_invalid_init', 'Invalid deployment metadata.', ['status' => 400]);

            $existing = get_option($lock_key, []);
            if (is_array($existing) && !empty($existing['id']) && ($existing['id'] ?? '') !== $id) {
                $age = time() - (int) ($existing['ts'] ?? 0);
                if ($age >= 0 && $age < 3600) return new WP_Error('dtf_deploy_locked', 'Another public-suite deployment holds the server lock.', ['status' => 409]);
                delete_option($lock_key);
            }
            if (!get_option($lock_key, false)) {
                if (!add_option($lock_key, ['id' => $id, 'ts' => time()], '', false)) return new WP_Error('dtf_lock_failed', 'Could not acquire deployment lock.', ['status' => 409]);
            }

            if (!$ensure_dir($work_root)) { delete_option($lock_key); return new WP_Error('dtf_workdir_failed', 'Could not create deployment work root.', ['status' => 500]); }
            @file_put_contents($work_root . '/.htaccess', "Require all denied\nDeny from all\n", LOCK_EX);
            @file_put_contents($work_root . '/index.php', "<?php http_response_code(404); exit;\n", LOCK_EX);
            $dir = $work_root . '/' . $id;
            if (file_exists($dir) && !$remove_tree($dir)) { delete_option($lock_key); return new WP_Error('dtf_cleanup_failed', 'Could not clear prior deployment workspace.', ['status' => 500]); }
            if (!$ensure_dir($dir)) { delete_option($lock_key); return new WP_Error('dtf_workdir_failed', 'Could not create deployment workspace.', ['status' => 500]); }
            $state = [
                'id' => $id, 'status' => 'uploading', 'archive_bytes' => $bytes, 'archive_sha256' => $sha,
                'uploaded_bytes' => 0, 'work_dir' => $dir, 'started_at' => gmdate('c'), 'applied' => [],
            ];
            update_option($state_key($id), $state, false);
            return rest_ensure_response(['ok' => true, 'id' => $id, 'uploaded_bytes' => 0]);
        },
    ]);

    register_rest_route('dtf-suite/v1', '/chunk', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function (WP_REST_Request $request) use ($safe_id, $safe_sha, $owns_lock, $state_key) {
            $id = (string) $request->get_param('deployment_id');
            $offset = (int) $request->get_param('offset');
            $chunk_sha = strtolower((string) $request->get_param('chunk_sha256'));
            $b64 = (string) $request->get_param('data_b64');
            if (!$safe_id($id) || !$safe_sha($chunk_sha) || !$owns_lock($id)) return new WP_Error('dtf_invalid_chunk', 'Invalid or unlocked deployment chunk.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state) || ($state['status'] ?? '') !== 'uploading') return new WP_Error('dtf_bad_state', 'Deployment is not accepting chunks.', ['status' => 409]);
            $raw = base64_decode($b64, true);
            if ($raw === false || strlen($raw) < 1 || strlen($raw) > 768 * 1024) return new WP_Error('dtf_bad_chunk', 'Chunk payload is invalid or too large.', ['status' => 400]);
            if (!hash_equals($chunk_sha, hash('sha256', $raw))) return new WP_Error('dtf_chunk_hash', 'Chunk SHA-256 mismatch.', ['status' => 400]);
            $part = $state['work_dir'] . '/suite.zip.part';
            $current = is_file($part) ? (int) filesize($part) : 0;
            if ($offset !== $current || $offset !== (int) ($state['uploaded_bytes'] ?? 0)) return new WP_Error('dtf_chunk_offset', 'Chunk offset does not match server state.', ['status' => 409, 'uploaded_bytes' => $current]);
            if ($current + strlen($raw) > (int) $state['archive_bytes']) return new WP_Error('dtf_chunk_overflow', 'Chunk exceeds declared archive size.', ['status' => 400]);
            $written = file_put_contents($part, $raw, FILE_APPEND | LOCK_EX);
            if ($written !== strlen($raw)) return new WP_Error('dtf_chunk_write', 'Chunk could not be fully written.', ['status' => 500]);
            clearstatcache(true, $part);
            $state['uploaded_bytes'] = (int) filesize($part);
            update_option($state_key($id), $state, false);
            return rest_ensure_response(['ok' => true, 'uploaded_bytes' => $state['uploaded_bytes']]);
        },
    ]);

    register_rest_route('dtf-suite/v1', '/commit', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function (WP_REST_Request $request) use ($safe_id, $owns_lock, $state_key, $lock_key, $safe_archive_name, $allowed_file, $allowed_dir, $max_uncompressed, $max_file, $max_files, $targets, $dir_size, $remove_tree, $ensure_dir, $rollback_state) {
            @set_time_limit(180);
            $id = (string) $request->get_param('deployment_id');
            if (!$safe_id($id) || !$owns_lock($id)) return new WP_Error('dtf_invalid_commit', 'Invalid or unlocked deployment.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state)) return new WP_Error('dtf_missing_state', 'Deployment state is missing.', ['status' => 404]);
            if (($state['status'] ?? '') === 'deployed') return rest_ensure_response(['ok' => true, 'status' => 'deployed', 'recovered' => true]);
            if (($state['status'] ?? '') !== 'uploading') return new WP_Error('dtf_bad_state', 'Deployment cannot be committed from current state.', ['status' => 409]);

            $part = $state['work_dir'] . '/suite.zip.part';
            if (!is_file($part) || (int) filesize($part) !== (int) $state['archive_bytes'] || (int) $state['uploaded_bytes'] !== (int) $state['archive_bytes']) return new WP_Error('dtf_archive_size', 'Uploaded archive size does not match declaration.', ['status' => 400]);
            $actual_sha = hash_file('sha256', $part);
            if (!hash_equals((string) $state['archive_sha256'], (string) $actual_sha)) return new WP_Error('dtf_archive_hash', 'Whole-archive SHA-256 mismatch.', ['status' => 400]);
            if (!class_exists('ZipArchive')) return new WP_Error('dtf_zip_unavailable', 'PHP ZipArchive is required for protected suite deployment.', ['status' => 500]);

            $zip = new ZipArchive();
            if ($zip->open($part) !== true) return new WP_Error('dtf_zip_open', 'Uploaded archive is not a readable ZIP.', ['status' => 400]);
            if ($zip->numFiles < 2 || $zip->numFiles > $max_files + 1) { $zip->close(); return new WP_Error('dtf_zip_count', 'Archive file count is outside deployment limits.', ['status' => 400]); }

            $entry_names = [];
            $total = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (!$safe_archive_name($name)) { $zip->close(); return new WP_Error('dtf_zip_path', 'Unsafe archive path rejected.', ['status' => 400, 'path' => $name]); }
                if ($name === 'index.html' || strpos($name, 'learn/') === 0 || strpos($name, 'blog/') === 0) { $zip->close(); return new WP_Error('dtf_wp_owned_path', 'WordPress-owned route is forbidden in app deployment.', ['status' => 400, 'path' => $name]); }
                $is_dir = substr($name, -1) === '/';
                if ($name !== '.dtf-suite-manifest.json' && (($is_dir && !$allowed_dir($name)) || (!$is_dir && !$allowed_file($name)))) { $zip->close(); return new WP_Error('dtf_not_allowlisted', 'Archive path is outside the deployment allowlist.', ['status' => 400, 'path' => $name]); }
                if (method_exists($zip, 'getExternalAttributesIndex')) {
                    $opsys = 0; $attr = 0;
                    if ($zip->getExternalAttributesIndex($i, $opsys, $attr) && $opsys === 3) {
                        $mode = ($attr >> 16) & 0170000;
                        if ($mode === 0120000) { $zip->close(); return new WP_Error('dtf_zip_symlink', 'Symlink entries are forbidden.', ['status' => 400, 'path' => $name]); }
                    }
                }
                $stat = $zip->statIndex($i);
                $size = (int) ($stat['size'] ?? 0);
                if (!$is_dir && $size > $max_file) { $zip->close(); return new WP_Error('dtf_zip_file_size', 'Archive member exceeds size limit.', ['status' => 400, 'path' => $name]); }
                $total += $size;
                if ($total > $max_uncompressed) { $zip->close(); return new WP_Error('dtf_zip_total_size', 'Archive uncompressed size exceeds limit.', ['status' => 400]); }
                if (!$is_dir) $entry_names[] = $name;
            }

            $manifest_raw = $zip->getFromName('.dtf-suite-manifest.json');
            $manifest = is_string($manifest_raw) ? json_decode($manifest_raw, true) : null;
            if (!is_array($manifest) || ($manifest['schemaVersion'] ?? null) !== 1 || ($manifest['purpose'] ?? '') !== 'dtfseeds-public-apps-only' || !is_array($manifest['files'] ?? null)) { $zip->close(); return new WP_Error('dtf_manifest', 'Archive manifest is missing or invalid.', ['status' => 400]); }
            $excluded = is_array($manifest['wordPressOwnedRoutesExcluded'] ?? null) ? $manifest['wordPressOwnedRoutesExcluded'] : [];
            foreach (['/', '/learn/', '/blog/'] as $must_exclude) if (!in_array($must_exclude, $excluded, true)) { $zip->close(); return new WP_Error('dtf_manifest_exclusion', 'Manifest does not preserve WordPress route ownership.', ['status' => 400, 'route' => $must_exclude]); }
            $manifest_files = array_keys($manifest['files']); sort($manifest_files);
            $archive_files = array_values(array_filter($entry_names, static fn($n) => $n !== '.dtf-suite-manifest.json')); sort($archive_files);
            if ($manifest_files !== $archive_files) { $zip->close(); return new WP_Error('dtf_manifest_files', 'Manifest file list does not exactly match archive.', ['status' => 400]); }
            if ((int) ($manifest['fileCount'] ?? -1) !== count($manifest_files)) { $zip->close(); return new WP_Error('dtf_manifest_count', 'Manifest file count mismatch.', ['status' => 400]); }

            $stage = $state['work_dir'] . '/stage';
            $backup = $state['work_dir'] . '/backup';
            if ((file_exists($stage) && !$remove_tree($stage)) || (file_exists($backup) && !$remove_tree($backup))) { $zip->close(); return new WP_Error('dtf_stage_cleanup', 'Could not reset deployment stage.', ['status' => 500]); }
            if (!$ensure_dir($stage) || !$ensure_dir($backup)) { $zip->close(); return new WP_Error('dtf_stage_create', 'Could not create deployment stage/backup.', ['status' => 500]); }

            foreach ($manifest_files as $rel) {
                $meta = $manifest['files'][$rel];
                if (!$allowed_file($rel) || !is_array($meta) || !preg_match('/^[a-f0-9]{64}$/', (string) ($meta['sha256'] ?? ''))) { $zip->close(); return new WP_Error('dtf_manifest_member', 'Manifest member is invalid.', ['status' => 400, 'path' => $rel]); }
                $dest = $stage . '/' . $rel;
                if (!$ensure_dir(dirname($dest))) { $zip->close(); return new WP_Error('dtf_extract_parent', 'Could not create stage directory.', ['status' => 500, 'path' => $rel]); }
                $stream = $zip->getStream($rel);
                if (!$stream) { $zip->close(); return new WP_Error('dtf_extract_stream', 'Could not read archive member.', ['status' => 500, 'path' => $rel]); }
                $out = fopen($dest, 'wb');
                if (!$out) { fclose($stream); $zip->close(); return new WP_Error('dtf_extract_write', 'Could not create staged file.', ['status' => 500, 'path' => $rel]); }
                $copied = stream_copy_to_stream($stream, $out);
                fclose($stream); fclose($out);
                if ($copied === false || (int) $copied !== (int) ($meta['size'] ?? -1) || !hash_equals((string) $meta['sha256'], (string) hash_file('sha256', $dest))) { $zip->close(); return new WP_Error('dtf_extract_hash', 'Staged file failed size/hash verification.', ['status' => 500, 'path' => $rel]); }
            }
            $zip->close();

            foreach ((array) ($manifest['required'] ?? []) as $required) if (!is_file($stage . '/' . $required) || filesize($stage . '/' . $required) < 1) return new WP_Error('dtf_required_missing', 'Required staged file is missing.', ['status' => 500, 'path' => $required]);

            $current_bytes = 0;
            foreach ($targets as $rel) $current_bytes += $dir_size(wp_normalize_path(ABSPATH . $rel));
            $free = @disk_free_space(ABSPATH);
            $needed = (int) $total + (int) $current_bytes + (int) $state['archive_bytes'] + 64 * 1024 * 1024;
            if ($free !== false && (int) $free < $needed) return new WP_Error('dtf_disk_space', 'Insufficient disk space for staged deployment plus rollback backup.', ['status' => 507, 'free' => (int) $free, 'needed' => $needed]);

            $state['status'] = 'staged';
            $state['stage_dir'] = $stage;
            $state['backup_dir'] = $backup;
            $state['uncompressed_bytes'] = $total;
            $state['applied'] = [];
            update_option($state_key($id), $state, false);

            foreach ($targets as $rel) {
                $src = $stage . '/' . $rel;
                $dst = wp_normalize_path(ABSPATH . $rel);
                $bak = $backup . '/' . $rel;
                if (!file_exists($src)) {
                    $rollback = $rollback_state($id, $state, $remove_tree, $state_key, $lock_key);
                    return new WP_Error('dtf_target_missing', 'Staged deployment target is missing; prior swaps rolled back.', ['status' => 500, 'path' => $rel, 'rollback' => $rollback]);
                }
                if (!$ensure_dir(dirname($dst)) || !$ensure_dir(dirname($bak))) {
                    $rollback = $rollback_state($id, $state, $remove_tree, $state_key, $lock_key);
                    return new WP_Error('dtf_target_parent', 'Could not prepare deployment target directories; prior swaps rolled back.', ['status' => 500, 'path' => $rel, 'rollback' => $rollback]);
                }
                $had_backup = file_exists($dst) || is_link($dst);
                if ($had_backup && !@rename($dst, $bak)) {
                    $rollback_state($id, $state, $remove_tree, $state_key, $lock_key);
                    return new WP_Error('dtf_backup_rename', 'Could not move current target into rollback backup.', ['status' => 500, 'path' => $rel]);
                }
                if (!@rename($src, $dst)) {
                    if ($had_backup && (file_exists($bak) || is_link($bak))) @rename($bak, $dst);
                    $rollback_state($id, $state, $remove_tree, $state_key, $lock_key);
                    return new WP_Error('dtf_deploy_rename', 'Could not atomically place staged target; rollback attempted.', ['status' => 500, 'path' => $rel]);
                }
                $state['applied'][] = ['rel' => $rel, 'had_backup' => $had_backup];
                $state['status'] = 'deploying';
                update_option($state_key($id), $state, false);
            }

            $state['status'] = 'deployed';
            $state['deployed_at'] = gmdate('c');
            update_option($state_key($id), $state, false);
            flush_rewrite_rules(false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            return rest_ensure_response(['ok' => true, 'status' => 'deployed', 'targets' => $targets, 'file_count' => count($manifest_files), 'uncompressed_bytes' => $total]);
        },
    ]);

    register_rest_route('dtf-suite/v1', '/rollback', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function (WP_REST_Request $request) use ($safe_id, $state_key, $remove_tree, $lock_key, $rollback_state) {
            $id = (string) $request->get_param('deployment_id');
            if (!$safe_id($id)) return new WP_Error('dtf_invalid_id', 'Invalid deployment ID.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state) || empty($state)) return new WP_Error('dtf_missing_state', 'Deployment state is missing.', ['status' => 404]);
            if (($state['status'] ?? '') === 'rolled_back') return rest_ensure_response(['ok' => true, 'status' => 'rolled_back', 'recovered' => true]);
            return $rollback_state($id, $state, $remove_tree, $state_key, $lock_key);
        },
    ]);

    register_rest_route('dtf-suite/v1', '/finalize', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function (WP_REST_Request $request) use ($safe_id, $state_key, $lock_key, $remove_tree) {
            $id = (string) $request->get_param('deployment_id');
            if (!$safe_id($id)) return new WP_Error('dtf_invalid_id', 'Invalid deployment ID.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state) || empty($state)) return rest_ensure_response(['ok' => true, 'status' => 'already-finalized']);
            if (($state['status'] ?? '') !== 'deployed') return new WP_Error('dtf_not_deployed', 'Only a verified deployed transaction can be finalized.', ['status' => 409]);
            $work = $state['work_dir'] ?? '';
            if (is_string($work) && $work !== '' && file_exists($work) && !$remove_tree($work)) return new WP_Error('dtf_finalize_cleanup', 'Could not delete deployment workspace/backup.', ['status' => 500]);
            delete_option($state_key($id));
            $lock = get_option($lock_key, []);
            if (is_array($lock) && ($lock['id'] ?? '') === $id) delete_option($lock_key);
            return rest_ensure_response(['ok' => true, 'status' => 'finalized']);
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
    console.error('Rollback failed; leaving temporary deployment tooling active for recovery.');
    return;
  }
  if (installedByDeploy && !pluginWasInstalled) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByDeploy && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
}

async function getDeployState() {
  try {
    const result = await wpGetRetry(`/wp-json/dtf-suite/v1/state/${deploymentId}`, { headers: { 'X-DTF-Suite-Token': repairToken }, allow: [404] });
    return result.ok && result.body && typeof result.body === 'object' ? result.body : null;
  } catch { return null; }
}

async function callDeploy(path, json, { recoverStatus } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await wpRequest(`/wp-json/dtf-suite/v1/${path}`, { method: 'POST', headers: { 'X-DTF-Suite-Token': repairToken }, json });
    } catch (error) {
      lastError = error;
      if (recoverStatus) {
        const state = await getDeployState();
        if (state?.status === recoverStatus) return { ok: true, status: 200, body: { ok: true, status: recoverStatus, recovered: true } };
      }
      await sleep(1400 + attempt * 1400);
    }
  }
  throw lastError || new Error(`Deployment endpoint ${path} failed.`);
}

async function uploadArchive() {
  await callDeploy('init', { deployment_id: deploymentId, archive_bytes: archiveBytes, archive_sha256: archiveSha256 });
  const chunkSize = 384 * 1024;
  let offset = 0;
  while (offset < archiveBytes) {
    const chunk = archive.subarray(offset, Math.min(offset + chunkSize, archiveBytes));
    const chunkSha = crypto.createHash('sha256').update(chunk).digest('hex');
    let accepted = false;
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const result = await wpRequest('/wp-json/dtf-suite/v1/chunk', {
          method: 'POST',
          headers: { 'X-DTF-Suite-Token': repairToken },
          json: { deployment_id: deploymentId, offset, chunk_sha256: chunkSha, data_b64: chunk.toString('base64') },
        });
        if (Number(result.body?.uploaded_bytes) !== offset + chunk.length) throw new Error(`Server reported unexpected uploaded offset ${result.body?.uploaded_bytes}.`);
        accepted = true;
        break;
      } catch (error) {
        lastError = error;
        const state = await getDeployState();
        const serverOffset = Number(state?.uploaded_bytes ?? -1);
        if (serverOffset === offset + chunk.length) { accepted = true; break; }
        if (serverOffset !== offset) throw new Error(`Ambiguous chunk failure left unexpected server offset ${serverOffset}; refusing blind replay.`);
        await sleep(1200 + attempt * 1000);
      }
    }
    if (!accepted) throw lastError || new Error(`Chunk at offset ${offset} was not accepted.`);
    offset += chunk.length;
    if (offset % (3 * 1024 * 1024) < chunk.length) console.log(`Uploaded ${offset}/${archiveBytes} bytes.`);
  }
}

const liveChecks = [
  ['/games/', 'Original cannabis games built to play, learn, compete, and share.'],
  ['/tools/', 'Practical tools built around observation, records, and evidence.'],
  ['/projects/', 'One place to see what is playable, usable, and still being built.'],
  ['/growlens/', 'GrowLens'],
  ['/thc-grow-doc/', 'Grow Doc'],
  ['/games/high-iq/', 'High IQ'],
  ['/games/high-life/', 'High Life'],
  ['/games/seed-man-platformer/', 'Seed Man'],
  ['/games/grower-conversations/', 'Grower Conversations'],
  ['/games/high-land/', 'High Land'],
  ['/games/weedopolis/', 'Weedopolis'],
  ['/games/crossword/', 'Crossword'],
  ['/games/who-took-it/', 'Who Took It'],
];

async function verifyLive() {
  const runTag = process.env.GITHUB_RUN_ID || Date.now().toString();
  for (const [path, marker] of liveChecks) {
    let good = false;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const response = await fetch(`${siteUrl}${path}?dtf_suite=${encodeURIComponent(runTag)}-${attempt}`, {
          headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-Public-Suite-Deploy/1.0' },
          redirect: 'follow',
        });
        const text = await response.text();
        if (response.ok && text.toLowerCase().includes(marker.toLowerCase()) && text.length > 400) { good = true; break; }
      } catch {}
      await sleep(2200 + attempt * 800);
    }
    if (!good) throw new Error(`Live route ${path} did not expose expected marker: ${marker}`);
    console.log(`Verified ${path}`);
  }

  const puzzle = await fetch(`${siteUrl}/puzzles/current.json?dtf_suite=${encodeURIComponent(runTag)}`, { headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' } });
  if (!puzzle.ok) throw new Error(`/puzzles/current.json returned HTTP ${puzzle.status}.`);
  const puzzleText = await puzzle.text();
  try { JSON.parse(puzzleText); } catch { throw new Error('/puzzles/current.json is not valid JSON.'); }

  const ownershipChecks = [
    ['/', 'Genetics, cultivation education, practical tools, and original cannabis games.'],
    ['/learn/', 'Understand the plant. Build the environment. Make better decisions.'],
  ];
  for (const [path, marker] of ownershipChecks) {
    const response = await fetch(`${siteUrl}${path}?dtf_suite_ownership=${encodeURIComponent(runTag)}`, { headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' }, redirect: 'follow' });
    const text = await response.text();
    if (!response.ok || !text.toLowerCase().includes(marker.toLowerCase())) throw new Error(`WordPress route ownership regression detected at ${path}.`);
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
    if (!plugin) { plugin = await installCodeSnippetsNative(); installedByDeploy = true; }
    if (plugin?.plugin) pluginRestId = plugin.plugin;
    if (plugin?.status !== 'active') {
      const activated = await setPluginStatus(pluginRestId, 'active');
      activatedByDeploy = true;
      if (activated.body?.plugin) pluginRestId = activated.body.plugin;
    } else if (!pluginWasActive) activatedByDeploy = true;
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available for suite deployment.');
  }

  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Public Suite Deploy ${runId}`,
      desc: 'Temporary authenticated transactional bridge for app-only DTFSeeds public-suite deployment without SSH.',
      code: snippetCode,
      tags: ['dtf-deploy', 'temporary'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary suite deployment snippet was created without an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  await uploadArchive();
  const committed = await callDeploy('commit', { deployment_id: deploymentId }, { recoverStatus: 'deployed' });
  if (committed.body?.ok !== true) throw new Error(`Commit endpoint did not report success: ${JSON.stringify(committed.body).slice(0, 800)}`);
  deploymentCommitted = true;

  await flushHostingerCacheBestEffort();
  await verifyLive();

  const finalized = await callDeploy('finalize', { deployment_id: deploymentId });
  if (finalized.body?.ok !== true) throw new Error(`Finalize endpoint did not report success: ${JSON.stringify(finalized.body).slice(0, 800)}`);
  console.log(JSON.stringify({ ok: true, deploymentId, archiveBytes, archiveSha256, verifiedRoutes: liveChecks.length + 3 }));
} catch (error) {
  if (snippetId && deploymentCommitted) {
    try {
      const rolled = await callDeploy('rollback', { deployment_id: deploymentId }, { recoverStatus: 'rolled_back' });
      if (rolled.body?.ok !== true) throw new Error(`Rollback endpoint returned ${JSON.stringify(rolled.body).slice(0, 700)}`);
      await flushHostingerCacheBestEffort();
      console.error('Deployment verification failed; previous app routes were restored automatically.');
    } catch (rollbackError) {
      rollbackFailed = true;
      console.error(`AUTOMATIC ROLLBACK FAILED: ${rollbackError.message}`);
    }
  }
  throw error;
} finally {
  await cleanupTemporaryTools();
}
