import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const backupDir = process.argv[2] || process.env.ENCYCLOPEDIA_TOPIC_BACKUP_DIR || '';
if (!user || !pass) throw new Error('WordPress API credentials are required.');
if (!backupDir) throw new Error('Topic backup directory is required.');

const seal = JSON.parse(await readFile(`${backupDir}/rollback-integrity.json`, 'utf8'));
if (seal?.schemaVersion !== 1 || !seal.hashes) throw new Error('Invalid topic rollback integrity seal.');
for (const [name, expected] of Object.entries(seal.hashes)) {
  const bytes = await readFile(`${backupDir}/${name}`);
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error(`Topic rollback integrity mismatch for ${name}.`);
}

const backups = JSON.parse(await readFile(`${backupDir}/pre-write-pages.json`, 'utf8'));
const report = JSON.parse(await readFile(`${backupDir}/encyclopedia-topic-organization-report.json`, 'utf8'));
if (!Array.isArray(backups) || !Array.isArray(report?.created)) throw new Error('Invalid topic rollback package.');

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

const expected = page => JSON.stringify({
  title: page.title || '',
  content: page.content || '',
  excerpt: page.excerpt || '',
  status: page.status || 'publish'
});
const actual = page => JSON.stringify({
  title: page?.title?.raw ?? page?.title?.rendered ?? '',
  content: page?.content?.raw ?? page?.content?.rendered ?? '',
  excerpt: page?.excerpt?.raw ?? page?.excerpt?.rendered ?? '',
  status: page?.status || 'publish'
});

for (const id of [...report.created].reverse()) {
  await request(`/pages/${id}?force=true`, { method: 'DELETE', allow: [404] });
}

const restored = [];
for (const page of [...backups].reverse()) {
  await request(`/pages/${page.id}`, {
    method: 'POST',
    body: { title: page.title, content: page.content, excerpt: page.excerpt, status: page.status }
  });
  const reread = (await request(`/pages/${page.id}?context=edit`)).body;
  if (actual(reread) !== expected(page)) throw new Error(`Topic rollback verification mismatch for page ${page.id} (${page.slug}).`);
  restored.push({ id: page.id, slug: page.slug });
}

for (const id of report.created) {
  const result = await request(`/pages/${id}?context=edit`, { allow: [404] });
  if (result.ok) throw new Error(`Topic rollback left created page ${id} in production.`);
}

console.log(JSON.stringify({
  ok: true,
  backupDir,
  restored,
  deletedCreatedPageIds: report.created
}, null, 2));
