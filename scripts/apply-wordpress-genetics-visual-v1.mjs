import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_GENETICS_LIBRARY || process.env.APPLY_GENETICS_VISUAL_V1 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-genetics-production/library';
const catalogPath = process.env.SEED_LINE_CATALOG || 'site/wordpress/products/seed-line-catalog.json';
const sharedCssPath = process.env.DTF_VISUAL_V1_CSS || 'site/design-system/dtf-visual-v1.css';
const bridgeCssPath = process.env.DTF_GENETICS_OWNER_V1_CSS || 'site/design-system/dtf-genetics-owner-v1.css';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Genetics-Visual-V1/1.0' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `genetics-visual-v1-${stamp}`);
await mkdir(backupDir, { recursive: true });

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 7) {
        await sleep(attempt * 1500);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 7) await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

function raw(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

function stripStyle(content, id) {
  return String(content || '').replace(new RegExp(`<style\\s+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`, 'gi'), '');
}

function markSeedsRoot(content) {
  let next = String(content || '').replace(/\sdata-dtf-visual=["']v1["']/g, '');
  const marked = /<div\s+class=["']dtf-v1 dtf-genetics-v1["']\s+data-dtf-genetics-library=["']2026["'][^>]*>/i;
  if (marked.test(next)) return next.replace(marked, match => match.replace(/>$/, ' data-dtf-visual="v1">'));
  const root = /<div\s+data-dtf-genetics-library=["']2026["']([^>]*)>/i;
  if (!root.test(next)) throw new Error('Canonical Seeds library marker was not found');
  return next.replace(root, '<div class="dtf-v1 dtf-genetics-v1" data-dtf-genetics-library="2026" data-dtf-visual="v1"$1>');
}

function markLineRoot(content, slug) {
  let next = String(content || '').replace(/\sdata-dtf-visual=["']v1["']/g, '');
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const marked = new RegExp(`<div\\s+class=["']dtf-v1 dtf-genetics-v1["']\\s+data-dtf-genetics-line=["']${escaped}["'][^>]*>`, 'i');
  if (marked.test(next)) return next.replace(marked, match => match.replace(/>$/, ' data-dtf-visual="v1">'));
  const root = new RegExp(`<div\\s+data-dtf-genetics-line=["']${escaped}["']([^>]*)>`, 'i');
  if (!root.test(next)) throw new Error(`Canonical genetics line marker was not found for ${slug}`);
  return next.replace(root, `<div class="dtf-v1 dtf-genetics-v1" data-dtf-genetics-line="${slug}" data-dtf-visual="v1"$1>`);
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (!Array.isArray(catalog?.lines) || !catalog.lines.length) throw new Error('Genetics line catalog is empty');
const sharedCss = await readFile(sharedCssPath, 'utf8');
const bridgeCss = await readFile(bridgeCssPath, 'utf8');
if (!sharedCss.includes('--dtf-bg:#07170f') || !sharedCss.includes('--dtf-gold:#d5b15a')) throw new Error('Shared DTF visual V1 tokens are incomplete');
if (!bridgeCss.includes('.dtf-v1.dtf-genetics-v1') || !bridgeCss.includes('data-dtf-genetics-library')) throw new Error('Genetics bridge stylesheet is incomplete');
const styles = `<style id="dtf-visual-v1-shared">\n${sharedCss}\n</style>\n<style id="dtf-genetics-owner-v1">\n${bridgeCss}\n</style>\n`;

const seedsRows = await request('/wp-json/wp/v2/pages?slug=seeds&context=edit&status=publish&per_page=10');
if (!Array.isArray(seedsRows) || seedsRows.length !== 1) throw new Error('Expected exactly one published Seeds page');
const seedsPage = seedsRows[0];

const targets = [{ type: 'library', slug: 'seeds', page: seedsPage }];
for (const line of catalog.lines) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(line.slug)}&parent=${seedsPage.id}&context=edit&status=publish&per_page=10`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`${line.slug}: expected exactly one published child page under Seeds`);
  targets.push({ type: 'line', slug: line.slug, line, page: rows[0] });
}

const report = { generatedAt: new Date().toISOString(), apply, pageCount: targets.length, pages: [], backupDir };
for (const target of targets) {
  const before = raw(target.page.content);
  const requiredMarker = target.type === 'library' ? 'data-dtf-genetics-library="2026"' : `data-dtf-genetics-line="${target.slug}"`;
  if (!before.includes(requiredMarker)) throw new Error(`${target.slug}: authoritative genetics marker is missing`);
  if (target.type === 'line') {
    if (!before.includes(target.line.name) || !before.includes(target.line.summary)) throw new Error(`${target.slug}: line identity content is incomplete`);
    if (target.line.lineage && !before.includes(target.line.lineage)) throw new Error(`${target.slug}: lineage content is missing`);
  }
  let content = stripStyle(before, 'dtf-visual-v1-shared');
  content = stripStyle(content, 'dtf-genetics-owner-v1');
  content = target.type === 'library' ? markSeedsRoot(content) : markLineRoot(content, target.slug);
  content = `${styles}${content}`;
  if (!content.includes('data-dtf-visual="v1"') || !content.includes('dtf-genetics-owner-v1')) throw new Error(`${target.slug}: visual markers were not applied`);
  await writeFile(join(backupDir, `${target.slug}-before.json`), `${JSON.stringify(target.page, null, 2)}\n`);
  await writeFile(join(backupDir, `${target.slug}-after.html`), `${content}\n`);
  if (apply) {
    await request(`/wp-json/wp/v2/pages/${target.page.id}`, { method: 'POST', body: JSON.stringify({ content, status: 'publish' }) });
    const verifyRows = await request(`/wp-json/wp/v2/pages/${target.page.id}?context=edit`);
    const stored = raw(verifyRows.content);
    if (!stored.includes('data-dtf-visual="v1"') || !stored.includes(requiredMarker)) throw new Error(`${target.slug}: stored visual state did not verify`);
  }
  report.pages.push({ slug: target.slug, pageId: target.page.id, type: target.type, bytesBefore: before.length, bytesAfter: content.length });
}

await writeFile(join(backupDir, 'genetics-visual-v1-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'genetics-visual-v1-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
