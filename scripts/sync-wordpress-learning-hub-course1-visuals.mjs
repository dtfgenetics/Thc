import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const packagePath = process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json';
const uiPath = process.env.LEARNING_HUB_COURSE1_UI_SOURCE_PATH || 'site/wordpress/education/learning-hub-course1-ui-v3.json';
const outputArgIndex = process.argv.indexOf('--output');
const outputPath = outputArgIndex >= 0 ? process.argv[outputArgIndex + 1] : process.env.LEARNING_HUB_COURSE1_UI_PATH || 'tmp/course1-ui-canonical.json';
const validateAssets = !process.argv.includes('--skip-asset-fetch');

const must = (value, message) => {
  if (!value) throw new Error(message);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const local = JSON.parse(await readFile(packagePath, 'utf8'));
const uiSource = JSON.parse(await readFile(uiPath, 'utf8'));

must(local?.id === 'learning-hub-course1', 'Unexpected Course 1 publication package.');
must(local?.course?.id === 'COURSE-LH-TECH1-001', 'Unexpected Course 1 ID.');
must(local?.source?.repository, 'Course source repository is required.');
must(Array.isArray(uiSource?.lessons) && uiSource.lessons.length === 18, 'Course 1 UI routing map must contain 18 lessons.');

const sourceRef = local.source.ref || 'main';
const rawBase = `https://raw.githubusercontent.com/${local.source.repository}/${encodeURIComponent(sourceRef)}`;

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'DTF-Course1-Canonical-Visual-Sync/1.1' }
      });
      if (response.ok) return response.text();
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(attempt * 500);
  }
  throw lastError;
}

async function fetchJson(relativePath) {
  return JSON.parse(await fetchText(`${rawBase}/${relativePath}`));
}

function canonicalImageBlocks(lesson) {
  const blocks = Array.isArray(lesson?.content?.blocks) ? lesson.content.blocks : [];
  return blocks.filter((block) => block?.type === 'image');
}

function normalizeImage(route, image, position) {
  must(image.assetId, `${route.id}: canonical image ${position} is missing assetId.`);
  must(/^\/assets\/course1\/[a-z0-9._-]+\.(svg|png|webp)$/i.test(image.src || ''), `${route.id}: canonical image ${position} src must use /assets/course1/.`);
  must(typeof image.alt === 'string' && image.alt.trim().length >= 20, `${route.id}: canonical image ${position} alt text is missing or too short.`);
  must(typeof image.caption === 'string' && image.caption.trim().length >= 20, `${route.id}: canonical image ${position} caption is missing or too short.`);
  return {
    assetId: image.assetId,
    src: `${rawBase}/apps/web/public${image.src}`,
    alt: image.alt,
    caption: image.caption,
    title: image.title || '',
    references: Array.isArray(image.references) ? image.references : []
  };
}

const generatedLessons = [];
const uniqueAssets = new Map();
let canonicalVisualPlacements = 0;

for (let index = 0; index < uiSource.lessons.length; index += 1) {
  const route = uiSource.lessons[index];
  const expectedId = `LESSON-LH-TECH1-001-${String(index + 1).padStart(2, '0')}`;
  must(route.id === expectedId, `Unexpected lesson routing ID at position ${index + 1}: ${route.id}`);
  must(route.slug && route.module && route.lesson, `${route.id}: slug, module, and lesson position are required.`);

  const canonical = await fetchJson(`content/lessons/${route.id}.json`);
  must(canonical.id === route.id, `${route.id}: canonical lesson ID mismatch.`);
  must(canonical.status === 'published', `${route.id}: canonical lesson must be published before public visual sync.`);

  const images = canonicalImageBlocks(canonical).map((image, imageIndex) => normalizeImage(route, image, imageIndex + 1));
  canonicalVisualPlacements += images.length;
  for (const image of images) uniqueAssets.set(image.assetId, image.src);

  if (images.length === 0) {
    generatedLessons.push({
      id: route.id,
      slug: route.slug,
      module: route.module,
      lesson: route.lesson,
      visual: {
        status: 'not-required',
        purpose: route.visual?.purpose || `No lead teaching visual is required for ${canonical.title}.`,
        brief: 'Canonical lesson contains no reviewed image block; the public guided UI must not invent a decorative substitute.',
        alt: route.visual?.alt || 'No instructional image is assigned to this lesson.',
        items: []
      }
    });
    continue;
  }

  const lead = images[0];
  generatedLessons.push({
    id: route.id,
    slug: route.slug,
    module: route.module,
    lesson: route.lesson,
    visual: {
      status: 'approved',
      assetId: lead.assetId,
      purpose: route.visual?.purpose || lead.title || lead.caption,
      brief: `Canonical published learner visual set generated from ${route.id}; WordPress is not an independent visual approval authority.`,
      src: lead.src,
      alt: lead.alt,
      caption: lead.caption,
      references: lead.references,
      items: images
    }
  });
}

const approvedCount = generatedLessons.filter((lesson) => lesson.visual.status === 'approved').length;
must(approvedCount > 2, `Canonical visual sync found only ${approvedCount} approved lesson visuals; refusing to preserve the stale two-visual state.`);
must(canonicalVisualPlacements >= approvedCount, 'Canonical visual placement count is inconsistent.');

if (validateAssets) {
  for (const [assetId, url] of uniqueAssets) {
    const body = await fetchText(url);
    must(body.length > 100, `${assetId}: public learner asset is unexpectedly small or empty.`);
    if (/\.svg(?:\?|$)/i.test(url)) {
      must(/<svg\b/i.test(body), `${assetId}: expected SVG markup at public learner asset URL.`);
    }
  }
}

const generated = {
  schemaVersion: 3,
  id: uiSource.id,
  courseId: local.course.id,
  visualDataAuthority: `${local.source.repository}@${sourceRef}:content/lessons/LESSON-LH-TECH1-001-*.json`,
  designRule: uiSource.designRule,
  lessonVisualRule: 'WordPress lesson visuals are generated from every reviewed image block in each published canonical lesson. The site routing map is not an independent approval authority. Missing canonical visuals never receive decorative fallback art.',
  generatedAt: new Date().toISOString(),
  lessons: generatedLessons
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  result: 'success',
  courseId: local.course.id,
  sourceRepository: local.source.repository,
  sourceRef,
  lessonCount: generatedLessons.length,
  approvedVisualLessons: approvedCount,
  lessonsWithoutCanonicalVisual: generatedLessons.length - approvedCount,
  canonicalVisualPlacements,
  uniquePublicAssets: uniqueAssets.size,
  outputPath
}, null, 2));
