import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-route-ownership-backups';
const apply = String(process.env.APPLY_ROUTE_OWNERSHIP_CHANGES || '').toLowerCase() === 'true';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
if (!apply) throw new Error('Refusing production route mutation without APPLY_ROUTE_OWNERSHIP_CHANGES=true.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token = crypto.randomBytes(32).toString('hex');
const namespace = `dtf-editorial-route-owner/v1-${crypto.randomBytes(8).toString('hex')}`;
const tokenLiteral = JSON.stringify(token);
const namespaceLiteral = JSON.stringify(namespace);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `editorial-route-ownership-${stamp}`);
await mkdir(backupDir, { recursive: true });
await writeFile(join(backupRoot, 'editorial-route-ownership-backup-path.txt'), `${backupDir}\n`);

const managedBlock = `# BEGIN DTF WordPress Editorial Route Ownership v1
<IfModule mod_rewrite.c>
RewriteEngine On
# Exact editorial landing routes must reach their authoritative WordPress publishers
# before Apache DirectoryIndex can serve stale physical index.html files.
RewriteRule ^$ index.php [L]
RewriteRule ^(?:home|seeds|learn|community|shop|gallery|about|contact|blog)/?$ index.php [L]
</IfModule>
# END DTF WordPress Editorial Route Ownership v1`;
const managedBlockBase64 = Buffer.from(managedBlock, 'utf8').toString('base64');

let snippetId = null;
let applied = false;
let rollbackFailed = false;
let applyResult = null;
let publicVerification = [];

async function request(path, { method = 'GET', json, headers = {}, allow = [] } = {}) {
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
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 900) : JSON.stringify(body).slice(0, 900)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function getWithRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try { return await request(path, { ...options, method: 'GET' }); }
    catch (error) {
      lastError = error;
      await sleep(800 + attempt * 650);
    }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

