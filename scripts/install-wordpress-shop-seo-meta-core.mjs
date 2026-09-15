import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const sourcePath = process.env.SHOP_SEO_SOURCE || 'site/wordpress/mu-plugins/dtf-shop-seo-meta.php';
const snippetName = 'DTF Shop SEO Metadata — source controlled';
if (!username || !password) throw new Error('WordPress credentials are required.');

const desired = await readFile(sourcePath, 'utf8');
const desiredSha = crypto.createHash('sha256').update(desired).digest('hex');
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
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTFSeeds-Shop-SEO-Installer/2.0',
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await sleep(attempt * 1400);
        continue;
      }
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

function collection(body) {
  if (Array.isArray(body)) return body;
  for (const key of ['snippets', 'data', 'items', 'results']) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}

function item(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (['id', 'name', 'active', 'code', 'scope'].some((key) => Object.prototype.hasOwnProperty.call(body, key))) return body;
  for (const key of ['snippet', 'data', 'item']) {
    const nested = body[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
  }
  return body;
}

function isActive(snippet) {
  return snippet?.active === true || snippet?.active === 1 || snippet?.active === '1' || snippet?.active === 'true';
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
    const result = await request('/wp-json/code-snippets/v1/snippets/schema', { allow: [404, 500] }, 2).catch(() => null);
    if (result?.ok) return true;
    await sleep(attempt * 800);
  }
  return false;
}

async function ensureSnippetApi() {
  if (await waitForSnippetApi()) return { installedPlugin: false, activatedPlugin: false };

  let plugin = await queryPlugin();
  let installedPlugin = false;
  let activatedPlugin = false;
  if (!plugin) {
    const created = await request('/wp-json/wp/v2/plugins', { method: 'POST', json: { slug: 'code-snippets', status: 'active' } });
    plugin = created.body;
    installedPlugin = true;
  }
  const pluginId = plugin?.plugin || 'code-snippets/code-snippets';
  if (plugin?.status !== 'active') {
    await request(pluginEndpoint(pluginId), { method: 'POST', json: { status: 'active' } });
    activatedPlugin = true;
  }
  if (!(await waitForSnippetApi())) throw new Error('Code Snippets API did not become available.');
  return { installedPlugin, activatedPlugin };
}

function buildSnippetCode(source) {
  let code = String(source)
    .replace(/^\s*<\?php\s*/i, '')
    .replace(/if\s*\(\s*!defined\(\s*['"]ABSPATH['"]\s*\)\s*\)\s*\{\s*exit;\s*\}\s*/i, '')
    .trim();
  if (!code.includes('dtf_shop_seo_description') || !code.includes('document_title_parts')) {
    throw new Error('Reviewed Shop SEO source is missing its canonical title/description hooks.');
  }
  return `if (!function_exists('dtf_shop_seo_description')) {\n${code}\n}`;
}

async function listSnippets() {
  const result = await request('/wp-json/code-snippets/v1/snippets?per_page=100');
  return collection(result.body);
}

async function getSnippet(id) {
  const result = await request(`/wp-json/code-snippets/v1/snippets/${id}`, { allow: [404] });
  return result.ok ? item(result.body) : null;
}

async function deactivate(id) {
  await request(`/wp-json/code-snippets/v1/snippets/${id}/deactivate`, { method: 'POST', allow: [400, 404] });
}

async function activate(id) {
  const result = await request(`/wp-json/code-snippets/v1/snippets/${id}/activate`, { method: 'POST' });
  return item(result.body);
}

async function remove(id) {
  await request(`/wp-json/code-snippets/v1/snippets/${id}`, { method: 'DELETE', allow: [404] });
}

await ensureSnippetApi();
const snippetCode = buildSnippetCode(desired);
const snippetCodeSha = crypto.createHash('sha256').update(snippetCode).digest('hex');
const existingRows = (await listSnippets()).filter((row) => String(row?.name || '') === snippetName);
const existing = [];
for (const row of existingRows) {
  const id = Number(row?.id || 0);
  if (!id) continue;
  const full = await getSnippet(id);
  if (full) existing.push(full);
}

const exact = existing.find((row) => String(row?.code || '') === snippetCode);
if (exact) {
  if (!isActive(exact)) await activate(Number(exact.id));
  for (const duplicate of existing) {
    if (Number(duplicate.id) === Number(exact.id)) continue;
    await deactivate(Number(duplicate.id)).catch(() => {});
    await remove(Number(duplicate.id)).catch(() => {});
  }
  const verified = await getSnippet(Number(exact.id));
  if (!verified || !isActive(verified) || String(verified.code || '') !== snippetCode) {
    throw new Error('Existing source-controlled Shop SEO snippet could not be verified active with reviewed code.');
  }
  console.log(JSON.stringify({
    ok: true,
    siteUrl,
    sourcePath,
    sourceSha256: desiredSha,
    snippetCodeSha256: snippetCodeSha,
    owner: 'code-snippets-fallback',
    snippetId: Number(exact.id),
    changed: false,
    alreadyCurrent: true,
  }));
  process.exit(0);
}

const created = await request('/wp-json/code-snippets/v1/snippets', {
  method: 'POST',
  json: {
    name: snippetName,
    desc: `Source-controlled DTF Shop SEO fallback. Source SHA256: ${desiredSha}`,
    code: snippetCode,
    tags: ['dtf', 'shop-seo', 'source-controlled'],
    scope: 'global',
    priority: 1,
    active: false,
    network: false,
  },
});
const newSnippet = item(created.body);
const newId = Number(newSnippet?.id || 0);
if (!newId) throw new Error('Source-controlled Shop SEO snippet was created without an ID.');

const previouslyActive = existing.filter(isActive).map((row) => Number(row.id)).filter(Boolean);
try {
  for (const row of existing) await deactivate(Number(row.id));
  await activate(newId);
  const verified = await getSnippet(newId);
  if (!verified || !isActive(verified) || String(verified.code || '') !== snippetCode) {
    throw new Error('New source-controlled Shop SEO snippet failed active-code verification.');
  }
  for (const row of existing) await remove(Number(row.id)).catch(() => {});
} catch (error) {
  await deactivate(newId).catch(() => {});
  await remove(newId).catch(() => {});
  for (const id of previouslyActive) await activate(id).catch(() => {});
  throw error;
}

console.log(JSON.stringify({
  ok: true,
  siteUrl,
  sourcePath,
  sourceSha256: desiredSha,
  snippetCodeSha256: snippetCodeSha,
  owner: 'code-snippets-fallback',
  snippetId: newId,
  changed: true,
  replacedSnippetCount: existing.length,
}));
