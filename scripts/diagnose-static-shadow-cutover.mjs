import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');
const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, { method = 'GET', json, headers = {}, allow = [] } = {}) {
  let lastError;
  const attempts = method === 'GET' ? 6 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`${site}${path}`, {
        method,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
        redirect: 'follow',
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok && !allow.includes(response.status)) {
        throw new Error(`${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      }
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(1200 + attempt * 900);
    }
  }
  throw lastError;
}

function pluginPath(id) {
  return `/wp-json/wp/v2/plugins/${String(id).split('/').map(encodeURIComponent).join('/')}`;
}

async function queryCodeSnippets() {
  const r = await request('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100');
  return Array.isArray(r.body) ? r.body.find(p => String(p?.plugin || '').startsWith('code-snippets/')) || null : null;
}

async function ensureSnippetPlugin() {
  let plugin = await queryCodeSnippets();
  const original = { installed: Boolean(plugin), active: plugin?.status === 'active' };
  let installed = false;
  let activated = false;
  if (!plugin) {
    const r = await request('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
    plugin = r.body;
    installed = true;
    activated = true;
  } else if (plugin.status !== 'active') {
    const r = await request(pluginPath(plugin.plugin), { method: 'POST', json: { status: 'active' } });
    plugin = r.body;
    activated = true;
  }
  const id = plugin?.plugin || 'code-snippets/code-snippets';
  for (let attempt = 1; attempt <= 10; attempt++) {
    const ready = await request('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
    if (ready.ok) return { id, original, installed, activated };
    await sleep(900 + attempt * 500);
  }
  throw new Error('Code Snippets REST API did not become ready.');
}

async function purgeCacheBestEffort() {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, ['scripts/flush-hostinger-litespeed-mcp.mjs'], {
      env: process.env,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    return true;
  } catch (error) {
    console.error(`Cache purge diagnostic warning: ${error.message}`);
    return false;
  }
}

function stripPublicText(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8217;|&rsquo;/gi, '’')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(path, response, html) {
  const lower = html.toLowerCase();
  const marker = value => lower.includes(value.toLowerCase());
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  const bodyClass = (html.match(/<body[^>]*class=["']([^"']*)["']/i) || [])[1] || null;
  return {
    path,
    httpStatus: response.status,
    finalUrl: response.url.replace(site, ''),
    length: html.length,
    title,
    bodyClass,
    mediaRefs: (html.match(/\/wp-content\/uploads\//g) || []).length,
    themeRefs: (html.match(/\/wp-content\/themes\/hostinger-ai-theme\//g) || []).length,
    markers: {
      currentHomeExact: marker('Genetics. Plant science. Tools. Games. Community.'),
      currentHomeAlternate: marker('Genetics, cultivation education, practical tools, and original cannabis games.'),
      oldHome: marker('THC Grow Doc, genetics, cultivation education, and games in one home.'),
      currentLearn: marker('Explore by subject'),
      oldLearn: marker('Grow education belongs in a clean, readable library.'),
      canonicalNav: ['Seeds','Learn','Tools','Games','Community','Shop'].every(x => lower.includes(`>${x.toLowerCase()}<`) || lower.includes(x.toLowerCase())),
      discord: marker('discord.gg/xJbUeHFPMt'),
      copyright2026: marker('2026 DTF Genetics'),
      seedProd: marker('seedprod'),
      comingSoonGeneric: marker('Great things are on the horizon') || marker('Something big is brewing') || marker('coming soon'),
      maintenance: marker('maintenance mode'),
      wpPage743: marker('page-id-743'),
    },
    excerpt: stripPublicText(html).slice(0, 1800),
  };
}

async function publicFetch(path, cacheKey) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const sep = path.includes('?') ? '&' : '?';
      const response = await fetch(`${site}${path}${sep}dtf_cutover_diag=${encodeURIComponent(cacheKey)}-${attempt}`, {
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
        redirect: 'follow',
      });
      const html = await response.text();
      return { response, html };
    } catch (error) {
      lastError = error;
      await sleep(1200 + attempt * 1000);
    }
  }
  throw lastError;
}

const token = crypto.randomBytes(32).toString('hex');
const snippet = `
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-cutover-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };
    $targets = [
        ['rel' => 'index.html', 'markers' => ['dtf-home.css', 'THC Grow Doc, genetics, cultivation education, and games in one home.']],
        ['rel' => 'learn/index.html', 'markers' => ['Grow education belongs in a clean, readable library.', 'MOPS, cultivation notes, THC basics']],
    ];
    $key = static fn($rel) => 'dtf_cutover_diag_' . md5($rel);

    register_rest_route('dtf-diagnostic/v1', '/retire-cutover-shadows', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($targets, $key) {
            $root = trailingslashit(wp_normalize_path(ABSPATH));
            $prepared = [];
            foreach ($targets as $target) {
                $rel = $target['rel'];
                $path = wp_normalize_path(ABSPATH . $rel);
                if (strpos($path, $root) !== 0) return new WP_Error('unsafe_path', 'Path escaped ABSPATH.', ['status'=>500]);
                if (!is_file($path)) continue;
                $content = file_get_contents($path);
                if ($content === false) return new WP_Error('read_failed', 'Could not read candidate.', ['status'=>500,'path'=>$rel]);
                $matched = false;
                foreach ($target['markers'] as $marker) if (stripos($content, $marker) !== false) { $matched = true; break; }
                if (!$matched) continue;
                if (!is_writable($path) || !is_writable(dirname($path))) return new WP_Error('not_writable', 'Candidate is not writable.', ['status'=>500,'path'=>$rel]);
                $backup = ['rel'=>$rel,'content'=>base64_encode($content),'sha256'=>hash('sha256',$content),'mode'=>fileperms($path)&0777];
                update_option($key($rel), $backup, false);
                $stored = get_option($key($rel));
                if (!is_array($stored) || ($stored['sha256']??'') !== $backup['sha256']) return new WP_Error('backup_failed','Backup verification failed.',['status'=>500,'path'=>$rel]);
                $prepared[] = ['rel'=>$rel,'path'=>$path];
            }
            $removed = [];
            foreach ($prepared as $item) {
                if (!unlink($item['path'])) return new WP_Error('unlink_failed','Failed removing candidate.',['status'=>500,'path'=>$item['rel']]);
                $removed[] = $item['rel'];
            }
            flush_rewrite_rules(true);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            return rest_ensure_response(['ok'=>true,'removed'=>$removed]);
        }
    ]);

    register_rest_route('dtf-diagnostic/v1', '/restore-cutover-shadows', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => static function () use ($targets, $key) {
            $restored = [];
            foreach ($targets as $target) {
                $rel = $target['rel'];
                $backup = get_option($key($rel));
                if (!is_array($backup) || empty($backup['content'])) continue;
                $raw = base64_decode($backup['content'], true);
                if ($raw === false) continue;
                $path = wp_normalize_path(ABSPATH . $rel);
                if (file_put_contents($path, $raw, LOCK_EX) === false) return new WP_Error('restore_failed','Restore write failed.',['status'=>500,'path'=>$rel]);
                @chmod($path, (int)($backup['mode']??0644));
                if (hash_file('sha256', $path) !== ($backup['sha256']??'')) return new WP_Error('restore_verify_failed','Restore hash mismatch.',['status'=>500,'path'=>$rel]);
                delete_option($key($rel));
                $restored[] = $rel;
            }
            flush_rewrite_rules(true);
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            return rest_ensure_response(['ok'=>true,'restored'=>$restored]);
        }
    ]);
});
`.trim();

let pluginState;
let snippetId = 0;
let retired = false;
let report = { generatedAt: new Date().toISOString(), removed: [], restored: [], fingerprints: [], cachePurgedAfterRemoval: false, cachePurgedAfterRestore: false };
let primaryError = null;

try {
  pluginState = await ensureSnippetPlugin();
  const created = await request('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: { name: `DTF Cutover Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`, desc: 'Temporary rollback-safe static cutover diagnostic.', code: snippet, tags: ['dtf-diagnostic','temporary'], scope: 'global', priority: 1, active: false, network: false },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary diagnostic snippet ID was not returned.');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const retiredResult = await request('/wp-json/dtf-diagnostic/v1/retire-cutover-shadows', {
    method: 'POST', headers: { 'X-DTF-Cutover-Token': token },
  });
  report.removed = retiredResult.body?.removed || [];
  retired = report.removed.length > 0;
  if (!retired) throw new Error('Diagnostic did not retire any verified stale shadow file.');

  report.cachePurgedAfterRemoval = await purgeCacheBestEffort();
  const cacheKey = `${process.env.GITHUB_RUN_ID || Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  for (const path of ['/', '/learn/', '/learn/infographics/']) {
    const { response, html } = await publicFetch(path, cacheKey);
    report.fingerprints.push(fingerprint(path, response, html));
  }
} catch (error) {
  primaryError = error;
  report.error = error.message;
} finally {
  if (retired && snippetId) {
    try {
      const restored = await request('/wp-json/dtf-diagnostic/v1/restore-cutover-shadows', {
        method: 'POST', headers: { 'X-DTF-Cutover-Token': token },
      });
      report.restored = restored.body?.restored || [];
      report.cachePurgedAfterRestore = await purgeCacheBestEffort();
    } catch (restoreError) {
      report.restoreError = restoreError.message;
      console.log(JSON.stringify(report));
      throw new Error(`Diagnostic rollback failed: ${restoreError.message}`);
    }
  }

  if (snippetId) {
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400,404] }); } catch {}
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (pluginState?.installed && !pluginState.original.installed) {
    try { await request(pluginPath(pluginState.id), { method: 'POST', json: { status: 'inactive' } }); } catch {}
    try { await request(pluginPath(pluginState.id), { method: 'DELETE', allow: [400,404] }); } catch {}
  } else if (pluginState?.activated && !pluginState.original.active) {
    try { await request(pluginPath(pluginState.id), { method: 'POST', json: { status: 'inactive' } }); } catch {}
  }
}

report.rollbackVerified = report.removed.length > 0 && report.restored.length === report.removed.length;
console.log(JSON.stringify(report));
if (primaryError) throw primaryError;
if (!report.rollbackVerified) throw new Error('Diagnostic rollback count did not match removed files.');
