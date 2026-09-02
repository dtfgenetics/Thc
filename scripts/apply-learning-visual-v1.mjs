import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_LEARNING_VISUAL_V1 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-visual-v1';
const sharedCssPath = process.env.DTF_VISUAL_V1_CSS || 'site/design-system/dtf-visual-v1.css';
const bridgeCssPath = process.env.DTF_LEARNING_OWNER_V1_CSS || 'site/design-system/dtf-learning-owner-v1.css';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Learning-Visual-V1/1.0'
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `learning-visual-v1-${stamp}`);
await mkdir(backupDir, { recursive: true });

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 7) {
        await sleep(attempt * 1800);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 7) await sleep(attempt * 1800);
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
  const pattern = new RegExp(`<style\\s+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`, 'gi');
  return String(content || '').replace(pattern, '');
}

function markRoot(content, layout) {
  const withoutDuplicate = String(content || '').replace(/\sdata-dtf-visual=["']v1["']/g, '');
  const exact = `<div class="v3" data-dtf-layout="${layout}">`;
  if (withoutDuplicate.includes(exact)) {
    return withoutDuplicate.replace(exact, `<div class="v3 dtf-v1" data-dtf-layout="${layout}" data-dtf-visual="v1">`);
  }
  const already = `<div class="v3 dtf-v1" data-dtf-layout="${layout}">`;
  if (withoutDuplicate.includes(already)) {
    return withoutDuplicate.replace(already, `<div class="v3 dtf-v1" data-dtf-layout="${layout}" data-dtf-visual="v1">`);
  }
  throw new Error(`Could not find canonical ${layout} root for visual migration`);
}

const sharedCss = await readFile(sharedCssPath, 'utf8');
const bridgeCss = await readFile(bridgeCssPath, 'utf8');
if (!sharedCss.includes('--dtf-bg:#07170f') || !sharedCss.includes('--dtf-gold:#d5b15a')) {
  throw new Error('Shared DTF visual V1 tokens are incomplete');
}
if (!bridgeCss.includes('.v3.dtf-v1') || !bridgeCss.includes('data-dtf-layout="home-v3"') || !bridgeCss.includes('data-dtf-layout="learn-v3"')) {
  throw new Error('Learning owner bridge stylesheet is incomplete');
}

const styleBlock = `<style id="dtf-visual-v1-shared">\n${sharedCss}\n</style>\n<style id="dtf-learning-owner-v1">\n${bridgeCss}\n</style>\n`;
const targets = [
  {
    slug: 'home',
    layout: 'home-v3',
    required: [
      'Genetics first. Learn the plant behind the pack.',
      'Blue Mango F2 Regular DTF Genetics strain card',
      '/seeds/',
      '/learn/',
      '/tools/',
      '/games/'
    ]
  },
  {
    slug: 'learn',
    layout: 'learn-v3',
    required: [
      'Learn the plant as a connected system.',
      'data-dtf-learning-map="v4"',
      'data-dtf-learning-expanded-reference="v1"',
      '/learn/start-here/',
      '/learn/infographics/'
    ]
  }
];

const report = { generatedAt: new Date().toISOString(), apply, pages: [], backupDir };
for (const target of targets) {
  const pages = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(target.slug)}&context=edit&status=publish&per_page=10`);
  if (!Array.isArray(pages) || pages.length !== 1) throw new Error(`Expected exactly one published ${target.slug} page`);
  const page = pages[0];
  const before = raw(page.content);
  for (const marker of target.required) {
    if (!before.includes(marker)) throw new Error(`/${target.slug}/ is missing required owner marker: ${marker}`);
  }
  let content = stripStyle(before, 'dtf-visual-v1-shared');
  content = stripStyle(content, 'dtf-learning-owner-v1');
  content = markRoot(content, target.layout);
  content = `${styleBlock}${content}`;
  if (!content.includes(`data-dtf-layout="${target.layout}"`) || !content.includes('data-dtf-visual="v1"')) {
    throw new Error(`/${target.slug}/ visual markers were not applied`);
  }
  await writeFile(join(backupDir, `${target.slug}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
  await writeFile(join(backupDir, `${target.slug}-after.html`), `${content}\n`);
  if (apply) {
    await request(`/wp-json/wp/v2/pages/${page.id}`, {
      method: 'POST',
      body: JSON.stringify({ content, status: 'publish' })
    });
  }
  report.pages.push({ slug: target.slug, pageId: page.id, bytesBefore: before.length, bytesAfter: content.length });
}

if (apply) {
  for (const target of targets) {
    let verified = false;
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        const response = await fetch(`${siteUrl}/${target.slug === 'home' ? '' : `${target.slug}/`}?dtf_visual_v1=${Date.now()}-${attempt}`, {
          headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
          redirect: 'follow',
          signal: AbortSignal.timeout(60_000)
        });
        const html = await response.text();
        if (
          response.ok &&
          html.includes(`data-dtf-layout="${target.layout}"`) &&
          html.includes('data-dtf-visual="v1"') &&
          html.includes('dtf-visual-v1-shared') &&
          html.includes('dtf-learning-owner-v1') &&
          target.required.every(marker => html.includes(marker))
        ) {
          verified = true;
          break;
        }
      } catch {}
      await sleep(4000);
    }
    if (!verified) throw new Error(`Live /${target.slug === 'home' ? '' : `${target.slug}/`} did not expose Learning Visual V1`);
  }
  report.liveVerification = 'success';
}

await writeFile(join(backupDir, 'learning-visual-v1-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'learning-visual-v1-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
