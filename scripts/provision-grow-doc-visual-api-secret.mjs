import crypto from 'node:crypto'

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '')
const username = process.env.WP_API_USERNAME || ''
const password = process.env.WP_API_PASSWORD || ''
const apiKey = process.env.THC_GROW_DOC_GEMINI_API_KEY || ''

if (!username || !password) throw new Error('WordPress production credentials are required.')
if (!apiKey) throw new Error('THC_GROW_DOC_GEMINI_API_KEY is required.')
if (apiKey.length < 20 || apiKey.length > 512 || /[\r\n\0]/.test(apiKey)) {
  throw new Error('THC_GROW_DOC_GEMINI_API_KEY has an invalid shape.')
}

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const bridgeToken = crypto.randomBytes(32).toString('hex')
const bridgeTokenLiteral = JSON.stringify(bridgeToken)
const keyBase64 = Buffer.from(apiKey, 'utf8').toString('base64')
const targetFileName = 'dtf-grow-doc-visual-secret.php'
const targetPhp = `<?php\ndefined('ABSPATH') || exit;\nif (!defined('THC_GROW_DOC_GEMINI_API_KEY')) {\n    define('THC_GROW_DOC_GEMINI_API_KEY', base64_decode('${keyBase64}', true));\n}\n`
const expectedSha = crypto.createHash('sha256').update(targetPhp).digest('hex')
const targetContentBase64 = Buffer.from(targetPhp, 'utf8').toString('base64')

let snippetId = 0
let plugin = null
let pluginId = 'code-snippets/code-snippets'
let installedPlugin = false
let activatedPlugin = false
let pluginWasInstalled = false
let pluginWasActive = false