async function requireCanonicalPage(slug) {
  const result = await getWithRetry(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&status=publish&context=edit&per_page=10`);
  if (!Array.isArray(result.body) || result.body.length !== 1) {
    throw new Error(`Expected exactly one published WordPress page for /${slug}/, found ${Array.isArray(result.body) ? result.body.length : 'non-array response'}.`);
  }
  const page = result.body[0];
  const content = String(page?.content?.raw || page?.content?.rendered || '');
  if (!Number(page?.id) || content.length < 80) {
    throw new Error(`Published WordPress page /${slug}/ is missing a usable canonical body.`);
  }
  return { id: Number(page.id), slug, contentLength: content.length };
}

async function validateWordPressOwners() {
  const slugs = ['home', 'seeds', 'learn', 'community', 'shop', 'gallery', 'about', 'contact', 'blog'];
  const pages = [];
  for (const slug of slugs) pages.push(await requireCanonicalPage(slug));

  const settings = (await getWithRetry('/wp-json/wp/v2/settings?context=edit')).body;
  const home = pages.find((page) => page.slug === 'home');
  if (String(settings?.show_on_front || '') !== 'page' || Number(settings?.page_on_front || 0) !== home.id) {
    throw new Error(`WordPress front-page ownership is not canonical: show_on_front=${settings?.show_on_front || ''}, page_on_front=${settings?.page_on_front || 0}, expected=${home.id}.`);
  }

  await writeFile(join(backupDir, 'wordpress-owner-preconditions.json'), `${JSON.stringify({ pages, settings: {
    show_on_front: settings?.show_on_front,
    page_on_front: settings?.page_on_front,
    page_for_posts: settings?.page_for_posts,
  } }, null, 2)}\n`);
  return pages;
}

async function ensureSnippetApi() {
  const schema = await getWithRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [401, 403, 404, 500] });
  if (!schema.ok) {
    throw new Error(`Code Snippets REST API is unavailable (${schema.status}); refusing route mutation because the reviewed WordPress bridge cannot be created safely.`);
  }
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $namespace = ${namespaceLiteral};
    $managed_block = base64_decode(${JSON.stringify(managedBlockBase64)}, true);
    if (!is_string($managed_block) || $managed_block === '') return;

    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-editorial-route-token');
        if ($supplied === '') $supplied = (string) $request->get_param('_dtf_editorial_route_token');
        return $supplied !== '' && hash_equals($token, $supplied);
    };

    $root = trailingslashit(wp_normalize_path(ABSPATH));
    $path = wp_normalize_path(ABSPATH . '.htaccess');
    if (strpos($path, $root) !== 0) return;

    $backup_key = 'dtf_editorial_route_ownership_backup_v1';
    $state_key = 'dtf_editorial_route_ownership_state_v1';
    $begin = '# BEGIN DTF WordPress Editorial Route Ownership v1';
    $end = '# END DTF WordPress Editorial Route Ownership v1';

    $purge = static function () {
        if (function_exists('do_action')) do_action('litespeed_purge_all');
        if (function_exists('wp_cache_flush')) wp_cache_flush();
        if (!headers_sent()) {
            header('X-LiteSpeed-Purge: *');
            header('X-LiteSpeed-Cache-Control: no-cache');
        }
        clearstatcache();
    };

    $restore = static function () use ($backup_key, $state_key, $path, $purge) {
        $backup = get_option($backup_key);
        if (!is_array($backup) || !array_key_exists('content_b64', $backup)) {
            return new WP_Error('dtf_editorial_route_no_backup', 'No verified editorial route backup is available.', ['status' => 409]);
        }
        $raw = base64_decode((string) $backup['content_b64'], true);
        if ($raw === false) return new WP_Error('dtf_editorial_route_bad_backup', 'Stored editorial route backup is invalid.', ['status' => 500]);
        $tmp = $path . '.dtf-editorial-restore-' . wp_generate_uuid4();
        if (file_put_contents($tmp, $raw, LOCK_EX) !== strlen($raw) || !hash_equals(hash('sha256', $raw), (string) @hash_file('sha256', $tmp))) {
            @unlink($tmp);
            return new WP_Error('dtf_editorial_route_restore_stage', 'Could not stage exact editorial route rollback.', ['status' => 500]);
        }
        @chmod($tmp, (int) ($backup['mode'] ?? 0644));
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
            return new WP_Error('dtf_editorial_route_restore_commit', 'Could not commit editorial route rollback.', ['status' => 500]);
        }
        update_option($state_key, ['status' => 'rolled-back', 'sha256' => hash('sha256', $raw), 'updated_at' => gmdate('c')], false);
        $purge();
        return rest_ensure_response(['ok' => true, 'restored' => true, 'sha256' => hash('sha256', $raw)]);
    };

    register_rest_route($namespace, '/inspect', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($path, $begin, $end, $managed_block) {
            if (!is_file($path) || !is_readable($path)) return new WP_Error('dtf_editorial_route_missing', 'Root .htaccess is not readable.', ['status' => 500]);
            $content = file_get_contents($path);
            if ($content === false) return new WP_Error('dtf_editorial_route_read', 'Root .htaccess could not be read.', ['status' => 500]);
            return rest_ensure_response([
                'ok' => true,
                'sha256' => hash('sha256', $content),
                'mode' => fileperms($path) & 0777,
                'content_b64' => base64_encode($content),
                'begin_count' => substr_count($content, $begin),
                'end_count' => substr_count($content, $end),
                'canonical_count' => substr_count($content, $managed_block),
            ]);
        },
    ]);

    register_rest_route($namespace, '/apply', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($path, $begin, $end, $managed_block, $backup_key, $state_key, $purge, $restore) {
            if (!is_file($path) || !is_readable($path) || !is_writable($path)) {
                return new WP_Error('dtf_editorial_route_unavailable', 'Root .htaccess is not safely readable and writable.', ['status' => 500]);
            }
            $content = file_get_contents($path);
            if ($content === false) return new WP_Error('dtf_editorial_route_read', 'Root .htaccess could not be read.', ['status' => 500]);

            $begin_count = substr_count($content, $begin);
            $end_count = substr_count($content, $end);
            $canonical_count = substr_count($content, $managed_block);
            if ($begin_count === 1 && $end_count === 1 && $canonical_count === 1) {
                $purge();
                update_option($state_key, ['status' => 'already-canonical', 'sha256' => hash('sha256', $content), 'updated_at' => gmdate('c')], false);
                return rest_ensure_response(['ok' => true, 'changed' => false, 'sha256' => hash('sha256', $content)]);
            }
            if (($begin_count === 0) !== ($end_count === 0) || $begin_count > 1 || $end_count > 1) {
                return new WP_Error('dtf_editorial_route_marker_mismatch', 'Managed editorial route markers are malformed or duplicated; refusing automatic rewrite.', ['status' => 409, 'begin_count' => $begin_count, 'end_count' => $end_count]);
            }

            $backup = [
                'content_b64' => base64_encode($content),
                'sha256' => hash('sha256', $content),
                'mode' => fileperms($path) & 0777,
                'saved_at' => gmdate('c'),
            ];
            update_option($backup_key, $backup, false);
            $stored = get_option($backup_key);
            if (!is_array($stored) || !hash_equals($backup['sha256'], (string) ($stored['sha256'] ?? ''))) {
                return new WP_Error('dtf_editorial_route_backup', 'Editorial route backup verification failed.', ['status' => 500]);
            }

            if ($begin_count === 0 && $end_count === 0) {
                $next = $managed_block . "\n\n" . ltrim($content);
            } else {
                $pattern = '/' . preg_quote($begin, '/') . '.*?' . preg_quote($end, '/') . '/s';
                $next = preg_replace($pattern, $managed_block, $content, 1, $replace_count);
                if (!is_string($next) || $replace_count !== 1) {
                    return new WP_Error('dtf_editorial_route_replace', 'Existing managed editorial route block could not be replaced exactly.', ['status' => 500]);
                }
            }
            if (substr_count($next, $managed_block) !== 1) {
                return new WP_Error('dtf_editorial_route_canonical_count', 'Prepared .htaccess does not contain exactly one canonical editorial route block.', ['status' => 500]);
            }

            $tmp = $path . '.dtf-editorial-stage-' . wp_generate_uuid4();
            if (file_put_contents($tmp, $next, LOCK_EX) !== strlen($next) || !hash_equals(hash('sha256', $next), (string) @hash_file('sha256', $tmp))) {
                @unlink($tmp);
                return new WP_Error('dtf_editorial_route_stage', 'Could not stage exact editorial route rewrite.', ['status' => 500]);
            }
            @chmod($tmp, (int) $backup['mode']);
            if (!@rename($tmp, $path)) {
                @unlink($tmp);
                return new WP_Error('dtf_editorial_route_commit', 'Could not commit editorial route rewrite.', ['status' => 500]);
            }
            clearstatcache(true, $path);
            $written = file_get_contents($path);
            if (!is_string($written) || !hash_equals(hash('sha256', $next), hash('sha256', $written))) {
                $restore();
                return new WP_Error('dtf_editorial_route_verify', 'Editorial route rewrite did not verify byte-for-byte; rollback attempted.', ['status' => 500]);
            }

            $purge();
            update_option($state_key, [
                'status' => 'applied',
                'before_sha256' => $backup['sha256'],
                'after_sha256' => hash('sha256', $written),
                'updated_at' => gmdate('c'),
            ], false);
            return rest_ensure_response([
                'ok' => true,
                'changed' => true,
                'before_sha256' => $backup['sha256'],
                'after_sha256' => hash('sha256', $written),
            ]);
        },
    ]);

    register_rest_route($namespace, '/rollback', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($restore) { return $restore(); },
    ]);

    register_rest_route($namespace, '/finalize', [
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

async function bridge(endpoint) {
  return request(`/wp-json/${namespace}/${endpoint}`, {
    method: 'POST',
    headers: { 'X-DTF-Editorial-Route-Token': token },
    json: { _dtf_editorial_route_token: token },
  });
}

async function probe(path) {
  const url = new URL(path, siteUrl);
  url.searchParams.set('dtf_editorial_owner', `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`);
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'DTFSeeds-Editorial-Route-Ownership/1.0',
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
    },
    signal: AbortSignal.timeout(45_000),
  });
  return { response, text: await response.text() };
}

const rootChecks = [
  ['/', ['Genetics first. Cultivation science behind it.', 'Genetics, cultivation education, practical tools, and original cannabis games.']],
  ['/learn/', ['Learn the plant as a connected system.']],
  ['/community/', ['Join the official DTF / Teaching Healthy Cultivation Discord']],
  ['/shop/', ['dtf-commerce-archive-style', 'Shop current DTF releases without losing the breeding context.']],
  ['/gallery/', ['DTF Visual Library']],
  ['/about/', ['Genetics, education, tools, games, and community']],
  ['/contact/', ['Reach DTF through verified channels.']],
  ['/blog/', ['DTF Field Notes', 'Follow what we are learning, building, and releasing.']],
  ['/seeds/', ['documented breeding library', 'From breeding notes to current releases.']],
];

const preserveChecks = [
  ['/learn/infographics/', ['Infographic']],
  ['/learn/plant-health/', ['Teaching Healthy Cultivation']],
  ['/community/grow-offs/solo-cup-grow-off/', ['Solo Cup']],
  ['/games/', ['25 playable browser games']],
  ['/growlens/', ['GrowLens']],
  ['/thc-grow-doc/', ['Grow Doc']],
];

async function verifyCheck([path, markers], { rejectStaticShell = false } = {}) {
  let last = '';
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const { response, text } = await probe(path);
      const location = response.headers.get('location') || '';
      const hasMarker = markers.some((marker) => text.toLowerCase().includes(marker.toLowerCase()));
      const stale = /email@email\.com|\+123456789|(?:©|&copy;)\s*2025\s+DTF\s+GENETICS/i.test(text);
      const staticShell = /\/assets\/dtf-home\/dtf-home\.css/i.test(text);
      const ok = response.status === 200 && !location && hasMarker && !stale && (!rejectStaticShell || !staticShell);
      last = `HTTP ${response.status}; redirect=${location || 'none'}; marker=${hasMarker}; stale=${stale}; staticShell=${staticShell}`;
      if (ok) {
        return { path, status: response.status, marker: markers.find((marker) => text.toLowerCase().includes(marker.toLowerCase())) || '', staticShell };
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(1200 + attempt * 850);
  }
  throw new Error(`Live route ownership verification failed for ${path}: ${last}`);
}

async function verifyPublicRoutes() {
  const verified = [];
  for (const check of rootChecks) verified.push(await verifyCheck(check, { rejectStaticShell: true }));
  for (const check of preserveChecks) verified.push(await verifyCheck(check));

  const blog = await probe('/blog/');
  if (/Cannabis Culture Insights/i.test(blog.text)) throw new Error('Legacy Cannabis Culture Insights Blog shell remains live after route ownership repair.');
  return verified;
}

async function cleanupSnippet() {
  if (!snippetId || rollbackFailed) return;
  for (const suffix of ['', '?snippets-safe-mode=1']) {
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate${suffix}`, { method: 'POST', allow: [400, 404, 500] }); } catch {}
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
  }
}

