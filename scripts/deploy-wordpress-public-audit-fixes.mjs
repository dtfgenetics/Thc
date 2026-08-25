import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const sourceSpecs = [
  ['games/protect-the-plants/index.html', 'site/public-route-patch/games/protect-the-plants/index.html'],
  ['projects/index.html', 'site/public-route-patch/projects/index.html'],
];
const payloads = [];
for (const [rel, sourcePath] of sourceSpecs) {
  const content = await readFile(sourcePath, 'utf8');
  payloads.push({
    rel,
    sourcePath,
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
    contentB64: Buffer.from(content, 'utf8').toString('base64'),
  });
}

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token = crypto.randomBytes(32).toString('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let plugin = null;
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedPlugin = false;
let activatedPlugin = false;
let pluginId = 'code-snippets/code-snippets';
let snippetId = 0;
let rollbackFailed = false;

async function request(path, { method = 'GET', json, headers = {}, allow = [] } = {}, attempts = 6) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
        headers: {
          Authorization: auth,
          Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok && !allow.includes(response.status)) throw new Error(`${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 900) : JSON.stringify(body).slice(0, 900)}`);
      return { ok: response.ok, status: response.status, body, text };
    } catch (error) {
      last = error;
      if (attempt < attempts) await sleep(attempt * 1400);
    }
  }
  throw last;
}

function pluginEndpoint(id) {
  return `/wp-json/wp/v2/plugins/${String(id).split('/').map(encodeURIComponent).join('/')}`;
}
async function queryPlugin() {
  const result = await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [401, 403, 404] });
  if (!result.ok || !Array.isArray(result.body)) return null;
  return result.body.find((row) => String(row?.plugin || '').startsWith('code-snippets/')) || null;
}
async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const result = await request('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] }, 2).catch(() => null);
    if (result?.ok) return true;
    await sleep(attempt * 800);
  }
  return false;
}
async function cleanupBridge() {
  if (snippetId) {
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }, 2); } catch {}
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }, 2); } catch {}
  }
  if (rollbackFailed) return;
  if (installedPlugin && !pluginWasInstalled) {
    try { await request(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400, 404] }, 2); } catch {}
    try { await request(pluginEndpoint(pluginId), { method: 'DELETE', allow: [400, 404] }, 2); } catch {}
  } else if (activatedPlugin && !pluginWasActive) {
    try { await request(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'inactive' }, allow: [400, 404] }, 2); } catch {}
  }
}

