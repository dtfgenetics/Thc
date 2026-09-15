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
        headers: { 'User-Agent': 'DTF-Course1-Canonical-Visual-Sync/1.3' }
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

const conceptCoverage = await fetchJson('visuals/COURSE1-VISUAL-CONCEPT-COVERAGE.json');
const assetRegistry = await fetchJson('visuals/ASSET-REGISTRY.json');
must(conceptCoverage?.courseId === local.course.id, 'Course 1 visual concept coverage belongs to an unexpected course.');
must(conceptCoverage?.policy?.requiredPrimaryConceptCount === 18, 'Course 1 visual concept coverage must define 18 primary concepts.');
must(Array.isArray(conceptCoverage?.concepts) && conceptCoverage.concepts.length === 18, 'Course 1 visual concept coverage must contain exactly 18 concepts.');
must(assetRegistry?.courseId === local.course.id, 'Course 1 visual asset registry belongs to an unexpected course.');
must(Array.isArray(assetRegistry?.assets), 'Course 1 visual asset registry is missing assets.');
const registryById = new Map(assetRegistry.assets.map((asset) => [asset.id, asset]));

function canonicalImageBlocks(lesson) {
  const blocks = Array.isArray(lesson?.content?.blocks) ? lesson.content.blocks : [];
  return blocks.filter((block) => block?.type === 'image');
}

function normalizeLessonImage(route, image, position) {
  must(image.assetId, `${route.id}: canonical lesson image ${position} is missing assetId.`);
  must(/^\/assets\/course1\/[a-z0-9._-]+\.(svg|png|webp)$/i.test(image.src || ''), `${route.id}: canonical lesson image ${position} src must use /assets/course1/.`);
  must(typeof image.alt === 'string' && image.alt.trim().length >= 20, `${route.id}: canonical lesson image ${position} alt text is missing or too short.`);
  must(typeof image.caption === 'string' && image.caption.trim().length >= 20, `${route.id}: canonical lesson image ${position} caption is missing or too short.`);
  return {
    assetId: image.assetId,
    src: `${rawBase}/apps/web/public${image.src}`,
    alt: image.alt,
    caption: image.caption,
    title: image.title || '',
    references: Array.isArray(image.references) ? image.references : [],
    canonicalSource: 'lesson-image-block'
  };
}

function coverageImagesForLesson(route) {
  const matches = conceptCoverage.concepts.filter((concept) =>
    Array.isArray(concept.lessonIds) &&
    concept.lessonIds.includes(route.id) &&
    (concept.status === 'deployed' || concept.status === 'deployed-combined')
  );
  const byAsset = new Map();
  for (const concept of matches) {
    must(concept.registryAssetId, `${concept.conceptId}: deployed concept is missing registryAssetId.`);
    must(/^\/assets\/course1\/[a-z0-9._-]+\.(svg|png|webp)$/i.test(concept.publicAsset || ''), `${concept.conceptId}: deployed concept has an invalid publicAsset.`);
    const registryAsset = registryById.get(concept.registryAssetId);
    must(registryAsset, `${concept.conceptId}: registry asset ${concept.registryAssetId} does not exist.`);
    must(registryAsset.status === 'produced', `${concept.conceptId}: registry asset ${concept.registryAssetId} is not produced.`);
    must(registryAsset.learnerPath === concept.publicAsset, `${concept.conceptId}: concept publicAsset and registry learnerPath disagree.`);
    if (!byAsset.has(concept.registryAssetId)) {
      const purpose = String(registryAsset.purpose || concept.title || '').trim();
      const title = String(concept.title || registryAsset.title || '').trim();
      const coverageNote = String(concept.coverageNote || '').trim();
      must(purpose.length >= 20, `${concept.conceptId}: canonical registry purpose is missing or too short.`);
      must(title.length >= 5, `${concept.conceptId}: canonical concept title is missing or too short.`);
      byAsset.set(concept.registryAssetId, {
        assetId: concept.registryAssetId,
        src: `${rawBase}/apps/web/public${concept.publicAsset}`,
        alt: `${title}. ${purpose}`,
        caption: coverageNote || purpose,
        title,
        references: [],
        canonicalSource: 'visual-concept-coverage'
      });
    }
  }
  return [...byAsset.values()];
}

