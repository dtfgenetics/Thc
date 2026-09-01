import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const token = crypto.randomBytes(32).toString('hex');
const tokenLiteral = JSON.stringify(token);

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
    catch (error) { lastError = error; await sleep(800 + attempt * 650); }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

async function queryCodeSnippetsPlugin() {
  const list = await wpGetRetry('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [404, 401, 403] });
  if (!list.ok || !Array.isArray(list.body)) return null;
  return list.body.find((plugin) => String(plugin?.plugin || '').startsWith('code-snippets/')) || null;
}

function pluginEndpoint(pluginId) {
  return `/wp-json/wp/v2/plugins/${String(pluginId || 'code-snippets/code-snippets').split('/').map(encodeURIComponent).join('/')}`;
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
    const result = await wpRequest('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
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

    $markers = [
        'stale_catalog' => 'DTF Genetics catalog pages built around strain identity and grow context.',
        'genetics_library' => 'DTF Genetics library',
        'blue_mango' => 'Blue Mango',
        'mango_bubbles' => 'Mango Bubbles',
        'grow_notes' => 'Grow Notes',
    ];

    $summary = static function ($raw) use ($markers) {
        $raw = is_string($raw) ? $raw : '';
        $marker_state = [];
        foreach ($markers as $label => $needle) {
            $marker_state[$label] = $raw !== '' && strpos($raw, $needle) !== false;
        }
        return [
            'present' => $raw !== '',
            'bytes' => strlen($raw),
            'sha256' => $raw !== '' ? hash('sha256', $raw) : null,
            'markers' => $marker_state,
        ];
    };

    $block_inventory = static function ($content) {
        $names = [];
        $parts = [];
        $patterns = [];
        $walk = static function ($blocks) use (&$walk, &$names, &$parts, &$patterns) {
            foreach ((array) $blocks as $block) {
                $name = isset($block['blockName']) ? (string) $block['blockName'] : '';
                if ($name !== '') $names[] = $name;
                $attrs = isset($block['attrs']) && is_array($block['attrs']) ? $block['attrs'] : [];
                if ($name === 'core/template-part' && !empty($attrs['slug'])) $parts[] = (string) $attrs['slug'];
                if ($name === 'core/pattern' && !empty($attrs['slug'])) $patterns[] = (string) $attrs['slug'];
                if (!empty($block['innerBlocks'])) $walk($block['innerBlocks']);
            }
        };
        if (function_exists('parse_blocks')) $walk(parse_blocks((string) $content));
        $names = array_values(array_unique($names)); sort($names, SORT_STRING);
        $parts = array_values(array_unique($parts)); sort($parts, SORT_STRING);
        $patterns = array_values(array_unique($patterns)); sort($patterns, SORT_STRING);
        return [
            'block_names' => $names,
            'has_post_content' => in_array('core/post-content', $names, true),
            'template_parts' => $parts,
            'patterns' => $patterns,
        ];
    };

    $template_summary = static function ($template) use ($summary, $block_inventory) {
        if (!$template) return null;
        $content = isset($template->content) ? (string) $template->content : '';
        return [
            'id' => isset($template->id) ? (string) $template->id : null,
            'slug' => isset($template->slug) ? (string) $template->slug : null,
            'theme' => isset($template->theme) ? (string) $template->theme : null,
            'type' => isset($template->type) ? (string) $template->type : null,
            'source' => isset($template->source) ? (string) $template->source : null,
            'origin' => isset($template->origin) ? (string) $template->origin : null,
            'status' => isset($template->status) ? (string) $template->status : null,
            'is_custom' => isset($template->is_custom) ? (bool) $template->is_custom : null,
            'content' => $summary($content),
            'blocks' => $block_inventory($content),
        ];
    };

    register_rest_route('dtf-seeds-block-template-diagnostic/v1', '/state', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($summary, $template_summary) {
            $page = get_page_by_path('seeds', OBJECT, 'page');
            if (!$page || !isset($page->ID)) {
                return new WP_Error('dtf_seeds_missing', 'Seeds page could not be resolved.', ['status' => 404]);
            }
            $page_id = (int) $page->ID;
            $theme = (string) get_stylesheet();
            $candidate_slugs = ['page-seeds', 'page-' . $page_id, 'page', 'singular', 'index'];
            $hierarchy = [];
            foreach ($candidate_slugs as $slug) {
                $template = function_exists('get_block_template') ? get_block_template($theme . '//' . $slug, 'wp_template') : null;
                $hierarchy[$slug] = $template_summary($template);
            }

            $matching_templates = [];
            if (function_exists('get_block_templates')) {
                foreach ((array) get_block_templates([], 'wp_template') as $template) {
                    $content = isset($template->content) ? (string) $template->content : '';
                    $slug = isset($template->slug) ? (string) $template->slug : '';
                    if (strpos($content, 'DTF Genetics catalog pages built around strain identity and grow context.') !== false ||
                        strpos($content, 'DTF Genetics library') !== false ||
                        in_array($slug, $candidate_slugs, true)) {
                        $matching_templates[] = $template_summary($template);
                    }
                }
            }

            $matching_parts = [];
            if (function_exists('get_block_templates')) {
                foreach ((array) get_block_templates([], 'wp_template_part') as $part) {
                    $content = isset($part->content) ? (string) $part->content : '';
                    if (strpos($content, 'DTF Genetics catalog pages built around strain identity and grow context.') !== false ||
                        strpos($content, 'DTF Genetics library') !== false ||
                        strpos($content, 'Blue Mango') !== false ||
                        strpos($content, 'Mango Bubbles') !== false) {
                        $matching_parts[] = $template_summary($part);
                    }
                }
            }

            $db_templates = [];
            $posts = get_posts([
                'post_type' => ['wp_template', 'wp_template_part'],
                'post_status' => ['publish', 'draft'],
                'numberposts' => -1,
                'suppress_filters' => false,
            ]);
            foreach ((array) $posts as $post) {
                $content = (string) $post->post_content;
                if (strpos($content, 'DTF Genetics catalog pages built around strain identity and grow context.') !== false ||
                    strpos($content, 'DTF Genetics library') !== false ||
                    strpos($content, 'Blue Mango') !== false ||
                    strpos($content, 'Mango Bubbles') !== false ||
                    in_array((string) $post->post_name, $candidate_slugs, true)) {
                    $db_templates[] = [
                        'id' => (int) $post->ID,
                        'post_type' => (string) $post->post_type,
                        'slug' => (string) $post->post_name,
                        'status' => (string) $post->post_status,
                        'modified_gmt' => (string) $post->post_modified_gmt,
                        'content' => $summary($content),
                    ];
                }
            }

            $active_plugins = array_values(array_map('strval', (array) get_option('active_plugins', [])));
            sort($active_plugins, SORT_STRING);

            return rest_ensure_response([
                'ok' => true,
                'page' => [
                    'id' => $page_id,
                    'slug' => (string) $page->post_name,
                    'content' => $summary((string) $page->post_content),
                ],
                'theme' => [
                    'stylesheet' => $theme,
                    'is_block_theme' => function_exists('wp_is_block_theme') ? (bool) wp_is_block_theme() : null,
                ],
                'candidate_hierarchy' => $hierarchy,
                'matching_templates' => $matching_templates,
                'matching_template_parts' => $matching_parts,
                'matching_database_template_posts' => $db_templates,
                'active_plugins' => $active_plugins,
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

async function cleanup() {
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

try {
  let plugin = await queryCodeSnippetsPlugin();
  pluginWasInstalled = Boolean(plugin);
  pluginWasActive = plugin?.status === 'active';
  if (!plugin) { plugin = await installCodeSnippetsNative(); installedByProbe = true; }
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
      name: `DTF Seeds Block Template Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary read-only diagnostic for the WordPress block-template hierarchy serving /seeds/.',
      code: snippetCode,
      tags: ['dtf-diagnostic', 'temporary', 'seeds', 'block-template'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary diagnostic snippet was created without a usable ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });
  const state = await wpRequest('/wp-json/dtf-seeds-block-template-diagnostic/v1/state', {
    method: 'POST',
    json: { dtf_repair_token: token },
  });
  if (state.body?.ok !== true) throw new Error(`Diagnostic endpoint returned invalid state: ${JSON.stringify(state.body).slice(0, 700)}`);
  console.log(JSON.stringify({ ok: true, generatedAt: new Date().toISOString(), state: state.body }, null, 2));
} finally {
  await cleanup();
}