async function ensureBridge() {
  plugin = await queryPlugin();
  pluginWasInstalled = Boolean(plugin);
  pluginWasActive = plugin?.status === 'active';
  if (!(await waitForSnippetApi())) {
    if (!plugin) {
      const created = await request('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
      plugin = created.body;
      installedPlugin = true;
    }
    pluginId = plugin?.plugin || pluginId;
    if (plugin?.status !== 'active') {
      const activated = await request(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'active' } });
      plugin = activated.body;
      activatedPlugin = true;
    }
    if (!(await waitForSnippetApi())) throw new Error('Code Snippets API did not become available.');
  }

  const payloadJson = JSON.stringify(payloads.map(({ rel, sha256, contentB64 }) => ({ rel, sha256, contentB64 })));
  const code = `
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    $payloads = json_decode(${JSON.stringify(payloadJson)}, true);
    $state_key = 'dtf_public_audit_fix_state_v1';
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-audit-fix-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };
    $allowed = ['games/protect-the-plants/index.html', 'projects/index.html'];
    $rollback = static function ($state) use ($state_key) {
        $records = is_array($state['records'] ?? null) ? $state['records'] : [];
        for ($i = count($records) - 1; $i >= 0; $i--) {
            $record = $records[$i];
            if (empty($record['changed'])) continue;
            $target = wp_normalize_path(ABSPATH . $record['rel']);
            $backup = $target . '.dtf-audit-backup';
            if (is_file($target)) @unlink($target);
            if (!empty($record['had_existing']) && is_file($backup)) {
                if (!@rename($backup, $target)) return false;
            } else {
                @unlink($backup);
            }
        }
        delete_option($state_key);
        if (function_exists('wp_cache_flush')) wp_cache_flush();
        do_action('litespeed_purge_all');
        return true;
    };

    register_rest_route('dtf-public-audit/v1', '/apply', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($payloads, $allowed, $state_key, $rollback) {
            $state = ['records' => [], 'started_at' => gmdate('c')];
            foreach ($payloads as $payload) {
                $rel = (string) ($payload['rel'] ?? '');
                if (!in_array($rel, $allowed, true)) { $rollback($state); return new WP_Error('dtf_scope', 'Unexpected deployment target.', ['status' => 409]); }
                $expected = (string) ($payload['sha256'] ?? '');
                $desired = base64_decode((string) ($payload['contentB64'] ?? ''), true);
                if (!preg_match('/^[a-f0-9]{64}$/', $expected) || $desired === false || hash('sha256', $desired) !== $expected) { $rollback($state); return new WP_Error('dtf_source', 'Source payload failed SHA verification.', ['status' => 500]); }
                $target = wp_normalize_path(ABSPATH . $rel);
                $backup = $target . '.dtf-audit-backup';
                $temp = $target . '.dtf-audit-temp';
                if (!is_dir(dirname($target)) && !wp_mkdir_p(dirname($target))) { $rollback($state); return new WP_Error('dtf_dir', 'Could not create target directory.', ['status' => 500]); }
                if (is_file($target) && hash_file('sha256', $target) === $expected) {
                    $state['records'][] = ['rel' => $rel, 'sha256' => $expected, 'changed' => false, 'had_existing' => true];
                    update_option($state_key, $state, false);
                    continue;
                }
                if (is_file($backup) || is_file($temp)) { $rollback($state); return new WP_Error('dtf_collision', 'Existing audit-fix backup/temp file blocks safe deployment.', ['status' => 409, 'path' => $rel]); }
                $had_existing = is_file($target);
                if ($had_existing && !@rename($target, $backup)) { $rollback($state); return new WP_Error('dtf_backup', 'Could not back up live target.', ['status' => 500, 'path' => $rel]); }
                $record = ['rel' => $rel, 'sha256' => $expected, 'changed' => true, 'had_existing' => $had_existing];
                $state['records'][] = $record;
                update_option($state_key, $state, false);
                $written = @file_put_contents($temp, $desired, LOCK_EX);
                if ($written === false || !is_file($temp) || hash_file('sha256', $temp) !== $expected || !@rename($temp, $target) || hash_file('sha256', $target) !== $expected) {
                    @unlink($temp);
                    $rollback($state);
                    return new WP_Error('dtf_commit', 'Audit-fix target failed atomic write verification and was rolled back.', ['status' => 500, 'path' => $rel]);
                }
                @chmod($target, 0644);
            }
            update_option($state_key, $state, false);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'records' => $state['records']]);
        },
    ]);

    register_rest_route('dtf-public-audit/v1', '/rollback', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($state_key, $rollback) {
            $state = get_option($state_key, []);
            if (!is_array($state) || !$state) return rest_ensure_response(['ok' => true, 'rolled_back' => false, 'reason' => 'no-state']);
            if (!$rollback($state)) return new WP_Error('dtf_rollback', 'Could not fully restore audit-fix backups.', ['status' => 500]);
            return rest_ensure_response(['ok' => true, 'rolled_back' => true]);
        },
    ]);

    register_rest_route('dtf-public-audit/v1', '/finalize', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($state_key) {
            $state = get_option($state_key, []);
            if (!is_array($state) || !is_array($state['records'] ?? null)) return new WP_Error('dtf_state', 'Audit-fix state is missing.', ['status' => 409]);
            foreach ($state['records'] as $record) {
                $target = wp_normalize_path(ABSPATH . $record['rel']);
                if (!is_file($target) || hash_file('sha256', $target) !== $record['sha256']) return new WP_Error('dtf_final_hash', 'Live target no longer matches reviewed source.', ['status' => 409, 'path' => $record['rel']]);
                $backup = $target . '.dtf-audit-backup';
                if (is_file($backup) && !@unlink($backup)) return new WP_Error('dtf_final_backup', 'Could not remove rollback backup.', ['status' => 500, 'path' => $record['rel']]);
            }
            delete_option($state_key);
            return rest_ensure_response(['ok' => true, 'finalized' => true]);
        },
    ]);
});
`.trim();

  const created = await request('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: { name: `DTF Public Audit Fix ${process.env.GITHUB_RUN_ID || Date.now()}`, desc: 'Temporary transactional bridge for two source-controlled public-route fixes.', code, tags: ['dtf', 'audit-fix', 'temporary'], scope: 'global', priority: 1, active: false, network: false },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary public-audit bridge did not return an ID.');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });
}

