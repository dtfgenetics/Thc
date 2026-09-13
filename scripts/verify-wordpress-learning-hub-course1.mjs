import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const packagePath = process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json';
const local = JSON.parse(await readFile(packagePath, 'utf8'));
const sourceRepo = local.source?.repository;
const sourceRef = local.source?.ref;
const releaseManifestPath = local.source?.releaseManifest || 'content/public-releases/PUBLIC-RELEASE-LH-TECH1-001.json';
const rawBase = `https://raw.githubusercontent.com/${sourceRepo}/${encodeURIComponent(sourceRef || '')}`;
const must = (value, message) => { if (!value) throw new Error(message); };
const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const forbidden = /\b(tbd|todo|lorem ipsum|not approved for public release|draft production package|preview only|pilot\/calibration only until approved)\b/i;
const htmlEscape = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

must(user && pass, 'WordPress application credentials are required for readback verification.');
must(local?.course?.id === 'COURSE-LH-TECH1-001', 'Unexpected Course 1 package.');
must(Array.isArray(local.modules) && local.modules.length === 6, 'Expected six Course 1 modules.');
must(Array.isArray(local.learnerDocuments) && local.learnerDocuments.length === 3, 'Expected three learner documents.');
must(sourceRepo === 'dtfgenetics/Thc-learning-courses-', 'Course 1 must verify against the canonical THC learning-courses repository.');
must(/^[0-9a-f]{40}$/i.test(sourceRef || ''), 'Course 1 verification requires an exact pinned Academy commit.');

async function fetchSourceJson(rel) {
  let last;
  const url = `${rawBase}/${rel}`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'DTF-Learning-Hub-Course1-Source-Verify/1.0' }
      });
      if (response.ok) return JSON.parse(await response.text());
      last = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      last = error;
    }
    if (attempt < 6) await sleep(attempt * 800);
  }
  throw last;
}

const release = await fetchSourceJson(releaseManifestPath);
must(release?.id === 'PUBLIC-RELEASE-LH-TECH1-001', 'Unexpected canonical Course 1 release manifest.');
must(release.courseId === local.course.id && release.publicationState === 'published', 'Pinned Course 1 release is not published for this course.');
const expectedAssessments = [...local.modules.map((module) => module.assessment), local.finalAssessment];
must(JSON.stringify(release.publicScope?.assessments) === JSON.stringify(expectedAssessments), 'Pinned canonical assessment scope differs from the site package.');

const assessmentCounts = new Map();
let canonicalPublicItems = 0;
for (const id of expectedAssessments) {
  const assessment = await fetchSourceJson(`content/assessments/${id}.json`);
  must(['formative', 'summative'].includes(assessment.purpose), `${id}: credential-purpose assessment is not allowed in the public site verifier.`);
  const count = Array.isArray(assessment.items) ? assessment.items.length : 0;
  must(count > 0, `${id}: canonical assessment contains no public items.`);
  assessmentCounts.set(id, count);
  canonicalPublicItems += count;
}
must(canonicalPublicItems === Number(release.publicScope.publicCourseItems), `Pinned release declares ${release.publicScope.publicCourseItems} public items but its assessments contain ${canonicalPublicItems}.`);

async function wp(path) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const response = await fetch(`${site}${path}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTF-Learning-Hub-Course1-Readback/4.1'
        }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 8) {
        await sleep(attempt * 1200);
        continue;
      }
      if (!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 8) await sleep(attempt * 1200);
    }
  }
  throw last;
}

async function pageBySlug(slug, parent = null) {
  const rows = await wp(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`);
  must(Array.isArray(rows), `WordPress did not return an array for '${slug}'.`);
  const matches = parent === null ? rows : rows.filter((page) => Number(page.parent) === Number(parent));
  must(matches.length === 1, `Expected exactly one '${slug}' page${parent === null ? '' : ` under parent ${parent}`}; found ${matches.length}.`);
  return matches[0];
}

