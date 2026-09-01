import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const expectedLiveSha = 'a32f9a10a5f79580d665d8d2c4718993a9d4bc14070eb8a26a4a2386f8535a3c';
const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const token = crypto.randomBytes(32).toString('hex');

async function wpRequest(path, { method = 'GET', json, headers = {}, allow = [] } = {}) {
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
    throw new Error(`WP ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

async function wpGetRetry(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { lastError = error; await sleep(800 + attempt * 600); }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

const code = String.raw`
add_action('rest_api_init', function () {
    $token = ${JSON.stringify(token)};
    $expected_live_sha = '${expectedLiveSha}';
    $live = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-homepage-override.php');
    $backup = wp_normalize_path(WPMU_PLUGIN_DIR . '/dtf-homepage-override.php.dtf-disabled');
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-repair-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };
    $file_state = static function ($path) {
        if (!is_file($path)) return ['exists' => false];
        $content = is_readable($path) ? (string) file_get_contents($path) : '';
        return [
            'exists' => true,
            'bytes' => filesize($path),
            'sha256' => hash_file('sha256', $path),
            'mtime_gmt' => gmdate('c', filemtime($path)),
            'markers' => [
                'template_redirect' => stripos($content, 'template_redirect') !== false,
                'stale_home' => stripos($content, 'THC Grow Doc, genetics, cultivation education, and games in one home.') !== false,
                'stale_learn' => stripos($content, 'Grow education belongs in a clean, readable library.') !== false || stripos($content, 'MOPS, cultivation notes, THC basics') !== false,
                'stale_seeds' => stripos($content, 'DTF Genetics catalog pages built around strain identity and grow context.') !== false,
            ],
        ];
    };

    register_rest_route('dtf-seeds-mu-collision/v1', '/state', [
        'methods' => 'GET',
        'permission_callback' => $permission,
        'callback' => static function () use ($live, $backup, $file_state, $expected_live_sha) {
            $live_state = $file_state($live);
            $backup_state = $file_state($backup);
            return rest_ensure_response([
                'ok' => true,
                'expected_live_sha256' => $expected_live_sha,
                'live' => $live_state,
                'backup' => $backup_state,
                'collision' => !empty($live_state['exists']) && !empty($backup_state['exists']),
            ]);
        },
    ]);

    register_rest_route('dtf-seeds-mu-collision/v1', '/archive-backup', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () use ($live, $backup, $file_state, $expected_live_sha, $token) {
            if (!is_dir(WPMU_PLUGIN_DIR) || !is_writable(WPMU_PLUGIN_DIR)) {
                return new WP_Error('dtf_mu_dir', 'MU plugin directory is not writable.', ['status' => 500]);
            }
            $live_state = $file_state($live);
            if (empty($live_state['exists'])) {
                return new WP_Error('dtf_live_missing', 'Live MU override is missing; refusing collision reconciliation.', ['status' => 409]);
            }
            if (empty($live_state['sha256']) || !hash_equals($expected_live_sha, (string) $live_state['sha256'])) {
                return new WP_Error('dtf_live_hash', 'Live MU override hash changed; refusing collision reconciliation.', ['status' => 409, 'sha256' => $live_state['sha256'] ?? null]);
            }
            $backup_state = $file_state($backup);
            if (empty($backup_state['exists'])) {
                return rest_ensure_response(['ok' => true, 'changed' => false, 'reason' => 'no-backup-collision', 'live' => $live_state, 'backup' => $backup_state]);
            }
            $backup_sha = (string) ($backup_state['sha256'] ?? 'unknown');
            $stamp = gmdate('YmdHis');
            $archive_name = 'dtf-homepage-override.php.dtf-archive-' . substr($backup_sha, 0, 12) . '-' . $stamp . '-' . substr($token, 0, 12) . '.disabled';
            $archive = wp_normalize_path(WPMU_PLUGIN_DIR . '/' . $archive_name);
            if (is_file($archive)) {
                return new WP_Error('dtf_archive_collision', 'Generated archive path already exists.', ['status' => 409, 'archive' => $archive_name]);
            }
            if (!rename($backup, $archive)) {
                return new WP_Error('dtf_archive_rename', 'Could not preserve the existing disabled backup under an archive name.', ['status' => 500]);
            }
            clearstatcache(true, $backup);
            clearstatcache(true, $archive);
            $archive_state = $file_state($archive);
            if (is_file($backup) || empty($archive_state['exists']) || empty($archive_state['sha256']) || !hash_equals($backup_sha, (string) $archive_state['sha256'])) {
                @rename($archive, $backup);
                return new WP_Error('dtf_archive_verify', 'Archived backup did not verify; original backup path restored.', ['status' => 500]);
            }
            update_option('dtf_seeds_mu_collision_archive_v1', [
                'archive' => $archive_name,
                'sha256' => $backup_sha,
                'updated_at' => gmdate('c'),
            ], false);
            return rest_ensure_response([
                'ok' => true,
                'changed' => true,
                'archive' => $archive_name,
                'live' => $live_state,
                'previous_backup' => $backup_state,
                'archive_state' => $archive_state,
            ]);
        },
    ]);
});
`.trim();

let snippetId = 0;
async function cleanup() {
  if (!snippetId) return;
  try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
  try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
}

try {
  const ready = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
  if (!ready.ok) throw new Error('Code Snippets REST API is unavailable; refusing plugin-management fallback.');

  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Seeds MU Backup Collision Reconciler ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary hash-gated reconciler that preserves an existing disabled MU backup under a non-PHP archive name before the transactional Seeds repair.',
      code,
      tags: ['dtf-repair', 'seeds', 'mu-override', 'collision', 'temporary'],
      scope: 'global', priority: 1, active: false, network: false,
    },
  });
  snippetId = Number(created.body?.id || 0);
  if (!snippetId) throw new Error('Temporary collision reconciler did not return an ID.');
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' });

  const before = await wpGetRetry('/wp-json/dtf-seeds-mu-collision/v1/state', { headers: { 'X-DTF-Repair-Token': token } });
  if (before.body?.live?.sha256 !== expectedLiveSha) {
    throw new Error(`Live MU override no longer matches the confirmed SHA: ${JSON.stringify(before.body?.live || null)}`);
  }

  const reconciled = await wpRequest('/wp-json/dtf-seeds-mu-collision/v1/archive-backup', {
    method: 'POST',
    headers: { 'X-DTF-Repair-Token': token },
  });
  if (reconciled.body?.ok !== true) throw new Error('Backup collision reconciliation did not return success.');

  const after = await wpGetRetry('/wp-json/dtf-seeds-mu-collision/v1/state', { headers: { 'X-DTF-Repair-Token': token } });
  if (after.body?.collision === true || after.body?.backup?.exists === true) {
    throw new Error(`Backup collision remains after reconciliation: ${JSON.stringify(after.body)}`);
  }
  if (after.body?.live?.sha256 !== expectedLiveSha) {
    throw new Error(`Live MU override changed during collision reconciliation: ${JSON.stringify(after.body?.live || null)}`);
  }

  console.log(JSON.stringify({ ok: true, before: before.body, reconciled: reconciled.body, after: after.body }));
} finally {
  await cleanup();
}
