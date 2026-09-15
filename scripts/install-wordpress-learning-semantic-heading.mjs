import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const sourcePath = process.env.LEARNING_HEADING_SOURCE || 'site/wordpress/snippets/dtf-learning-semantic-heading.php';
const snippetName = 'DTF Learning Semantic Heading — source controlled';

if (!username || !password) throw new Error('WordPress credentials are required.');

const source = await readFile(sourcePath, 'utf8');
const sourceSha = crypto.createHash('sha256').update(source).digest('hex');
const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', json, allow = [] } = {}, attempts = 6) {
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
          'User-Agent': 'DTFSeeds-Learning-Semantic-Heading-Installer/1.0',
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await sleep(attempt * 1200);
        continue;
      }
      if (!response.ok && !allow.includes(response.status)) {
        throw new Error(`${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 800) : JSON.stringify(body).slice(0, 800)}`);
      }
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      last = error;
      if (attempt < attempts) await sleep(attempt * 1200);
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
    if (body[key] && typeof body[key] === 'object' && !Array.isArray(body[key])) return body[key];
  }
  return body;
}

function isActive(snippet) {
  return snippet?.active === true || snippet?.active === 1 || snippet?.active === '1' || snippet?.active === 'true';
}

function buildSnippetCode(php) {
  const code = String(php)
    .replace(/^\s*<\?php\s*/i, '')
    .replace(/if\s*\(\s*!defined\(\s*['"]ABSPATH['"]\s*\)\s*\)\s*\{\s*exit;\s*\}\s*/i, '')
    .trim();

  for (const marker of [
    'dtf_learning_page_owns_designed_h1',
    'dtf_learning_remove_duplicate_theme_title',
    "render_block_core/post-title",
    'get_page_uri',
  ]) {
    if (!code.includes(marker)) throw new Error(`Learning semantic-heading source is missing required marker: ${marker}`);
  }

  return code;
}

async function ensureSnippetApi() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const result = await request('/wp-json/code-snippets/v1/snippets/schema', { allow: [404, 500] }, 2).catch(() => null);
    if (result?.ok) return;
    await sleep(attempt * 700);
  }
  throw new Error('Code Snippets REST API is unavailable; refusing to weaken the semantic-heading owner to a less-authorized install path.');
}

async function listSnippets() {
  return collection((await request('/wp-json/code-snippets/v1/snippets?per_page=100')).body);
}

async function getSnippet(id) {
  const result = await request(`/wp-json/code-snippets/v1/snippets/${id}`, { allow: [404] });
  return result.ok ? item(result.body) : null;
}

async function activate(id) {
  return item((await request(`/wp-json/code-snippets/v1/snippets/${id}/activate`, { method: 'POST' })).body);
}

async function deactivate(id) {
  await request(`/wp-json/code-snippets/v1/snippets/${id}/deactivate`, { method: 'POST', allow: [400, 404] });
}

async function remove(id) {
  await request(`/wp-json/code-snippets/v1/snippets/${id}`, { method: 'DELETE', allow: [404] });
}

await ensureSnippetApi();
const snippetCode = buildSnippetCode(source);
const snippetCodeSha = crypto.createHash('sha256').update(snippetCode).digest('hex');
const candidates = (await listSnippets()).filter((row) => String(row?.name || '') === snippetName);
const existing = [];
for (const row of candidates) {
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
    throw new Error('Existing Learning semantic-heading snippet failed exact active-code verification.');
  }
  console.log(JSON.stringify({ ok: true, owner: 'code-snippets', snippetId: Number(exact.id), sourceSha256: sourceSha, snippetCodeSha256: snippetCodeSha, changed: false }));
  process.exit(0);
}

const created = item((await request('/wp-json/code-snippets/v1/snippets', {
  method: 'POST',
  json: {
    name: snippetName,
    desc: `Source-controlled semantic H1 owner for THC Learning pages. Source SHA256: ${sourceSha}`,
    code: snippetCode,
    tags: ['dtf', 'learning', 'accessibility', 'source-controlled'],
    scope: 'global',
    priority: 1,
    active: false,
    network: false,
  },
})).body);
const newId = Number(created?.id || 0);
if (!newId) throw new Error('Learning semantic-heading snippet was created without an ID.');

const previouslyActive = existing.filter(isActive).map((row) => Number(row.id)).filter(Boolean);
try {
  for (const row of existing) await deactivate(Number(row.id));
  await activate(newId);
  const verified = await getSnippet(newId);
  if (!verified || !isActive(verified) || String(verified.code || '') !== snippetCode) {
    throw new Error('New Learning semantic-heading snippet failed exact active-code verification.');
  }
  for (const row of existing) await remove(Number(row.id)).catch(() => {});
} catch (error) {
  await deactivate(newId).catch(() => {});
  await remove(newId).catch(() => {});
  for (const id of previouslyActive) await activate(id).catch(() => {});
  throw error;
}

console.log(JSON.stringify({ ok: true, owner: 'code-snippets', snippetId: newId, sourceSha256: sourceSha, snippetCodeSha256: snippetCodeSha, changed: true, replacedSnippetCount: existing.length }));