function verifyPage(page, { label, minLength = 120, required = [], questionCount = null }) {
  must(page.status === 'publish', `${label}: expected status publish, got ${page.status}.`);
  const content = rendered(page.content);
  must(content.length >= minLength, `${label}: published content is unexpectedly short (${content.length} chars).`);
  must(!forbidden.test(content), `${label}: unfinished learner-facing wording found after publication.`);
  for (const needle of required) {
    const found = content.includes(needle) || content.includes(htmlEscape(needle));
    must(found, `${label}: required published marker/text missing: ${needle}`);
  }
  if (questionCount !== null) {
    const count = (content.match(/class=(?:"|')lh1-test(?:"|')/g) || []).length;
    must(count === questionCount, `${label}: expected ${questionCount} rendered course-test items, found ${count}.`);
  }
  return content;
}

// /learn/ has an independently managed presentation layer. Verify the durable
// Learning Hub hierarchy and Course 1 descendants without requiring an old
// /learn/ visual marker.
const learn = await pageBySlug('learn');
verifyPage(learn, { label: '/learn/', minLength: 500 });

const hub = await pageBySlug('learning-hub', learn.id);
verifyPage(hub, { label: '/learn/learning-hub/', required: ['THC Learning Hub', local.program.route] });

const program = await pageBySlug(local.program.slug, hub.id);
verifyPage(program, { label: local.program.route, required: [local.program.title, local.course.route] });

const course = await pageBySlug(local.course.slug, program.id);
const courseContent = verifyPage(course, {
  label: local.course.route,
  minLength: 1200,
  required: [local.course.title, 'How to use this course', 'Course map', '18 lessons', 'Integrated practical', String(canonicalPublicItems)]
});
must(courseContent.includes('dtf-learning-hub-course1-ui-v3'), 'Course index is missing the guided-learning UI marker.');
must(courseContent.includes('dtf-learning-hub-course1-layout-v4'), 'Course index is missing the responsive Course 1 layout marker.');
must(!/secure certification examination[\s\S]{0,80}(answer|key|correct)/i.test(courseContent), 'Course index appears to expose secure certification answer material.');

const verified = [
  { type: 'hub', id: hub.id, slug: 'learning-hub' },
  { type: 'program', id: program.id, slug: local.program.slug },
  { type: 'course', id: course.id, slug: local.course.slug }
];

for (const module of local.modules) {
  const page = await pageBySlug(module.slug, course.id);
  verifyPage(page, {
    label: `Module ${module.number}: ${module.title}`,
    minLength: 1200,
    required: [module.title, `Module ${module.number} of 6`, 'Lessons in this module', `test-module-${module.number}`]
  });
  const content = rendered(page.content);
  must(content.includes('dtf-learning-hub-course1-ui-v3'), `Module ${module.number}: guided-learning UI marker missing.`);
  must(content.includes('dtf-learning-hub-course1-layout-v4'), `Module ${module.number}: responsive layout marker missing.`);
  verified.push({ type: 'module', number: module.number, id: page.id, slug: module.slug });
}

for (const doc of local.learnerDocuments) {
  const page = await pageBySlug(doc.slug, course.id);
  verifyPage(page, {
    label: doc.title,
    minLength: 1000,
    required: [doc.title, 'dtf-learning-hub-course1-layout-v4']
  });
  verified.push({ type: 'document', id: page.id, slug: doc.slug });
}

let publicQuestionCount = 0;
for (const module of local.modules) {
  const slug = `test-module-${module.number}`;
  const expectedCount = assessmentCounts.get(module.assessment);
  const page = await pageBySlug(slug, course.id);
  verifyPage(page, {
    label: `Module ${module.number} learning test`,
    minLength: 1800,
    required: ['Course mastery target:', 'not the passing standard for the separate secure certification examination', 'dtf-learning-hub-course1-layout-v4'],
    questionCount: expectedCount
  });
  publicQuestionCount += expectedCount;
  verified.push({ type: 'module-test', number: module.number, id: page.id, slug });
}

const finalExpectedCount = assessmentCounts.get(local.finalAssessment);
const final = await pageBySlug('final-course-test', course.id);
verifyPage(final, {
  label: 'Course 1 final course test',
  minLength: 3500,
  required: ['Course mastery target:', 'not the passing standard for the separate secure certification examination', 'dtf-learning-hub-course1-layout-v4'],
  questionCount: finalExpectedCount
});
publicQuestionCount += finalExpectedCount;
verified.push({ type: 'final-test', id: final.id, slug: 'final-course-test' });

must(publicQuestionCount === canonicalPublicItems, `Expected ${canonicalPublicItems} public course-learning items from pinned Academy source, verified ${publicQuestionCount}.`);
must(verified.length === 19, `Expected 19 managed base Course 1 pages, verified ${verified.length}.`);

const idSet = new Set(verified.map((page) => Number(page.id)));
must(idSet.size === 19, 'Managed Course 1 base page IDs are not unique.');

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  site,
  courseId: local.course.id,
  sourceRepository: sourceRepo,
  sourceRef,
  releaseManifest: release.id,
  learnPageId: learn.id,
  managedBasePages: verified.length,
  publicCourseItems: publicQuestionCount,
  assessmentItemCounts: Object.fromEntries(assessmentCounts),
  guidedUi: true,
  responsiveLayout: 'v4',
  pageIds: verified.map(({ type, number, id, slug }) => ({ type, ...(number ? { number } : {}), id, slug })),
  result: 'success'
}, null, 2));