try {
  const owners = await validateWordPressOwners();
  await ensureSnippetApi();

  const created = await request('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Editorial Route Ownership ${process.env.GITHUB_RUN_ID || stamp}`,
      desc: 'Temporary token-protected bridge that makes exact WordPress editorial landing routes win over stale physical index.html files.',
      code: snippetCode,
      tags: ['dtf-release', 'temporary', 'route-ownership'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary editorial route ownership snippet was created without an ID.');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const before = await bridge('inspect');
  if (before.body?.ok !== true || typeof before.body?.content_b64 !== 'string') {
    throw new Error(`Could not inspect root .htaccess before mutation: ${JSON.stringify(before.body).slice(0, 800)}`);
  }
  await writeFile(join(backupDir, 'htaccess-before.json'), `${JSON.stringify(before.body, null, 2)}\n`);

  const appliedResponse = await bridge('apply');
  applyResult = appliedResponse.body;
  if (applyResult?.ok !== true) throw new Error(`Editorial route ownership apply did not report success: ${JSON.stringify(applyResult).slice(0, 900)}`);
  applied = Boolean(applyResult.changed);

  const after = await bridge('inspect');
  if (after.body?.ok !== true || Number(after.body?.canonical_count || 0) !== 1) {
    throw new Error(`Root .htaccess did not expose exactly one canonical editorial route block after apply: ${JSON.stringify(after.body).slice(0, 900)}`);
  }
  await writeFile(join(backupDir, 'htaccess-after.json'), `${JSON.stringify({
    sha256: after.body.sha256,
    mode: after.body.mode,
    begin_count: after.body.begin_count,
    end_count: after.body.end_count,
    canonical_count: after.body.canonical_count,
  }, null, 2)}\n`);

  publicVerification = await verifyPublicRoutes();

  const finalized = await bridge('finalize');
  if (finalized.body?.ok !== true) throw new Error(`Editorial route ownership finalization failed: ${JSON.stringify(finalized.body).slice(0, 700)}`);
  applied = false;

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    siteUrl,
    namespace,
    owners,
    applyResult,
    publicVerification,
    rollbackArtifact: join(backupDir, 'htaccess-before.json'),
  };
  await writeFile(join(backupDir, 'editorial-route-ownership-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (snippetId && applied) {
    try {
      const rollback = await bridge('rollback');
      if (rollback.body?.ok !== true) throw new Error(`rollback returned ${JSON.stringify(rollback.body).slice(0, 700)}`);
      console.error('Editorial route ownership verification failed; root .htaccess was restored from the verified backup.');
      applied = false;
    } catch (rollbackError) {
      rollbackFailed = true;
      console.error(`Automatic editorial route rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
  }
  const failure = {
    ok: false,
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    applyResult,
    publicVerification,
    rollbackFailed,
  };
  await writeFile(join(backupDir, 'editorial-route-ownership-failure.json'), `${JSON.stringify(failure, null, 2)}\n`);
  throw error;
} finally {
  await cleanupSnippet();
}
