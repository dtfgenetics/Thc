import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const token = crypto.randomBytes(32).toString('hex');

const markerNeedles = {
  stale_catalog: 'DTF Genetics catalog pages built around strain identity and grow context.',
  genetics_library: 'DTF Genetics library',
  blue_mango_profile: 'Open Blue Mango profile',
  blue_mango: 'Blue Mango',
  mango_bubbles: 'Mango Bubbles',
  grow_notes: 'Grow Notes',
};

function summarizeText(value) {
  const text = String(value || '');
  return {
    bytes: Buffer.byteLength(text),
    sha256: text ? crypto.createHash('sha256').update(text).digest('hex') : null,
    markers: Object.fromEntries(Object.entries(markerNeedles).map(([key, needle]) => [key, text.includes(needle)])),
  };
}

async function wpRequest(path, { method = 'GET', json, headers = {}, allow = [], timeoutMs = 35_000 } = {}) {
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
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WordPress ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(800 + attempt * 650);
    }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

function renderedContent(body) {
  if (!body || typeof body !== 'object') return '';
  const content = body.content;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') return content.rendered || content.raw || '';
  return '';
}

function selectedHeaders(headers) {
  const keys = [
    'server',
    'cache-control',
    'age',
    'vary',
    'via',
    'x-cache',
    'cf-cache-status',
    'x-litespeed-cache',
    'x-litespeed-cache-control',
    'x-litespeed-tag',
    'x-hcdn-cache-status',
    'x-powered-by',
  ];
  return Object.fromEntries(keys.filter((key) => headers[key] !== undefined).map((key) => [key, headers[key]]));
}

