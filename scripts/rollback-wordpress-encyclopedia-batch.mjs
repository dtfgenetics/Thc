import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const backupDir = process.argv[2] || process.env.ENCYCLOPEDIA_PREBACKUP_DIR || '';
if (!user || !pass) throw new Error('WordPress API credentials are required.');
if (!backupDir) throw new Error('Encyclopedia pre-backup directory is required.');

const statePath = `${backupDir}/pre-batch-state.json`;
const hashPath = `${backupDir}/pre-batch-state.sha256`;
const rawState = await readFile(statePath, 'utf8');
const expectedHash = (await readFile(hashPath, 'utf8')).trim().split(/\s+/)[0];
const actualHash = crypto.createHash('sha256').update(rawState).digest('hex');
if (!expectedHash || expectedHash !== actualHash) throw new Error(`Backup integrity check failed for ${statePath}.`);
const state = JSON.parse(rawState);
if (state?.schemaVersion !== 1 || !Number.isInteger(state.encyclopediaPageId) || !Array.isArray(state.existingPages) || !Array.isArray(state.missingSlugs)) {
  throw new Error('Invalid encyclopedia pre-batch state.');
}

const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const transient = new Set([408, 425, 429, 500, 502, 503, 504, 520, 522, 523, 524]);
async function request(endpoint, { method = 'GET', body, allow = [] } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(`${site}/wp-json/wp/v2${endpoint}`, {
        method,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache'
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(35_000)
      });
      const text = await response.text();
      let parsed = text;
      try { parsed = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok && !allow.includes(response.status)) {
        const error = new Error(`${method} ${endpoint} failed ${response.status}: ${typeof parsed === 'string' ? parsed.slice(0, 700) : JSON.stringify(parsed).slice(0, 700)}`);
        error.status = response.status;
        if (!transient.has(response.status)) throw error;
        lastError = error;
      } else {
        return { ok: response.ok, status: response.status, body: parsed };
      }
    } catch (error) {
      lastError = error;
      const code = error?.code || error?.cause?.code || '';
      if (!['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET'].includes(code) && !transient.has(error?.status)) throw error;
    }
    if (attempt < 6) await sleep(Math.min(1000 * (2 ** (attempt - 1)), 8000));
  }
  throw lastError || new Error(`${method} ${endpoint} failed after retries.`);
}

async function findOwnedPage(slug, parent) {
  const result = await request(`/pages?slug=${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100`);
  const owned = (Array.isArray(result.body) ? result.body : []).filter(page => Number(page.parent || 0) === Number(parent || 0));
  if (owned.length > 1) throw new Error(`Rollback found multiple owners for ${slug}.`);
  return owned[0] || null;
}

const raw = value => value?.raw ?? value?.rendered ?? '';
function restorePayload(page) {
  const payload = {
    slug: page.slug,
    title: raw(page.title),
    content: raw(page.content),
    excerpt: raw(page.excerpt),
    status: page.status,
    parent: Number(page.parent || 0),
    comment_status: page.comment_status || 'closed'
  };
  if (Number.isInteger(page.menu_order)) payload.menu_order = page.menu_order;
  if (typeof page.template === 'string') payload.template = page.template;
  return payload;
}
function fingerprint(page) {
  return JSON.stringify({
    slug: page.slug,
    title: raw(page.title),
    content: raw(page.content),
    excerpt: raw(page.excerpt),
    status: page.status,
    parent: Number(page.parent || 0),
    comment_status: page.comment_status || 'closed',
    menu_order: Number(page.menu_order || 0),
    template: page.template || ''
  });
}

const deleted = [];
for (const slug of state.missingSlugs) {
  const current = await findOwnedPage(slug, state.encyclopediaPageId);
  if (!current) continue;
  await request(`/pages/${current.id}?force=true`, { method: 'DELETE' });
  deleted.push({ id: current.id, slug });
}

const restored = [];
for (const page of [...state.existingPages].reverse()) {
  await request(`/pages/${page.id}`, { method: 'POST', body: restorePayload(page) });
  const reread = (await request(`/pages/${page.id}?context=edit`)).body;
  if (fingerprint(reread) !== fingerprint(page)) throw new Error(`Rollback verification mismatch for WordPress page ${page.id} (${page.slug}).`);
  restored.push({ id: page.id, slug: page.slug });
}

for (const slug of state.missingSlugs) {
  const current = await findOwnedPage(slug, state.encyclopediaPageId);
  if (current) throw new Error(`Rollback left created page ${slug} in production.`);
}

console.log(JSON.stringify({
  ok: true,
  batch: state.batch,
  backupSha256: actualHash,
  restored,
  deleted
}, null, 2));