function controlledProductionBaselineForLesson(route) {
  const lessonOrdinal = Number(route.id.match(/-(\d{2})$/)?.[1] || 0);
  if (lessonOrdinal < 13 || lessonOrdinal > 18) return [];

  const candidates = coverageImagesForLesson(route).filter((image) => {
    const registryAsset = registryById.get(image.assetId);
    return Array.isArray(registryAsset?.primaryLessons) &&
      registryAsset.primaryLessons.length === 1 &&
      registryAsset.primaryLessons[0] === route.id;
  });

  must(candidates.length === 1, `${route.id}: expected one dedicated controlled production baseline for Course 1 lessons 13-18, found ${candidates.length}.`);
  return candidates.map((image) => ({ ...image, canonicalSource: 'controlled-production-visual-coverage' }));
}

const generatedLessons = [];
const uniqueAssets = new Map();
let canonicalVisualPlacements = 0;
let coverageFallbackPlacements = 0;
let controlledUpgradePlacements = 0;

for (let index = 0; index < uiSource.lessons.length; index += 1) {
  const route = uiSource.lessons[index];
  const expectedId = `LESSON-LH-TECH1-001-${String(index + 1).padStart(2, '0')}`;
  must(route.id === expectedId, `Unexpected lesson routing ID at position ${index + 1}: ${route.id}`);
  must(route.slug && route.module && route.lesson, `${route.id}: slug, module, and lesson position are required.`);

  const canonical = await fetchJson(`content/lessons/${route.id}.json`);
  must(canonical.id === route.id, `${route.id}: canonical lesson ID mismatch.`);
  must(canonical.status === 'published', `${route.id}: canonical lesson must be published before public visual sync.`);

  const controlledBaseline = controlledProductionBaselineForLesson(route);
  let images = controlledBaseline;
  if (controlledBaseline.length > 0) {
    controlledUpgradePlacements += controlledBaseline.length;
  } else {
    images = canonicalImageBlocks(canonical).map((image, imageIndex) => normalizeLessonImage(route, image, imageIndex + 1));
  }
  if (images.length === 0) {
    images = coverageImagesForLesson(route);
    coverageFallbackPlacements += images.length;
  }
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
        purpose: route.visual?.purpose || `No canonical teaching visual is required for ${canonical.title}.`,
        brief: 'Neither the canonical lesson nor the canonical visual concept coverage assigns a reviewed learner visual; the public guided UI must not invent a decorative substitute.',
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
      purpose: lead.title || lead.caption,
      brief: `Canonical published learner visual set generated from curriculum sources for ${route.id}; WordPress is not an independent visual approval authority.`,
      src: lead.src,
      alt: lead.alt,
      caption: lead.caption,
      references: lead.references,
      items: images
    }
  });
}

const approvedCount = generatedLessons.filter((lesson) => lesson.visual.status === 'approved').length;
const lessonsWithoutCanonicalVisualIds = generatedLessons.filter((lesson) => lesson.visual.status !== 'approved').map((lesson) => lesson.id);
must(approvedCount === 18, `Course 1 canonical visual coverage is incomplete: ${approvedCount}/18 lessons have reviewed visuals. Missing: ${lessonsWithoutCanonicalVisualIds.join(', ') || 'unknown'}.`);
must(lessonsWithoutCanonicalVisualIds.length === 0, 'Course 1 canonical visual mapping must resolve every lesson before public publication.');
must(canonicalVisualPlacements >= approvedCount, 'Canonical visual placement count is inconsistent.');
must(controlledUpgradePlacements === 6, `Course 1 controlled production baseline coverage must include exactly six lesson upgrades, found ${controlledUpgradePlacements}.`);

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
  schemaVersion: 5,
  id: uiSource.id,
  courseId: local.course.id,
  visualDataAuthority: [
    `${local.source.repository}@${sourceRef}:content/lessons/LESSON-LH-TECH1-001-*.json`,
    `${local.source.repository}@${sourceRef}:visuals/COURSE1-VISUAL-CONCEPT-COVERAGE.json`,
    `${local.source.repository}@${sourceRef}:visuals/ASSET-REGISTRY.json`
  ],
  designRule: uiSource.designRule,
  lessonVisualRule: 'WordPress lesson visuals normally use reviewed image blocks in published canonical lessons. For Course 1 lessons 13 through 18, the dedicated produced baseline mapped by canonical visual concept coverage and the asset registry supersedes the older generic lesson image block. When no lesson image or controlled baseline exists, deployed concept coverage may supply the teaching visual. The site routing map is never an independent visual approval authority.',
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
  lessonsWithoutCanonicalVisual: lessonsWithoutCanonicalVisualIds.length,
  lessonsWithoutCanonicalVisualIds,
  canonicalVisualPlacements,
  controlledUpgradePlacements,
  coverageFallbackPlacements,
  uniquePublicAssets: uniqueAssets.size,
  outputPath
}, null, 2));