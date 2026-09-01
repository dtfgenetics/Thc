import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const token = crypto.randomBytes(32).toString('hex');

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
  return { ok: response.ok, status: response.status, body };
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

const snippetCode = String.raw`
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    register_rest_route('dtf-seedprod-diagnostic/v1', '/state', [
        'methods' => 'GET',
        'permission_callback' => static function (WP_REST_Request $request) use ($token) {
            $supplied = (string) $request->get_header('x-dtf-repair-token');
            return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
        },
        'callback' => static function () {
            global $wpdb;
            $stale = 'DTF Genetics catalog pages built around strain identity and grow context.';
            $canonical = 'DTF Genetics library';
            $grow_notes = 'Grow Notes';

            $safe_summary = static function ($value) use ($stale, $canonical, $grow_notes) {
                $raw = is_string($value) ? $value : maybe_serialize($value);
                return [
                    'bytes' => strlen((string) $raw),
                    'sha256' => $raw !== '' ? hash('sha256', (string) $raw) : null,
                    'stale_catalog' => $raw !== '' && strpos((string) $raw, $stale) !== false,
                    'genetics_library' => $raw !== '' && strpos((string) $raw, $canonical) !== false,
                    'grow_notes' => $raw !== '' && strpos((string) $raw, $grow_notes) !== false,
                ];
            };

            $reflection = null;
            $source_summary = null;
            if (function_exists('seedprod_lite_lppage_render')) {
                $ref = new ReflectionFunction('seedprod_lite_lppage_render');
                $file = wp_normalize_path((string) $ref->getFileName());
                $plugin_root = wp_normalize_path(WP_PLUGIN_DIR) . '/';
                $relative = strpos($file, $plugin_root) === 0 ? substr($file, strlen($plugin_root)) : basename($file);
                $reflection = [
                    'file' => $relative,
                    'start_line' => (int) $ref->getStartLine(),
                    'end_line' => (int) $ref->getEndLine(),
                ];
                if (is_readable($file)) {
                    $lines = file($file, FILE_IGNORE_NEW_LINES);
                    $slice = array_slice((array) $lines, max(0, $ref->getStartLine() - 1), max(0, $ref->getEndLine() - $ref->getStartLine() + 1));
                    $source = implode("\n", $slice);
                    preg_match_all('/(?:get_option|update_option|get_post_meta|get_post|seedprod_[a-zA-Z0-9_]+)\s*\(\s*[\'\"]([^\'\"]+)/', $source, $matches);
                    preg_match_all('/[\'\"]([a-zA-Z0-9_]*seedprod[a-zA-Z0-9_]*|[a-zA-Z0-9_]*(?:coming_soon|maintenance)[a-zA-Z0-9_]*)[\'\"]/', $source, $keys);
                    $source_summary = [
                        'bytes' => strlen($source),
                        'sha256' => hash('sha256', $source),
                        'referenced_literals' => array_values(array_unique(array_merge($matches[1] ?? [], $keys[1] ?? []))),
                        'mentions_is_page' => strpos($source, 'is_page') !== false,
                        'mentions_get_queried_object_id' => strpos($source, 'get_queried_object_id') !== false,
                        'mentions_request_uri' => strpos($source, 'REQUEST_URI') !== false,
                        'mentions_template' => strpos($source, 'template') !== false,
                    ];
                }
            }

            $post_types = [];
            foreach (get_post_types([], 'objects') as $name => $obj) {
                if (stripos((string) $name, 'seedprod') !== false || stripos((string) ($obj->label ?? ''), 'seedprod') !== false || stripos((string) ($obj->label ?? ''), 'landing') !== false) {
                    $post_types[] = [
                        'name' => (string) $name,
                        'label' => (string) ($obj->label ?? ''),
                        'public' => (bool) ($obj->public ?? false),
                        'show_ui' => (bool) ($obj->show_ui ?? false),
                    ];
                }
            }

            $candidate_posts = [];
            $posts = get_posts([
                'post_type' => 'any',
                'post_status' => ['publish','draft','private','pending'],
                'numberposts' => -1,
                's' => 'DTF Genetics catalog pages built around strain identity and grow context.',
                'suppress_filters' => false,
            ]);
            foreach ((array) $posts as $post) {
                $candidate_posts[] = [
                    'id' => (int) $post->ID,
                    'post_type' => (string) $post->post_type,
                    'slug' => (string) $post->post_name,
                    'status' => (string) $post->post_status,
                    'title' => (string) $post->post_title,
                    'content' => $safe_summary((string) $post->post_content),
                    'excerpt' => $safe_summary((string) $post->post_excerpt),
                ];
            }

            $option_rows = $wpdb->get_results(
                "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE '%seedprod%' OR option_name LIKE '%coming%soon%' OR option_name LIKE '%maintenance%' ORDER BY option_name",
                ARRAY_A
            );
            $options = [];
            foreach ((array) $option_rows as $row) {
                $name = (string) ($row['option_name'] ?? '');
                $value = (string) ($row['option_value'] ?? '');
                $decoded = maybe_unserialize($value);
                $simple = null;
                if (is_bool($decoded) || is_int($decoded) || is_float($decoded)) $simple = $decoded;
                elseif (is_string($decoded) && strlen($decoded) <= 80 && preg_match('/^(?:0|1|on|off|yes|no|true|false|publish|draft|[0-9]+)$/i', $decoded)) $simple = $decoded;
                $options[] = [
                    'name' => $name,
                    'simple_value' => $simple,
                    'value' => $safe_summary($value),
                ];
            }

            $meta_rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE meta_key LIKE %s OR meta_value LIKE %s OR meta_value LIKE %s ORDER BY post_id, meta_key",
                    '%seedprod%',
                    '%' . $wpdb->esc_like($stale) . '%',
                    '%' . $wpdb->esc_like($canonical) . '%'
                ),
                ARRAY_A
            );
            $meta = [];
            foreach ((array) $meta_rows as $row) {
                $post_id = (int) ($row['post_id'] ?? 0);
                $post = $post_id ? get_post($post_id) : null;
                $meta[] = [
                    'post_id' => $post_id,
                    'post_type' => $post ? (string) $post->post_type : null,
                    'slug' => $post ? (string) $post->post_name : null,
                    'status' => $post ? (string) $post->post_status : null,
                    'meta_key' => (string) ($row['meta_key'] ?? ''),
                    'value' => $safe_summary((string) ($row['meta_value'] ?? '')),
                ];
            }

            $tables = [];
            $like = $wpdb->esc_like($wpdb->prefix) . '%seedprod%';
            $table_names = $wpdb->get_col($wpdb->prepare('SHOW TABLES LIKE %s', $like));
            foreach ((array) $table_names as $table) {
                $table = (string) $table;
                if (!preg_match('/^[A-Za-z0-9_]+$/', $table)) continue;
                $columns = $wpdb->get_results('SHOW COLUMNS FROM ' . $table, ARRAY_A);
                $text_columns = [];
                foreach ((array) $columns as $column) {
                    $type = strtolower((string) ($column['Type'] ?? ''));
                    if (preg_match('/char|text|json/', $type)) $text_columns[] = (string) ($column['Field'] ?? '');
                }
                $matches = [];
                foreach ($text_columns as $column) {
                    if (!preg_match('/^[A-Za-z0-9_]+$/', $column)) continue;
                    $sql = 'SELECT COUNT(*) FROM ' . $table . ' WHERE ' . $column . ' LIKE %s';
                    $count = (int) $wpdb->get_var($wpdb->prepare($sql, '%' . $wpdb->esc_like($stale) . '%'));
                    if ($count > 0) $matches[] = ['column' => $column, 'stale_match_count' => $count];
                }
                $tables[] = [
                    'name' => $table,
                    'columns' => array_values(array_map(static fn($c) => (string) ($c['Field'] ?? ''), (array) $columns)),
                    'stale_matches' => $matches,
                ];
            }

            $page_meta = [];
            foreach ((array) get_post_meta(868) as $key => $values) {
                if (stripos((string) $key, 'seedprod') === false && stripos((string) $key, 'landing') === false && stripos((string) $key, 'template') === false) continue;
                $page_meta[] = [
                    'key' => (string) $key,
                    'value' => $safe_summary(maybe_serialize($values)),
                ];
            }

            return rest_ensure_response([
                'ok' => true,
                'seedprod_render_function' => $reflection,
                'seedprod_render_source' => $source_summary,
                'post_types' => $post_types,
                'candidate_posts' => $candidate_posts,
                'options' => $options,
                'postmeta_matches' => $meta,
                'seedprod_tables' => $tables,
                'page_868_related_meta' => $page_meta,
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
  if (!schema.ok) throw new Error('Code Snippets REST API is unavailable.');

  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF SeedProd Diagnostic ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary authenticated read-only SeedProd state inspection for /seeds/.',
      code: snippetCode,
      tags: ['dtf-diagnostic', 'temporary', 'seedprod', 'seeds'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary SeedProd diagnostic snippet did not return an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const state = await wpGetRetry('/wp-json/dtf-seedprod-diagnostic/v1/state', {
    headers: { 'X-DTF-Repair-Token': token },
  });
  if (state.body?.ok !== true) throw new Error('SeedProd diagnostic endpoint did not return success.');
  console.log(JSON.stringify({ ok: true, generated_at: new Date().toISOString(), state: state.body }, null, 2));
} finally {
  await cleanupSnippet();
}
