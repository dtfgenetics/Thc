import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const repairToken = crypto.randomBytes(32).toString('hex');
const tokenLiteral = JSON.stringify(repairToken);

async function wpRequest(path, { method = 'GET', json, allow = [] } = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WordPress ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(900 + attempt * 700); }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

async function queryCodeSnippetsPlugin() {
  const list = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!list.ok || !Array.isArray(list.body)) return null;
  return list.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(pluginId) {
  const safe = String(pluginId || 'code-snippets/code-snippets').split('/').map(encodeURIComponent).join('/');
  return `/wp-json/wp/v2/plugins/${safe}`;
}

async function setPluginStatus(pluginId, status) {
  return wpRequest(pluginEndpoint(pluginId), { method: 'POST', json: { status } });
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
      if (response.ok) return true;
    } catch {}
    await sleep(900 + attempt * 500);
  }
  return false;
}

async function installCodeSnippetsNative() {
  let installError;
  try {
    const result = await wpRequest('/wp-json/wp/v2/plugins', {
      method: 'POST',
      json: { slug: 'code-snippets', status: 'active' },
    });
    if (result.body?.plugin) return result.body;
  } catch (error) { installError = error; }
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const plugin = await queryCodeSnippetsPlugin().catch(() => null);
    if (plugin) return plugin;
    await sleep(1200 + attempt * 600);
  }
  throw installError || new Error('WordPress native plugin install did not produce Code Snippets.');
}

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${tokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_param('dtf_repair_token');
        return $supplied !== '' && hash_equals($token, $supplied);
    };

    $summarize = static function ($value, $markers = []) {
        if (is_array($value) || is_object($value)) {
            $raw = wp_json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } elseif ($value === null) {
            $raw = '';
        } else {
            $raw = (string) $value;
        }
        if (!is_string($raw)) $raw = '';
        $out = [
            'present' => $raw !== '',
            'bytes' => strlen($raw),
            'sha256' => $raw !== '' ? hash('sha256', $raw) : null,
            'markers' => [],
        ];
        foreach ($markers as $label => $marker) {
            $out['markers'][$label] = $raw !== '' && strpos($raw, $marker) !== false;
        }
        return $out;
    };

    register_rest_route('dtf-seeds-render-diagnostic/v1', '/state', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($summarize) {
            $page = get_page_by_path('seeds', OBJECT, 'page');
            if (!$page || !isset($page->ID)) {
                return new WP_Error('dtf_seeds_page_missing', 'Published Seeds page could not be resolved by path.', ['status' => 404]);
            }

            $page_id = (int) $page->ID;
            $stale = 'DTF Genetics catalog pages built around strain identity and grow context.';
            $canonical = 'DTF Genetics library';
            $profile = 'Open Blue Mango profile';
            $markers = [
                'stale_catalog' => $stale,
                'genetics_library' => $canonical,
                'blue_mango_profile' => $profile,
            ];

            $known_meta_keys = [
                '_wp_page_template',
                '_elementor_edit_mode',
                '_elementor_data',
                '_elementor_template_type',
                '_elementor_version',
                '_elementor_page_settings',
                '_elementor_controls_usage',
                '_elementor_css',
                '_bricks_page_content_2',
                '_fl_builder_data',
                '_seedprod_page_uuid',
                '_et_pb_use_builder',
                '_et_pb_old_content',
            ];
            $known_meta = [];
            foreach ($known_meta_keys as $key) {
                $known_meta[$key] = $summarize(get_post_meta($page_id, $key, true), $markers);
            }

            $all_keys = get_post_custom_keys($page_id);
            if (!is_array($all_keys)) $all_keys = [];
            $builder_keys = [];
            foreach (array_values(array_unique($all_keys)) as $key) {
                $key = (string) $key;
                if (preg_match('/(elementor|template|bricks|oxygen|fl_builder|seedprod|et_pb|vc_|wpb|beaver)/i', $key)) {
                    $builder_keys[] = $key;
                }
            }
            sort($builder_keys, SORT_STRING);

            $active_plugins = (array) get_option('active_plugins', []);
            $builder_plugins = [];
            foreach ($active_plugins as $plugin) {
                $plugin = (string) $plugin;
                if (preg_match('/(elementor|bricks|oxygen|beaver|fl-builder|seedprod|divi|visual-composer|js_composer)/i', $plugin)) {
                    $builder_plugins[] = $plugin;
                }
            }
            sort($builder_plugins, SORT_STRING);

            $theme = wp_get_theme();
            $content = (string) $page->post_content;
            return rest_ensure_response([
                'ok' => true,
                'page' => [
                    'id' => $page_id,
                    'slug' => (string) $page->post_name,
                    'status' => (string) $page->post_status,
                    'modified_gmt' => (string) $page->post_modified_gmt,
                    'page_template_slug' => (string) get_page_template_slug($page_id),
                    'wp_page_template' => (string) get_post_meta($page_id, '_wp_page_template', true),
                    'content' => $summarize($content, $markers),
                    'has_blocks' => function_exists('has_blocks') ? (bool) has_blocks($content) : null,
                ],
                'theme' => [
                    'name' => (string) $theme->get('Name'),
                    'version' => (string) $theme->get('Version'),
                    'stylesheet' => (string) get_option('stylesheet'),
                    'template' => (string) get_option('template'),
                    'is_block_theme' => function_exists('wp_is_block_theme') ? (bool) wp_is_block_theme() : null,
                ],
                'builder' => [
                    'active_plugins' => $builder_plugins,
                    'meta_keys' => $builder_keys,
                    'known_meta' => $known_meta,
                ],
            ]);
        },
    ]);
});
`.trim();

let snippetId = 0;
let pluginWasInstalled = false;
let pluginWasActive = false;
let installedByProbe = false;
let activatedByProbe = false;
let pluginRestId = 'code-snippets/code-snippets';

async function cleanupTemporaryTools() {
  if (snippetId) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (activatedByProbe && pluginWasInstalled && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
  if (installedByProbe) {
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [404] }); } catch {}
  }
}

function markerSummary(raw) {
  const text = String(raw || '');
  const lower = text.toLowerCase();
  return {
    bytes: Buffer.byteLength(text),
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
    stale_catalog: lower.includes('dtf genetics catalog pages built around strain identity and grow context.'),
    genetics_library: lower.includes('dtf genetics library'),
    blue_mango_profile: lower.includes('open blue mango profile'),
  };
}

async function probePublicSeeds() {
  const nonce = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const response = await fetch(`${siteUrl}/seeds/?dtf_render_probe=${nonce}`, {
    redirect: 'follow',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      'User-Agent': 'DTFSeeds-Seeds-Render-Diagnostic/1.0',
    },
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    liteSpeedCache: response.headers.get('x-litespeed-cache'),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    ...markerSummary(text),
  };
}

try {
  const restPages = await wpGetRetry('/wp-json/wp/v2/pages?slug=seeds&context=edit&per_page=10&_fields=id,slug,status,template,modified_gmt,link,content');
  const restPage = Array.isArray(restPages.body) ? restPages.body[0] : null;
  const restState = restPage ? {
    id: Number(restPage.id || 0),
    slug: restPage.slug || null,
    status: restPage.status || null,
    template: restPage.template ?? null,
    modified_gmt: restPage.modified_gmt || null,
    link: restPage.link || null,
    content: markerSummary(restPage?.content?.raw || restPage?.content?.rendered || ''),
  } : null;

  let plugin = await queryCodeSnippetsPlugin();
  pluginWasInstalled = Boolean(plugin);
  pluginWasActive = plugin?.status === 'active';
  if (!plugin) {
    plugin = await installCodeSnippetsNative();
    installedByProbe = true;
  }
  if (plugin?.plugin) pluginRestId = plugin.plugin;
  if (plugin?.status !== 'active') {
    const activated = await setPluginStatus(pluginRestId, 'active');
    activatedByProbe = true;
    if (activated.body?.plugin) pluginRestId = activated.body.plugin;
  }
  if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.');

  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Seeds Read-Only Render Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary read-only page template and builder metadata diagnostic for the public Seeds route.',
      code: snippetCode,
      tags: ['dtf-diagnostic', 'temporary', 'seeds', 'render-state'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary diagnostic snippet was created without a usable ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const serverState = await wpRequest('/wp-json/dtf-seeds-render-diagnostic/v1/state', {
    method: 'POST',
    json: { dtf_repair_token: repairToken },
  });
  if (serverState.body?.ok !== true) throw new Error(`Diagnostic endpoint returned invalid state: ${JSON.stringify(serverState.body).slice(0, 700)}`);

  const publicState = await probePublicSeeds();
  console.log(JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    restState,
    serverState: serverState.body,
    publicState,
  }, null, 2));
} finally {
  await cleanupTemporaryTools();
}
