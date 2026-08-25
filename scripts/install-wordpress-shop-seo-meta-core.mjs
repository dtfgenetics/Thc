import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const sourcePath = process.env.SHOP_SEO_SOURCE || 'site/wordpress/mu-plugins/dtf-shop-seo-meta.php';
if (!username || !password) throw new Error('WordPress credentials are required.');

const desired = await readFile(sourcePath, 'utf8');
const desiredSha = crypto.createHash('sha256').update(desired).digest('hex');
const desiredB64 = Buffer.from(desired, 'utf8').toString('base64');
const token = crypto.randomBytes(32).toString('hex');
const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      if (!response.ok && !allow.includes(response.status)) {
        throw new Error(`${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 900) : JSON.stringify(body).slice(0, 900)}`);
      }
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

let plugin = await queryPlugin();
const pluginWasInstalled = Boolean(plugin);
const pluginWasActive = plugin?.status === 'active';
let installedPlugin = false;
let activatedPlugin = false;
let pluginId = plugin?.plugin || 'code-snippets/code-snippets';
let snippetId = 0;
let installResult = null;
let finalized = false;
let rollbackFailed = false;

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

  const code = `
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    $desired_b64 = ${JSON.stringify(desiredB64)};
    $expected_sha = ${JSON.stringify(desiredSha)};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-shop-seo-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };
    $target = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-shop-seo-meta.php');
    $backup = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-shop-seo-meta.php.dtf-backup');
    $temp = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-shop-seo-meta.php.dtf-temp');

    register_rest_route('dtf-shop-seo/v1', '/install', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($target, $backup, $temp, $desired_b64, $expected_sha) {
            if (!is_dir(WPMU_PLUGIN_DIR) && !wp_mkdir_p(WPMU_PLUGIN_DIR)) return new WP_Error('dtf_mu_dir', 'Could not create MU plugin directory.', ['status' => 500]);
            if (!is_writable(WPMU_PLUGIN_DIR)) return new WP_Error('dtf_mu_write', 'MU plugin directory is not writable.', ['status' => 500]);
            $desired = base64_decode($desired_b64, true);
            if ($desired === false || hash('sha256', $desired) !== $expected_sha) return new WP_Error('dtf_source', 'Embedded Shop SEO source failed SHA verification.', ['status' => 500]);
            if (is_file($target) && hash_file('sha256', $target) === $expected_sha) {
                return rest_ensure_response(['ok' => true, 'changed' => false, 'sha256' => $expected_sha, 'had_existing' => true]);
            }
            if (is_file($backup) || is_file($temp)) return new WP_Error('dtf_collision', 'A previous Shop SEO backup/temp file exists; refusing to overwrite.', ['status' => 409]);
            $had_existing = is_file($target);
            if ($had_existing && !rename($target, $backup)) return new WP_Error('dtf_backup', 'Could not back up existing Shop SEO MU plugin.', ['status' => 500]);
            $written = file_put_contents($temp, $desired, LOCK_EX);
            if ($written === false || hash_file('sha256', $temp) !== $expected_sha) {
                @unlink($temp);
                if ($had_existing && is_file($backup)) @rename($backup, $target);
                return new WP_Error('dtf_write_verify', 'Shop SEO temporary write failed verification; original restored.', ['status' => 500]);
            }
            @chmod($temp, 0644);
            if (!rename($temp, $target) || hash_file('sha256', $target) !== $expected_sha) {
                @unlink($target); @unlink($temp);
                if ($had_existing && is_file($backup)) @rename($backup, $target);
                return new WP_Error('dtf_commit', 'Shop SEO MU plugin commit failed; original restored.', ['status' => 500]);
            }
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'changed' => true, 'sha256' => $expected_sha, 'had_existing' => $had_existing]);
        },
    ]);

    register_rest_route('dtf-shop-seo/v1', '/rollback', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($target, $backup, $expected_sha) {
            if (is_file($target) && hash_file('sha256', $target) === $expected_sha) @unlink($target);
            if (is_file($backup) && !rename($backup, $target)) return new WP_Error('dtf_restore', 'Could not restore Shop SEO backup.', ['status' => 500]);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            do_action('litespeed_purge_all');
            return rest_ensure_response(['ok' => true, 'rolled_back' => true]);
        },
    ]);

    register_rest_route('dtf-shop-seo/v1', '/finalize', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($target, $backup, $expected_sha) {
            if (!is_file($target) || hash_file('sha256', $target) !== $expected_sha) return new WP_Error('dtf_final_hash', 'Live Shop SEO MU plugin does not match reviewed source.', ['status' => 409]);
            if (is_file($backup) && !unlink($backup)) return new WP_Error('dtf_final_backup', 'Could not remove Shop SEO rollback backup.', ['status' => 500]);
            return rest_ensure_response(['ok' => true, 'finalized' => true, 'sha256' => $expected_sha]);
        },
    ]);
});
`.trim();

  const created = await request('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Shop SEO Installer ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary transactional bridge for the source-controlled DTF Shop SEO MU plugin.',
      code,
      tags: ['dtf', 'shop-seo', 'temporary'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary Shop SEO bridge snippet did not return an ID.');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });
}

function extractDescription(html) {
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const name = tag.match(/\bname=["']([^"']*)["']/i)?.[1]?.toLowerCase();
    if (name !== 'description') continue;
    return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
  }
  return '';
}

function extractTitle(html) {
  return String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
}

async function verifyPublicShop() {
  const expectedDescription = 'Shop current DTF Genetics seed releases with reviewed strain-card artwork, documented lineage and generation context, and links to each breeding project.';
  let last = '';
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await fetch(`${siteUrl}/shop/?dtf_shop_seo=${Date.now()}-${attempt}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000),
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTF-Shop-SEO-Verifier/1.0' },
    });
    last = await response.text();
    const description = extractDescription(last);
    const title = extractTitle(last);
    if (response.ok && description === expectedDescription && title.includes('DTF Genetics Seeds & Current Releases')) {
      return { ok: true, status: response.status, title, description };
    }
    await sleep(attempt * 1800);
  }
  return { ok: false, status: 0, title: extractTitle(last), description: extractDescription(last) };
}

try {
  await ensureBridge();
  installResult = (await request('/wp-json/dtf-shop-seo/v1/install', {
    method: 'POST',
    headers: { 'X-DTF-Shop-SEO-Token': token },
  })).body;
  if (!installResult?.ok || installResult?.sha256 !== desiredSha) throw new Error('Shop SEO install endpoint did not confirm the reviewed source hash.');

  const verification = await verifyPublicShop();
  if (!verification.ok) {
    try {
      await request('/wp-json/dtf-shop-seo/v1/rollback', { method: 'POST', headers: { 'X-DTF-Shop-SEO-Token': token } }, 3);
    } catch {
      rollbackFailed = true;
    }
    throw new Error(`Shop SEO public verification failed. title=${verification.title || '(missing)'} description=${verification.description || '(missing)'}`);
  }

  const finalResult = (await request('/wp-json/dtf-shop-seo/v1/finalize', {
    method: 'POST', headers: { 'X-DTF-Shop-SEO-Token': token },
  })).body;
  if (!finalResult?.finalized || finalResult?.sha256 !== desiredSha) throw new Error('Shop SEO finalization failed.');
  finalized = true;

  console.log(JSON.stringify({
    ok: true,
    siteUrl,
    sourcePath,
    sha256: desiredSha,
    changed: Boolean(installResult.changed),
    hadExisting: Boolean(installResult.had_existing),
    verified: verification,
    finalized,
  }));
} finally {
  await cleanupBridge();
}
