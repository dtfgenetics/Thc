import { readFile } from 'node:fs/promises';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_LEARNING_HUB_COURSE1 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const packagePath = process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json';
const uiPath = process.env.LEARNING_HUB_COURSE1_UI_PATH || 'site/wordpress/education/learning-hub-course1-ui-v3.json';
const local = JSON.parse(await readFile(packagePath, 'utf8'));
const ui = JSON.parse(await readFile(uiPath, 'utf8'));
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const must = (value, message) => { if (!value) throw new Error(message); };
const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');

must(local?.course?.id === 'COURSE-LH-TECH1-001', 'Unexpected Course 1 package.');
must(Array.isArray(ui?.lessons) && ui.lessons.length === 18, 'Canonical Course 1 UI map must contain 18 lessons.');

let supplementalAssetCount = 0;
for (const lesson of ui.lessons) {
  const items = Array.isArray(lesson?.visual?.items) ? lesson.visual.items : [];
  if (lesson.visual?.status === 'approved') {
    must(items.length >= 1, `${lesson.id}: approved canonical visual lesson must contain at least one item.`);
    for (const item of items) {
      must(item.assetId && /^https:\/\//.test(item.src || '') && item.alt && item.caption, `${lesson.id}: canonical visual item is incomplete.`);
    }
    supplementalAssetCount += Math.max(0, items.length - 1);
  }
}

if (validateOnly) {
  console.log(JSON.stringify({ result: 'success', courseId: local.course.id, lessonCount: ui.lessons.length, supplementalAssetCount }, null, 2));
  process.exit(0);
}

must(apply, 'APPLY_LEARNING_HUB_COURSE1=true is required.');
must(user && pass, 'WordPress credentials are required.');

async function wp(path, options = {}) {
  const response = await fetch(`${site}/wp-json/wp/v2/${path}`, {
    ...options,
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      'User-Agent': 'DTF-Course1-Supplemental-Visuals/1.0',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`WordPress ${path} returned ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function findPage(slug, parent) {
  const rows = await wp(`pages?slug=${encodeURIComponent(slug)}&parent=${parent}&context=edit&per_page=100`);
  return rows[0] || null;
}

function supplementalBlock(lesson) {
  const items = Array.isArray(lesson?.visual?.items) ? lesson.visual.items.slice(1) : [];
  if (!items.length) return '';
  const figures = items.map((item) => `<figure class="lhv3-visual lhv3-visual-supplemental" data-canonical-asset-id="${esc(item.assetId)}"><img src="${esc(item.src)}" alt="${esc(item.alt)}" loading="lazy" decoding="async"><figcaption>${esc(item.caption)}</figcaption></figure>`).join('');
  return `<div class="lhv3-supplemental-visuals" data-canonical-supplemental-visuals="${esc(lesson.id)}">${figures}</div>`;
}

function replaceSupplementals(html, lesson) {
  const cleaned = String(html).replace(/<div class="lhv3-supplemental-visuals" data-canonical-supplemental-visuals="[^"]+">[\s\S]*?<\/div>/g, '');
  const block = supplementalBlock(lesson);
  if (!block) return cleaned;
  const firstFigureEnd = cleaned.indexOf('</figure>');
  if (firstFigureEnd >= 0) {
    const insertAt = firstFigureEnd + '</figure>'.length;
    return `${cleaned.slice(0, insertAt)}${block}${cleaned.slice(insertAt)}`;
  }
  const articleMarker = '<article class="lhv3-content">';
  const articleIndex = cleaned.indexOf(articleMarker);
  must(articleIndex >= 0, `${lesson.id}: could not locate lesson content insertion point.`);
  return `${cleaned.slice(0, articleIndex)}${block}${cleaned.slice(articleIndex)}`;
}

const hub = await findPage('learning-hub', 869); must(hub, 'Learning Hub page not found.');
const program = await findPage(local.program.slug, hub.id); must(program, 'Technician I page not found.');
const course = await findPage(local.course.slug, program.id); must(course, 'Course 1 page not found.');

let updatedLessons = 0;
let insertedSupplementalAssets = 0;
let lessonIndex = 0;
for (const mod of local.modules) {
  const modulePage = await findPage(mod.slug, course.id); must(modulePage, `Module ${mod.number} page missing.`);
  for (let offset = 0; offset < 3; offset += 1) {
    const lesson = ui.lessons[lessonIndex++];
    const lessonPage = await findPage(lesson.slug, modulePage.id); must(lessonPage, `${lesson.id}: lesson page missing.`);
    const before = rendered(lessonPage.content);
    const after = replaceSupplementals(before, lesson);
    if (after !== before) {
      await wp(`pages/${lessonPage.id}`, { method: 'POST', body: JSON.stringify({ content: after, status: 'publish' }) });
      updatedLessons += 1;
    }
    insertedSupplementalAssets += Math.max(0, (lesson.visual?.items?.length || 0) - 1);
  }
}

console.log(JSON.stringify({ result: 'success', courseId: local.course.id, updatedLessons, insertedSupplementalAssets }, null, 2));