async function wpRequest(path, { method = 'GET', json, allow = [] } = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json, */*;q=0.8',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  let body = text
  try { body = text ? JSON.parse(text) : null } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    const safeBody = typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)
    throw new Error(`WordPress ${method} ${path} failed (${response.status}): ${safeBody}`)
  }
  return { ok: response.ok, status: response.status, body }
}

async function queryPlugin() {
  const r = await wpRequest('/wp-json/wp/v2/plugins?search=Code%20Snippets&per_page=100', { allow: [401, 403, 404] })
  if (!r.ok || !Array.isArray(r.body)) return null
  return r.body.find((item) => String(item?.plugin || '').startsWith('code-snippets/')) || null
}

async function waitForPlugin() {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const found = await queryPlugin().catch(() => null)
    if (found) return found
    await sleep(800 + attempt * 500)
  }
  return null
}

async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const r = await wpRequest('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] }).catch(() => null)
    if (r?.ok) return true
    await sleep(800 + attempt * 500)
  }
  return false
}

async function ensureSnippetBridgeAvailable() {
  plugin = await queryPlugin()
  pluginWasInstalled = Boolean(plugin)
  pluginWasActive = plugin?.status === 'active'

  let ready = await wpRequest('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] })
  if (ready.ok) return

  if (!plugin) {
    try {
      const created = await wpRequest('/wp-json/wp/v2/plugins', {
        method: 'POST',
        json: { slug: 'code-snippets', status: 'active' },
      })
      plugin = created.body
      installedPlugin = true
    } catch (error) {
      plugin = await waitForPlugin()
      if (!plugin) throw error
    }
  }

  pluginId = plugin?.plugin || pluginId
  if (plugin?.status !== 'active') {
    const activated = await wpRequest(`/wp-json/wp/v2/plugins/${pluginId.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      json: { status: 'active' },
    })
    plugin = activated.body
    activatedPlugin = true
  }

  if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.')
}

async function cleanupBridge() {
  if (snippetId) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }) } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }) } catch {}
    snippetId = 0
  }

  if (installedPlugin && !pluginWasInstalled) {
    try {
      await wpRequest(`/wp-json/wp/v2/plugins/${pluginId.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST', json: { status: 'inactive' }, allow: [400, 404],
      })
      await wpRequest(`/wp-json/wp/v2/plugins/${pluginId.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'DELETE', allow: [400, 404],
      })
    } catch {}
  } else if (activatedPlugin && !pluginWasActive) {
    try {
      await wpRequest(`/wp-json/wp/v2/plugins/${pluginId.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST', json: { status: 'inactive' }, allow: [400, 404],
      })
    } catch {}
  }
}

const snippetCode = `
add_action('rest_api_init', function () {
    $token = ${bridgeTokenLiteral};
    $permission = static function (WP_REST_Request $request) use ($token) {
        $supplied = (string) $request->get_header('x-dtf-grow-doc-secret-token');
        return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);
    };

    register_rest_route('dtf-grow-doc-secret/v1', '/provision', [
        'methods' => 'POST',
        'permission_callback' => $permission,
        'callback' => static function () {
            $target = wp_normalize_path(WPMU_PLUGIN_DIR . '/${targetFileName}');
            $temp = $target . '.tmp-' . wp_generate_password(12, false, false);
            $backup = $target . '.bak-' . gmdate('YmdHis');
            $expected = '${expectedSha}';
            $decoded = base64_decode('${targetContentBase64}', true);

            if ($decoded === false || hash('sha256', $decoded) !== $expected) {
                return new WP_Error('dtf_secret_payload', 'Provisioning payload integrity check failed.', ['status' => 500]);
            }
            if (!is_dir(WPMU_PLUGIN_DIR) || !is_writable(WPMU_PLUGIN_DIR)) {
                return new WP_Error('dtf_secret_dir', 'MU plugin directory is not writable.', ['status' => 500]);
            }

            $had_old = is_file($target);
            if ($had_old) {
                if (!is_readable($target) || !copy($target, $backup)) {
                    return new WP_Error('dtf_secret_backup', 'Could not create a rollback copy of the existing secret loader.', ['status' => 500]);
                }
                @chmod($backup, 0600);
            }

            $written = file_put_contents($temp, $decoded, LOCK_EX);
            if ($written === false || $written !== strlen($decoded)) {
                @unlink($temp);
                if ($had_old) @unlink($backup);
                return new WP_Error('dtf_secret_write', 'Could not stage the server-side secret loader.', ['status' => 500]);
            }
            @chmod($temp, 0600);
            clearstatcache(true, $temp);
            if (!is_file($temp) || hash_file('sha256', $temp) !== $expected) {
                @unlink($temp);
                if ($had_old) @unlink($backup);
                return new WP_Error('dtf_secret_stage_verify', 'Staged secret loader failed checksum verification.', ['status' => 500]);
            }

            if (!@rename($temp, $target)) {
                @unlink($temp);
                if ($had_old && is_file($backup)) @unlink($backup);
                return new WP_Error('dtf_secret_promote', 'Could not atomically promote the server-side secret loader.', ['status' => 500]);
            }
            @chmod($target, 0600);
            clearstatcache(true, $target);

            if (!is_file($target) || hash_file('sha256', $target) !== $expected) {
                @unlink($target);
                if ($had_old && is_file($backup)) @rename($backup, $target);
                return new WP_Error('dtf_secret_verify', 'Promoted secret loader failed verification; rollback attempted.', ['status' => 500]);
            }
            if ($had_old && is_file($backup)) @unlink($backup);

            return rest_ensure_response([
                'ok' => true,
                'file' => '${targetFileName}',
                'sha256' => $expected,
                'mode_requested' => '0600',
            ]);
        },
    ]);
});
`.trim()

try {
  await ensureSnippetBridgeAvailable()
  const created = await wpRequest('/wp-json/code-snippets/v1/snippets', {
    method: 'POST',
    json: {
      name: `DTF Grow Doc Secret Provisioner ${process.env.GITHUB_RUN_ID || Date.now()}`,
      desc: 'Temporary authenticated bridge used to atomically install the Grow Doc server-side visual-analysis secret loader.',
      code: snippetCode,
      tags: ['dtf-grow-doc', 'secret-provisioning', 'temporary'],
      scope: 'global',
      priority: 1,
      active: false,
      network: false,
    },
  })
  snippetId = Number(created.body?.id || 0)
  if (!snippetId) throw new Error('Temporary provisioning snippet was created without an ID.')
  await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/activate`, { method: 'POST' })

  const provisioned = await wpRequest('/wp-json/dtf-grow-doc-secret/v1/provision', {
    method: 'POST',
    json: {},
  })
  // The route requires a custom token header; use a direct fetch so the token never
  // becomes part of a URL or persisted request body.
  if (!provisioned.ok) throw new Error('Unexpected provisioning bridge response.')
} catch (initialError) {
  // The generic request above intentionally exercises route registration but cannot
  // satisfy its token header. Retry only when the expected permission response occurs.
  if (!String(initialError?.message || '').includes('(401)') && !String(initialError?.message || '').includes('(403)')) {
    await cleanupBridge()
    throw initialError
  }

  const response = await fetch(`${siteUrl}/wp-json/dtf-grow-doc-secret/v1/provision`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-DTF-Grow-Doc-Secret-Token': bridgeToken,
    },
    body: '{}',
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch {}
  if (!response.ok || !body?.ok || body.sha256 !== expectedSha || body.file !== targetFileName) {
    await cleanupBridge()
    throw new Error(`Server-side secret provisioning failed (${response.status}).`)
  }

  console.log(JSON.stringify({
    ok: true,
    site: siteUrl,
    target: targetFileName,
    sha256: expectedSha,
    secretValueLogged: false,
  }))
} finally {
  await cleanupBridge()
}
