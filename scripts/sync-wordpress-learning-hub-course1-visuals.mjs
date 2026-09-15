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
        headers: { 'User-Agent': 'DTF-Course1-Canonical-Visual-Sync/1.0' }
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

function findCanonicalImageBlock(lesson) {
  const blocks = Array.isArray(lesson?.content?.blocks) ? lesson.content.blocks : [];
  const imageBlocks = blocks.filter((block) => block?.type === 'image');
  must(imageBlocks.length <= 1, `${lesson.id}: guided Course 1 UI supports one canonical lead teaching visual per lesson; found ${imageBlocks.length}.`);
  return imageBlocks[0] || null;
}

const generatedLessons = [];
const uniqueAssets = new Map();

for (let index = 0; index < uiSource.lessons.length; index += 1) {
  const route = uiSource.lessons[index];
  const expectedId = `LESSON-LH-TECH1-001-${String(index + 1).padStart(2, '0')}`;
  must(route.id === expectedId, `Unexpected lesson routing ID at position ${index + 1}: ${route.id}`);
  must(route.slug && route.module && route.lesson, `${route.id}: slug, module, and lesson position are required.`);

  const canonical = await fetchJson(`content/lessons/${route.id}.json`);
  must(canonical.id === route.id, `${route.id}: canonical lesson ID mismatch.`);
  must(canonical.status === 'published', `${route.id}: canonical lesson must be published before public visual sync.`);

  const image = findCanonicalImageBlock(canonical);
  if (!image) {
    generatedLessons.push({
      id: route.id,
      slug: route.slug,
      module: route.module,
      lesson: route.lesson,
      visual: {
        status: 'not-required',
        purpose: route.visual?.purpose || `No lead teaching visual is required for ${canonical.title}.`,
        brief: 'Canonical lesson contains no reviewed image block; the public guided UI must not invent a decorative substitute.',
        alt: route.visual?.alt || 'No instructional image is assigned to this lesson.'
      }
    });
    continue;
  }

  must(image.assetId, `${route.id}: canonical image block is missing assetId.`);
  must(/^\/assets\/course1\/[a-z0-9._-]+\.(svg|png|webp)$/i.test(image.src || ''), `${route.id}: canonical image src must use /assets/course1/.`);
  must(typeof image.alt === 'string' && image.alt.trim().length >= 20, `${route.id}: canonical image alt text is missing or too short.`);
  must(typeof image.caption === 'string' && image.caption.trim().length >= 20, `${route.id}: canonical image caption is missing or too short.`);

  const publicSrc = `${rawBase}/apps/web/public${image.src}`;
  uniqueAssets.set(image.assetId, publicSrc);

  generatedLessons.push({
    id: route.id,
    slug: route.slug,
    module: route.module,
    lesson: route.lesson,
    visual: {
      status: 'approved',
      assetId: image.assetId,
      purpose: route.visual?.purpose || image.title || image.caption,
      brief: `Canonical published learner visual ${image.assetId}; generated from ${route.id} rather than maintained as a separate WordPress approval record.`,
      src: publicSrc,
      alt: image.alt,
      caption: image.caption,
      references: Array.isArray(image.references) ? image.references : []
    }
  });
}

const approvedCount = generatedLessons.filter((lesson) => lesson.visual.status === 'approved').length;
must(approvedCount > 2, `Canonical visual sync found only ${approvedCount} approved lesson visuals; refusing to preserve the stale two-visual state.`);

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
  schemaVersion: 2,
  id: uiSource.id,
  courseId: local.course.id,
  visualDataAuthority: `${local.source.repository}@${sourceRef}:content/lessons/LESSON-LH-TECH1-001-*.json`,
  designRule: uiSource.designRule,
  lessonVisualRule: 'WordPress lesson visuals are generated from each published canonical lesson image block. The site routing map is not an independent approval authority. Missing canonical visuals never receive decorative fallback art.',
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
  lessonsWithoutLeadVisual: generatedLessons.length - approvedCount,
  uniquePublicAssets: uniqueAssets.size,
  outputPath
}, null, 2));
