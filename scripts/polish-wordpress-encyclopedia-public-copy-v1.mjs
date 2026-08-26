import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_ENCYCLOPEDIA_PUBLIC_COPY_V1 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-encyclopedia-public-copy-v1';

if (!user || !pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth = Buffer.from(`${user}:${pass}`).toString('base64');
const headers = {
  Authorization: `Basic ${auth}`,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Encyclopedia-Public-Copy-V1/1.0',
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(endpoint, { method = 'GET', body } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 7; attempt++) {
    try {
      const response = await fetch(`${site}/wp-json/wp/v2${endpoint}`, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          ...headers,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      let parsed = text;
      try { parsed = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 7) {
        await sleep(attempt * 1500);
        continue;
      }
      if (!response.ok) {
        throw new Error(`${method} ${endpoint} failed (${response.status}): ${typeof parsed === 'string' ? parsed.slice(0, 600) : JSON.stringify(parsed).slice(0, 600)}`);
      }
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt < 7) await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

async function findPage(slug, parent = null) {
  const rows = await request(`/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`);
  return rows.find((page) => parent === null || Number(page.parent) === Number(parent)) || null;
}

async function childPages(parent) {
  const pages = [];
  for (let page = 1; ; page++) {
    const rows = await request(`/pages?parent=${parent}&context=edit&per_page=100&page=${page}&orderby=slug&order=asc`);
    pages.push(...rows);
    if (rows.length < 100) break;
  }
  return pages;
}

const replacements = [
  [
    'Controlled education content · review status tracked separately',
    'Educational reference · evidence, sources, and limits shown below',
  ],
  [
    '<strong>Publication control</strong>',
    '<strong>About this reference</strong>',
  ],
  [
    'This page is generated from the source-controlled THC encyclopedia lesson record. Website publication does not convert claim-level evidence status into independent scientific, editorial, visual, accessibility, or rights approval.',
    'This lesson summarizes the source material and its evidence limits for education. Use direct measurement, controlled comparison, and the cited sources when conditions differ or a decision carries meaningful risk.',
  ],
  [
    'See the controlled lesson evidence and context.',
    'See the lesson evidence and context.',
  ],
  [
    'The controlled 420-ID encyclopedia is publishing in verified blocks. Search visitor-verified literature pages here, then use topic infographics as supporting visual material.',
    'The THC plant-science encyclopedia is a growing reference library. Search published lessons here, then use topic infographics and source notes to deepen the subject.',
  ],
  [
    '<strong>Controlled rollout</strong>',
    '<strong>Library scope</strong>',
  ],
  [
    'The permanent architecture contains 420 encyclopedia IDs. Only website pages that have passed the production publication lane are listed here. Independent approval remains a separate project-control field.',
    'Published lessons are organized by topic and supported by source notes, evidence limits, and visual references as those materials become available.',
  ],
];

const forbiddenPublicPhrases = [
  'Controlled education content',
  'Publication control',
  'review status tracked separately',
  'Independent approval remains a separate project-control field',
];

function polish(content = '') {
  let next = String(content);
  for (const [from, to] of replacements) next = next.split(from).join(to);
  return next;
}

function linkRelatedReferences(content = '') {
  return String(content).replace(
    /(<h2>Related encyclopedia topics<\/h2>)([\s\S]*?)(<h2>Source notes<\/h2>)/g,
    (section, heading, middle, sourceHeading) => {
      const linked = middle.replace(/<li>([\s\S]*?)<\/li>/g, (item, inner) => {
        if (/<a\b/i.test(inner)) return item;
        const nextInner = inner.replace(/\bTHC-ENC-(\d{3})\b/g, (id, number) =>
          `<a href=\"/learn/encyclopedia/thc-enc-${number}/\">${id}</a>`
        );
        return `<li>${nextInner}</li>`;
      });
      return `${heading}${linked}${sourceHeading}`;
    },
  );
}

const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = path.join(backupRoot, `encyclopedia-public-copy-v1-${stamp}`);
await mkdir(backupDir, { recursive: true });

const learn = await findPage('learn');
if (!learn) throw new Error('Canonical /learn/ WordPress page not found.');
const encyclopedia = await findPage('encyclopedia', learn.id);
if (!encyclopedia) throw new Error('Canonical /learn/encyclopedia/ WordPress page not found.');

const children = (await childPages(encyclopedia.id)).filter((page) => /^thc-enc-\d{3}$/.test(page.slug));
if (children.length < 1) throw new Error('No published THC-ENC lesson pages were found.');

const targets = [encyclopedia, ...children];
const backups = [];
const updated = [];
const unchanged = [];

for (const page of targets) {
  const raw = page?.content?.raw || page?.content?.rendered || '';
  const nextContent = linkRelatedReferences(polish(raw));
  const nextExcerpt = polish(page?.excerpt?.raw || '');
  const changed = nextContent !== raw || nextExcerpt !== (page?.excerpt?.raw || '');

  if (!changed) {
    unchanged.push({ id: page.id, slug: page.slug });
    continue;
  }

  backups.push({
    id: page.id,
    slug: page.slug,
    title: page?.title?.raw || page?.title?.rendered || '',
    content: raw,
    excerpt: page?.excerpt?.raw || '',
  });

  if (apply) {
    await request(`/pages/${page.id}`, {
      method: 'POST',
      body: {
        content: nextContent,
        excerpt: nextExcerpt,
        status: 'publish',
      },
    });
  }

  updated.push({ id: page.id, slug: page.slug });
}

await writeFile(path.join(backupDir, 'before.json'), `${JSON.stringify(backups, null, 2)}\n`);

if (apply) {
  for (const page of updated) {
    const refreshed = await request(`/pages/${page.id}?context=edit`);
    const raw = refreshed?.content?.raw || refreshed?.content?.rendered || '';
    for (const phrase of forbiddenPublicPhrases) {
      if (raw.includes(phrase)) throw new Error(`${page.slug} still contains learner-facing internal control phrase: ${phrase}`);
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  apply,
  encyclopediaPageId: encyclopedia.id,
  lessonCount: children.length,
  updatedCount: updated.length,
  updatedSlugs: updated.map((page) => page.slug),
  unchangedCount: unchanged.length,
  backupDir,
};

await writeFile(path.join(backupDir, 'encyclopedia-public-copy-v1-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(backupRoot, 'latest-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