function stripHtml(html) {
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function title(html) { return String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || ''; }
function canonical(html) {
  for (const tag of String(html).match(/<link\b[^>]*>/gi) || []) {
    if (/\brel=["'][^"']*canonical[^"']*["']/i.test(tag)) return tag.match(/\bhref=["']([^"']+)["']/i)?.[1] || '';
  }
  return '';
}
async function fetchPublic(path) {
  let last = '';
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await fetch(`${siteUrl}${path}${path.includes('?') ? '&' : '?'}dtf_audit_fix=${Date.now()}-${attempt}`, { redirect: 'follow', signal: AbortSignal.timeout(60_000), headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTF-Public-Audit-Fix-Verifier/1.0' } });
    last = await response.text();
    if (response.ok) return { status: response.status, html: last };
    await sleep(attempt * 1500);
  }
  return { status: 0, html: last };
}
async function verify() {
  const protect = await fetchPublic('/games/protect-the-plants/');
  const protectText = stripHtml(protect.html);
  if (protect.status !== 200 || !title(protect.html).includes('Protect the Plants') || canonical(protect.html) !== `${siteUrl}/games/protect-the-plants/` || !/<h1\b/i.test(protect.html) || protectText.length < 150 || !protectText.includes('15×15')) {
    throw new Error(`Protect the Plants verification failed: status=${protect.status}, title=${title(protect.html)}, canonical=${canonical(protect.html)}, text=${protectText.length}`);
  }
  const projects = await fetchPublic('/projects/');
  const projectsText = stripHtml(projects.html);
  if (projects.status !== 200 || !title(projects.html).includes('Projects') || canonical(projects.html) !== `${siteUrl}/projects/` || !projectsText.includes('High IQ') || !projectsText.includes('High Life')) {
    throw new Error(`Projects verification failed: status=${projects.status}, title=${title(projects.html)}, canonical=${canonical(projects.html)}`);
  }
  return { protect: { status: protect.status, title: title(protect.html), textCharacters: protectText.length }, projects: { status: projects.status, title: title(projects.html), textCharacters: projectsText.length } };
}

try {
  await ensureBridge();
  const applied = (await request('/wp-json/dtf-public-audit/v1/apply', { method: 'POST', headers: { 'X-DTF-Audit-Fix-Token': token } })).body;
  if (!applied?.ok || !Array.isArray(applied.records) || applied.records.length !== payloads.length) throw new Error('Public audit-fix apply endpoint did not confirm both protected targets.');
  let verified;
  try {
    verified = await verify();
  } catch (error) {
    try { await request('/wp-json/dtf-public-audit/v1/rollback', { method: 'POST', headers: { 'X-DTF-Audit-Fix-Token': token } }, 3); } catch { rollbackFailed = true; }
    throw error;
  }
  const finalized = (await request('/wp-json/dtf-public-audit/v1/finalize', { method: 'POST', headers: { 'X-DTF-Audit-Fix-Token': token } })).body;
  if (!finalized?.finalized) throw new Error('Public audit-fix finalization failed.');
  console.log(JSON.stringify({ ok: true, siteUrl, payloads: payloads.map(({ rel, sourcePath, sha256 }) => ({ rel, sourcePath, sha256 })), records: applied.records, verified }));
} finally {
  await cleanupBridge();
}
