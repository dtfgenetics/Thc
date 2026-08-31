import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const outputRoot = process.env.AUDIT_ROOT || '/tmp/wordpress-front-controller-audit';
const allowBridge = String(process.env.ALLOW_TEMPORARY_AUDIT_BRIDGE || '').toLowerCase() === 'true';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
if (!allowBridge) throw new Error('Refusing temporary audit bridge without ALLOW_TEMPORARY_AUDIT_BRIDGE=true.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const token = crypto.randomBytes(32).toString('hex');
const namespace = `dtf-front-controller-audit/v1-${crypto.randomBytes(8).toString('hex')}`;
const tokenLiteral = JSON.stringify(token);
const namespaceLiteral = JSON.stringify(namespace);
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const outputDir = join(outputRoot, `front-controller-${stamp}`);
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputRoot, 'latest-audit-path.txt'), `${outputDir}\n`);

let snippetId = null;

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

async function ensureSnippetApi() {
  const result = await request('/wp-json/code-snippets/v1/snippets/schema', { allow: [401, 403, 404, 500] });
  if (!result.ok) throw new Error(`Code Snippets REST API unavailable (${result.status}).`);
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $namespace = ${namespaceLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-front-controller-token');
        if ($supplied === '') $supplied = (string) $request->get_param('_dtf_front_controller_token');
        return $supplied !== '' && hash_equals($token, $supplied);
    };

    $normalize = static function ($path) {
        if (!is_string($path) || $path === '') return '';
        return untrailingslashit(wp_normalize_path($path));
    };

    $file_meta = static function ($path) use ($normalize) {
        $path = $normalize($path);
        $exists = $path !== '' && file_exists($path);
        $is_file = $exists && is_file($path);
        $is_dir = $exists && is_dir($path);
        $readable = $exists && is_readable($path);
        $content = null;
        if ($is_file && $readable) {
            $size = @filesize($path);
            if (is_int($size) && $size >= 0 && $size <= 2097152) {
                $content = @file_get_contents($path);
                if (!is_string($content)) $content = null;
            }
        }
        $lower = is_string($content) ? strtolower($content) : '';
        return [
            'path' => $path,
            'realpath' => $exists ? $normalize((string) @realpath($path)) : '',
            'exists' => $exists,
            'is_file' => $is_file,
            'is_dir' => $is_dir,
            'readable' => $readable,
            'size' => $is_file ? (int) @filesize($path) : null,
            'mtime_gmt' => $exists && @filemtime($path) ? gmdate('c', (int) @filemtime($path)) : null,
            'sha256' => $is_file && $readable ? (string) @hash_file('sha256', $path) : '',
            'markers' => [
                'wordpress_front_controller' => $lower !== '' && strpos($lower, 'wp-blog-header.php') !== false,
                'wp_use_themes' => $lower !== '' && strpos($lower, 'wp_use_themes') !== false,
                'legacy_home_shell' => $lower !== '' && (strpos($lower, 'thc grow doc, genetics, cultivation education, and games in one home') !== false || strpos($lower, '/assets/dtf-home/dtf-home.css') !== false),
                'legacy_learn_shell' => $lower !== '' && strpos($lower, 'grow education belongs in a clean, readable library') !== false,
                'legacy_blog_shell' => $lower !== '' && strpos($lower, 'cannabis culture insights') !== false,
                'static_front_door' => $lower !== '' && strpos($lower, 'dtf static front door') !== false,
                'wordpress_htaccess' => $lower !== '' && strpos($lower, '# begin wordpress') !== false,
                'directory_index_html_first' => $lower !== '' && preg_match('/directoryindex\\s+index\\.html(?:\\s+index\\.htm)?\\s+index\\.php/i', $content) === 1,
            ],
        ];
    };

    $dir_meta = static function ($base, $slug) use ($normalize, $file_meta) {
        $dir = $normalize($base . '/' . $slug);
        return [
            'path' => $dir,
            'realpath' => file_exists($dir) ? $normalize((string) @realpath($dir)) : '',
            'exists' => is_dir($dir),
            'index_php' => $file_meta($dir . '/index.php'),
            'index_html' => $file_meta($dir . '/index.html'),
            'htaccess' => $file_meta($dir . '/.htaccess'),
        ];
    };

    register_rest_route($namespace, '/audit', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($normalize, $file_meta, $dir_meta) {
            $abspath = $normalize(ABSPATH);
            $document_root = $normalize((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
            $script_filename = $normalize((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
            $routes = ['home', 'seeds', 'learn', 'community', 'shop', 'gallery', 'about', 'contact', 'blog'];
            $roots = array_values(array_unique(array_filter([$abspath, $document_root])));
            $root_reports = [];

            foreach ($roots as $root) {
                $route_reports = [];
                foreach ($routes as $route) $route_reports[$route] = $dir_meta($root, $route);
                $root_reports[] = [
                    'root' => $root,
                    'realpath' => file_exists($root) ? $normalize((string) @realpath($root)) : '',
                    'is_abspath' => $root === $abspath,
                    'is_document_root' => $root === $document_root,
                    'index_php' => $file_meta($root . '/index.php'),
                    'index_html' => $file_meta($root . '/index.html'),
                    'htaccess' => $file_meta($root . '/.htaccess'),
                    'wp_config_exists' => is_file($root . '/wp-config.php'),
                    'wp_admin_exists' => is_dir($root . '/wp-admin'),
                    'wp_content_exists' => is_dir($root . '/wp-content'),
                    'routes' => $route_reports,
                ];
            }

            $same_root = $abspath !== '' && $document_root !== '' && $normalize((string) @realpath($abspath)) === $normalize((string) @realpath($document_root));
            return rest_ensure_response([
                'ok' => true,
                'generated_at' => gmdate('c'),
                'wordpress' => [
                    'abspath' => $abspath,
                    'abspath_realpath' => file_exists($abspath) ? $normalize((string) @realpath($abspath)) : '',
                    'document_root' => $document_root,
                    'document_root_realpath' => file_exists($document_root) ? $normalize((string) @realpath($document_root)) : '',
                    'same_real_root' => $same_root,
                    'script_filename' => $script_filename,
                    'home_url' => home_url('/'),
                    'site_url' => site_url('/'),
                    'wp_content_dir' => $normalize(WP_CONTENT_DIR),
                    'request_uri' => (string) ($_SERVER['REQUEST_URI'] ?? ''),
                    'server_software' => (string) ($_SERVER['SERVER_SOFTWARE'] ?? ''),
                ],
                'roots' => $root_reports,
            ]);
        },
    ]);
});
`.trim();

async function bridgeAudit() {
  return request(`/wp-json/${namespace}/audit`, {
    method: 'POST',
    headers: { 'X-DTF-Front-Controller-Token': token },
    json: { _dtf_front_controller_token: token },
  });
}

async function publicProbe(path) {
  const url = new URL(path, siteUrl);
  url.searchParams.set('dtf_front_controller_audit', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'DTFSeeds-Front-Controller-Audit/1.0',
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
    },
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  const lower = text.toLowerCase();
  return {
    path,
    status: response.status,
    location: response.headers.get('location') || '',
    contentLength: text.length,
    headers: {
      server: response.headers.get('server') || '',
      xLiteSpeedCache: response.headers.get('x-litespeed-cache') || '',
      xPoweredBy: response.headers.get('x-powered-by') || '',
      cacheControl: response.headers.get('cache-control') || '',
    },
    markers: {
      homeV3: lower.includes('data-dtf-layout="home-v3"') || lower.includes('genetics first. cultivation science behind it.'),
      learnV3: lower.includes('data-dtf-layout="learn-v3"') || lower.includes('learn the plant as a connected system.'),
      legacyHome: lower.includes('thc grow doc, genetics, cultivation education, and games in one home.'),
      legacyLearn: lower.includes('grow education belongs in a clean, readable library.'),
      legacyBlog: lower.includes('cannabis culture insights'),
      staticHomeCss: lower.includes('/assets/dtf-home/dtf-home.css'),
      wordpressBodyClass: /class=["'][^"']*\b(?:home|page|wordpress|wp-)/i.test(text),
    },
  };
}

async function cleanupSnippet() {
  if (!snippetId) return;
  for (const suffix of ['', '?snippets-safe-mode=1']) {
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate${suffix}`, { method: 'POST', allow: [400, 404, 500] }); } catch {}
    try { await request(`/wp-json/code-snippets/v1/snippets/${snippetId}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
  }
}

try {
  await ensureSnippetApi();
  const created = await request('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Front Controller Audit ${process.env.GITHUB_RUN_ID || stamp}`,
      desc: 'Temporary token-protected read-only bridge for comparing WordPress ABSPATH with the serving document root and fingerprinting route shadows.',
      code: snippetCode,
      tags: ['dtf-audit', 'temporary', 'read-only'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary front-controller audit snippet was created without an ID.');
  await request(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const audit = await bridgeAudit();
  if (audit.body?.ok !== true) throw new Error(`Front-controller bridge audit failed: ${JSON.stringify(audit.body).slice(0, 900)}`);

  const publicRoutes = [];
  for (const path of ['/', '/learn/', '/blog/', '/seeds/', '/shop/', '/games/']) {
    publicRoutes.push(await publicProbe(path));
  }

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    siteUrl,
    filesystem: audit.body,
    publicRoutes,
  };
  await writeFile(join(outputDir, 'front-controller-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await cleanupSnippet();
}
