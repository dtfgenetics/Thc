import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const local = JSON.parse(await readFile(process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json', 'utf8'));
const ui = JSON.parse(await readFile(process.env.LEARNING_HUB_COURSE1_UI_PATH || 'site/wordpress/education/learning-hub-course1-ui-v3.json', 'utf8'));
const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const must = (value, message) => { if (!value) throw new Error(message); };
const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const decodeHtmlEntities = (value = '') => String(value)
  .replaceAll('&quot;', '"')
  .replaceAll('&#039;', "'")
  .replaceAll('&#39;', "'")
  .replaceAll('&apos;', "'")
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');
const includesSemanticText = (html, text) => decodeHtmlEntities(html).includes(String(text));

must(user && pass, 'WordPress credentials are required.');
must(local?.course?.id === 'COURSE-LH-TECH1-001', 'Unexpected Course 1 package.');
must(Array.isArray(ui?.lessons) && ui.lessons.length === 18, 'Canonical UI map must contain 18 lessons.');

async function wp(path) {
  const response = await fetch(`${site}/wp-json/wp/v2/${path}`, {
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: auth, 'User-Agent': 'DTF-Course1-Canonical-Visual-Verify/1.1' }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`WordPress ${path} returned ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function findPage(slug, parent) {
  const rows = await wp(`pages?slug=${encodeURIComponent(slug)}&parent=${parent}&context=edit&per_page=100`);
  return rows[0] || null;
}

const hub = await findPage('learning-hub', 869); must(hub, 'Learning Hub page not found.');
const program = await findPage(local.program.slug, hub.id); must(program, 'Technician I page not found.');
const course = await findPage(local.course.slug, program.id); must(course, 'Course 1 page not found.');

const expectedVisualPlacements = ui.lessons.reduce((sum, lesson) => sum + (Array.isArray(lesson?.visual?.items) ? lesson.visual.items.length : 0), 0);
const expectedUniqueAssets = new Set(ui.lessons.flatMap(lesson => Array.isArray(lesson?.visual?.items) ? lesson.visual.items.map(item => item.assetId).filter(Boolean) : [])).size;

let lessonIndex = 0;
let visualPlacements = 0;
const uniqueAssets = new Set();
const verifiedLessons = [];

for (const mod of local.modules) {
  const modulePage = await findPage(mod.slug, course.id); must(modulePage, `Module ${mod.number} page missing.`);
  for (let offset = 0; offset < 3; offset += 1) {
    const lesson = ui.lessons[lessonIndex++];
    const lessonPage = await findPage(lesson.slug, modulePage.id); must(lessonPage, `${lesson.id}: lesson page missing.`);
    const html = rendered(lessonPage.content);
    const items = Array.isArray(lesson?.visual?.items) ? lesson.visual.items : [];

    if (lesson.visual?.status === 'approved') {
      must(items.length >= 1, `${lesson.id}: approved visual lesson has no canonical items.`);
      for (const item of items) {
        must(html.includes(item.src), `${lesson.id}: canonical visual ${item.assetId} source missing.`);
        must(includesSemanticText(html, item.alt), `${lesson.id}: canonical visual ${item.assetId} alt text missing.`);
        uniqueAssets.add(item.assetId);
        visualPlacements += 1;
      }
      if (items.length > 1) {
        must(html.includes(`data-canonical-supplemental-visuals="${lesson.id}"`), `${lesson.id}: supplemental canonical visual container missing.`);
        for (const item of items.slice(1)) {
          must(html.includes(`data-canonical-asset-id="${item.assetId}"`), `${lesson.id}: supplemental visual ${item.assetId} marker missing.`);
        }
      }
    } else {
      must(items.length === 0, `${lesson.id}: non-approved lesson unexpectedly carries canonical visual items.`);
    }

    verifiedLessons.push({ id: lesson.id, canonicalVisuals: items.length });
  }
}

must(verifiedLessons.length === 18, 'Expected 18 verified Course 1 lessons.');
must(visualPlacements === expectedVisualPlacements, `Expected ${expectedVisualPlacements} canonical visual placements from the generated canonical map; verified ${visualPlacements}.`);
must(uniqueAssets.size === expectedUniqueAssets, `Expected ${expectedUniqueAssets} unique canonical visual assets from the generated canonical map; verified ${uniqueAssets.size}.`);

console.log(JSON.stringify({
  result: 'success',
  verifiedAt: new Date().toISOString(),
  site,
  courseId: local.course.id,
  lessonCount: verifiedLessons.length,
  canonicalVisualPlacements: visualPlacements,
  expectedCanonicalVisualPlacements: expectedVisualPlacements,
  uniqueCanonicalAssets: uniqueAssets.size,
  expectedUniqueCanonicalAssets: expectedUniqueAssets,
  lessons: verifiedLessons
}, null, 2));
