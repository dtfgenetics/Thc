import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const batchPath = process.argv[2] || process.env.ENCYCLOPEDIA_BATCH_FILE || '';
const backupDir = process.argv[3] || process.env.ENCYCLOPEDIA_PREBACKUP_DIR || '';
if (!user || !pass) throw new Error('WordPress API credentials are required.');
if (!batchPath) throw new Error('Encyclopedia batch path is required.');
if (!backupDir) throw new Error('Encyclopedia pre-backup directory is required.');

const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const batch = JSON.parse(await readFile(batchPath, 'utf8'));
if (batch.publicationAuthorized !== true || !Array.isArray(batch.lessonFiles) || batch.lessonFiles.length === 0) {
  throw new Error(`Batch ${batch.batch || batchPath} is not an authorized publication batch.`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const transient = new Set([408, 425, 429, 500, 502, 503, 504, 520, 522, 523, 524]);
async function request(endpoint, { method = 'GET', body } = {}) {
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
      if (!response.ok) {
        const error = new Error(`${method} ${endpoint} failed ${response.status}: ${typeof parsed === 'string' ? parsed.slice(0, 700) : JSON.stringify(parsed).slice(0, 700)}`);
        error.status = response.status;
        if (!transient.has(response.status)) throw error;
        lastError = error;
      } else {
        return parsed;
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

async function findOwnedPage(slug, parent = null) {
  const rows = await request(`/pages?slug=${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100`);
  const owned = (Array.isArray(rows) ? rows : []).filter(page => parent === null || Number(page.parent || 0) === Number(parent || 0));
  if (owned.length > 1) throw new Error(`Multiple published owners found for ${slug} under parent ${parent}.`);
  return owned[0] || null;
}

const learn = await findOwnedPage('learn');
if (!learn) throw new Error('Canonical /learn/ WordPress page was not found.');
const encyclopedia = await findOwnedPage('encyclopedia', learn.id);
if (!encyclopedia) throw new Error('Canonical /learn/encyclopedia/ WordPress page was not found.');

const expectedSlugs = [];
const existingPages = [encyclopedia];
const missingSlugs = [];
for (const lessonPath of batch.lessonFiles) {
  const lesson = JSON.parse(await readFile(lessonPath, 'utf8'));
  if (!/^THC-ENC-\d{3}$/.test(String(lesson.id || ''))) throw new Error(`Invalid lesson ID in ${lessonPath}.`);
  const slug = lesson.id.toLowerCase();
  expectedSlugs.push(slug);
  const existing = await findOwnedPage(slug, encyclopedia.id);
  if (existing) existingPages.push(existing);
  else missingSlugs.push(slug);
}

const state = {
  schemaVersion: 1,
  batch: batch.batch,
  batchPath,
  site,
  learnPageId: learn.id,
  encyclopediaPageId: encyclopedia.id,
  expectedSlugs,
  missingSlugs,
  existingPages,
  capturedAt: new Date().toISOString()
};
const payload = `${JSON.stringify(state, null, 2)}\n`;
const digest = crypto.createHash('sha256').update(payload).digest('hex');
await mkdir(backupDir, { recursive: true });
await writeFile(`${backupDir}/pre-batch-state.json`, payload);
await writeFile(`${backupDir}/pre-batch-state.sha256`, `${digest}  pre-batch-state.json\n`);

console.log(JSON.stringify({
  ok: true,
  batch: batch.batch,
  encyclopediaPageId: encyclopedia.id,
  existingLessonPages: existingPages.length - 1,
  missingLessonPages: missingSlugs.length,
  backupDir,
  sha256: digest
}, null, 2));