async function freshPublic(path, label) {
  const joiner = path.includes('?') ? '&' : '?';
  const nonce = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  const response = await fetch(`${siteUrl}${path}${joiner}dtf_runtime_probe=${encodeURIComponent(nonce)}`, {
    redirect: 'follow',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      'User-Agent': 'DTFSeeds-Seeds-Runtime-Diagnostic/1.0',
    },
    signal: AbortSignal.timeout(35_000),
  });
  const text = await response.text();
  const headers = Object.fromEntries(response.headers.entries());
  return {
    label,
    path,
    status: response.status,
    final_url: response.url,
    headers: selectedHeaders(headers),
    content: summarizeText(text),
  };
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    register_rest_route('dtf-seeds-runtime-diagnostic/v1', '/state', [
        'methods' => 'GET',
        'permission_callback' => static function (WP_REST_Request $request) use ($token) {
            $supplied = (string) $request->get_header('x-dtf-repair-token');
            return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function () {
            if (!function_exists('get_mu_plugins') || !function_exists('get_dropins')) {
                require_once ABSPATH . 'wp-admin/includes/plugin.php';
            }

            $markers = [
                'stale_catalog' => 'DTF Genetics catalog pages built around strain identity and grow context.',
                'genetics_library' => 'DTF Genetics library',
                'blue_mango_profile' => 'Open Blue Mango profile',
                'blue_mango' => 'Blue Mango',
                'mango_bubbles' => 'Mango Bubbles',
                'grow_notes' => 'Grow Notes',
            ];
            $summary = static function ($raw) use ($markers) {
                $raw = is_string($raw) ? $raw : '';
                $state = [];
                foreach ($markers as $label => $needle) $state[$label] = $raw !== '' && strpos($raw, $needle) !== false;
                return [
                    'bytes' => strlen($raw),
                    'sha256' => $raw !== '' ? hash('sha256', $raw) : null,
                    'markers' => $state,
                ];
            };

            $callback_name = static function ($cb) {
                if (is_string($cb)) return $cb;
                if (is_array($cb) && count($cb) === 2) {
                    $left = is_object($cb[0]) ? get_class($cb[0]) : (string) $cb[0];
                    return $left . '::' . (string) $cb[1];
                }
                if ($cb instanceof Closure) return 'Closure';
                if (is_object($cb)) return get_class($cb);
                return gettype($cb);
            };
            $hook_rows = static function ($name) use ($callback_name) {
                global $wp_filter;
                $out = [];
                $hook = $wp_filter[$name] ?? null;
                if (!$hook || !isset($hook->callbacks) || !is_array($hook->callbacks)) return $out;
                foreach ($hook->callbacks as $priority => $callbacks) {
                    foreach ($callbacks as $entry) {
                        $out[] = [
                            'priority' => (int) $priority,
                            'callback' => $callback_name($entry['function'] ?? null),
                        ];
                    }
                }
                return $out;
            };

            $page = get_post(868);
            if (!$page || $page->post_type !== 'page') {
                return new WP_Error('dtf_seeds_page_missing', 'Page 868 is unavailable.', ['status' => 404]);
            }
            $raw = (string) $page->post_content;
            $filtered = apply_filters('the_content', $raw);
            $blocks = function_exists('do_blocks') ? do_blocks($raw) : $raw;

            $dropins = [];
            $labels = function_exists('get_dropins') ? get_dropins() : [];
            foreach (['advanced-cache.php','object-cache.php','db.php','sunrise.php','maintenance.php'] as $file) {
                $path = wp_normalize_path(WP_CONTENT_DIR . '/' . $file);
                $exists = is_file($path);
                $dropins[] = [
                    'file' => $file,
                    'exists' => $exists,
                    'bytes' => $exists ? (int) filesize($path) : 0,
                    'sha256' => $exists ? hash_file('sha256', $path) : null,
                    'label' => isset($labels[$file]['Name']) ? (string) $labels[$file]['Name'] : null,
                ];
            }

            $mu = [];
            foreach ((array) get_mu_plugins() as $file => $data) {
                $mu[] = [
                    'file' => (string) $file,
                    'name' => !empty($data['Name']) ? (string) $data['Name'] : null,
                ];
            }

            $active = array_values(array_map('strval', (array) get_option('active_plugins', [])));
            sort($active, SORT_STRING);

            $hooks = [];
            foreach ([
                'parse_request',
                'request',
                'pre_get_posts',
                'posts_pre_query',
                'the_posts',
                'wp',
                'template_redirect',
                'template_include',
                'the_content',
                'pre_render_block',
                'render_block_data',
                'render_block',
                'render_block_core/post-content',
            ] as $hook_name) {
                $hooks[$hook_name] = $hook_rows($hook_name);
            }

            return rest_ensure_response([
                'ok' => true,
                'wp_cache' => defined('WP_CACHE') ? (bool) WP_CACHE : null,
                'theme' => [
                    'stylesheet' => (string) get_option('stylesheet'),
                    'template' => (string) get_option('template'),
                ],
                'page' => [
                    'id' => (int) $page->ID,
                    'slug' => (string) $page->post_name,
                    'status' => (string) $page->post_status,
                    'modified_gmt' => (string) $page->post_modified_gmt,
                    'raw' => $summary($raw),
                    'the_content_filtered' => $summary((string) $filtered),
                    'do_blocks' => $summary((string) $blocks),
                ],
                'active_plugins' => $active,
                'mu_plugins' => $mu,
                'dropins' => $dropins,
                'hooks' => $hooks,
            ]);
        },
    ]);
});
`.trim();

let snippetId = 0;

async function cleanupSnippet() {
  if (!snippetId) return;
  try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
  try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
}

try {
  const schema = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (!schema.ok) {
    throw new Error('Code Snippets REST API is not currently available; refusing to use the slow plugin-management endpoint in this diagnostic.');
  }

  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Seeds Runtime Render Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary authenticated runtime inspection for the stale /seeds/ render split.',
      code: snippetCode,
      tags: ['dtf-diagnostic', 'temporary', 'seeds', 'runtime-render'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary runtime diagnostic snippet did not return an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const runtime = await wpGetRetry('/wp-json/dtf-seeds-runtime-diagnostic/v1/state', {
    headers: { 'X-DTF-Repair-Token': token },
  });
  if (runtime.body?.ok !== true) throw new Error('Seeds runtime diagnostic endpoint did not return success.');

  const [restEdit, restView, seedsPretty, seedsPageId] = await Promise.all([
    wpGetRetry('/wp-json/wp/v2/pages/868?context=edit&_fields=id,slug,status,modified_gmt,content'),
    wpGetRetry('/wp-json/wp/v2/pages/868?context=view&_fields=id,slug,status,modified_gmt,content'),
    freshPublic('/seeds/', 'pretty-permalink'),
    freshPublic('/index.php?page_id=868', 'direct-page-id'),
  ]);

  console.log(JSON.stringify({
    ok: true,
    generated_at: new Date().toISOString(),
    runtime: runtime.body,
    rest: {
      edit: {
        status: restEdit.status,
        headers: selectedHeaders(restEdit.headers),
        content: summarizeText(renderedContent(restEdit.body)),
      },
      view: {
        status: restView.status,
        headers: selectedHeaders(restView.headers),
        content: summarizeText(renderedContent(restView.body)),
      },
    },
    public_renders: [seedsPretty, seedsPageId],
  }, null, 2));
} finally {
  await cleanupSnippet();
}
