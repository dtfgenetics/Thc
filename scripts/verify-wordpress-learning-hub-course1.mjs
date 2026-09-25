import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const packagePath = process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json';
const local = JSON.parse(await readFile(packagePath, 'utf8'));
const sourceRepo = local.source.repository;
const configuredSourceRef = local.source.ref || 'main';
const sourceRef = String(process.env.THC_LEARNING_SOURCE_SHA || configuredSourceRef).trim();
if (process.env.THC_LEARNING_SOURCE_SHA && !/^[0-9a-f]{40}$/i.test(sourceRef)) throw new Error('THC_LEARNING_SOURCE_SHA must be a full 40-character Git commit SHA.');
const rawBase = `https://raw.githubusercontent.com/${sourceRepo}/${encodeURIComponent(sourceRef)}`;
const releaseManifestPath = 'content/public-releases/PUBLIC-RELEASE-LH-TECH1-001.json';
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

async function fetchCanonicalText(relativePath) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const nonce = `${Date.now()}-${attempt}-${Math.random().toString(16).slice(2)}`;
    try {
      const response = await fetch(`${rawBase}/${relativePath}?verify=${nonce}`, {
        signal: AbortSignal.timeout(30000),
        headers: {
          Accept: 'application/json,text/plain,*/*',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTF-Learning-Hub-Course1-Canonical-Readback/1.0'
        }
      });
      if (response.ok) return response.text();
      last = new Error(`Canonical GET ${relativePath} failed (${response.status}).`);
    } catch (error) {
      last = error;
    }
    if (attempt < 6) await sleep(attempt * 800);
  }
  throw last;
}

async function fetchCanonicalJson(relativePath) {
  return JSON.parse(await fetchCanonicalText(relativePath));
}

async function loadCanonicalAssessmentContract() {
  const release = await fetchCanonicalJson(releaseManifestPath);
  must(release?.id === 'PUBLIC-RELEASE-LH-TECH1-001', 'Unexpected Course 1 public-release manifest.');
  must(release.courseId === local.course.id, 'Public-release manifest course ID mismatch.');
  must(release.publicationState === 'published', 'Course 1 public-release manifest is not published.');
  must(Number.isInteger(release.publicScope?.publicCourseItems) && release.publicScope.publicCourseItems > 0, 'Public release must declare a positive publicCourseItems count.');

  const expectedAssessmentIds = [...local.modules.map((module) => module.assessment), local.finalAssessment];
  must(JSON.stringify(release.publicScope?.assessments) === JSON.stringify(expectedAssessmentIds), 'Site assessment scope differs from canonical public-release manifest.');

  const counts = new Map();
  let total = 0;
  for (const assessmentId of expectedAssessmentIds) {
    const assessment = await fetchCanonicalJson(`content/assessments/${assessmentId}.json`);
    must(assessment?.id === assessmentId, `Canonical assessment identity mismatch for ${assessmentId}.`);
    must(['formative', 'summative'].includes(assessment.purpose), `${assessmentId} is not a public learning assessment.`);
    must(Array.isArray(assessment.items) && assessment.items.length > 0, `${assessmentId} has no public learning items.`);
    must(new Set(assessment.items).size === assessment.items.length, `${assessmentId} contains duplicate item references.`);
    counts.set(assessmentId, assessment.items.length);
    total += assessment.items.length;
  }

  must(total === release.publicScope.publicCourseItems, `Canonical assessment total ${total} does not match release manifest ${release.publicScope.publicCourseItems}.`);
  return { release, counts, total };
}

const canonical = await loadCanonicalAssessmentContract();

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
          'User-Agent': 'DTF-Learning-Hub-Course1-Readback/5.0'
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
  required: [local.course.title, 'How to use this course', 'Course map', '18 lessons', 'Integrated practical']
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
  const expectedCount = canonical.counts.get(module.assessment);
  must(Number.isInteger(expectedCount) && expectedCount > 0, `Missing canonical count for ${module.assessment}.`);
  const page = await pageBySlug(slug, course.id);
  verifyPage(page, {
    label: `Module ${module.number} learning test`,
    minLength: 1800,
    required: ['Course mastery target:', 'not the passing standard for the separate secure certification examination', 'dtf-learning-hub-course1-layout-v4'],
    questionCount: expectedCount
  });
  publicQuestionCount += expectedCount;
  verified.push({ type: 'module-test', number: module.number, id: page.id, slug, questionCount: expectedCount });
}

const expectedFinalCount = canonical.counts.get(local.finalAssessment);
must(Number.isInteger(expectedFinalCount) && expectedFinalCount > 0, `Missing canonical count for ${local.finalAssessment}.`);
const final = await pageBySlug('final-course-test', course.id);
const finalContent = verifyPage(final, {
  label: 'Course 1 final course test',
  minLength: 700,
  required: ['Graded assessment:', 'answers and rationales are not exposed', '60-minute timed attempt', 'Open the Academy assessment portal', 'dtf-learning-hub-course1-layout-v4'],
  questionCount: 0
});
must(!finalContent.includes('Check answer and rationale'), 'Course 1 summative final must not expose self-check answer panels.');
must(!/<strong>Answer:<\/strong>/i.test(finalContent), 'Course 1 summative final must not expose its answer key.');
verified.push({ type: 'final-test', id: final.id, slug: 'final-course-test', securedQuestionCount: expectedFinalCount });

const sourceScopedItemCount = publicQuestionCount + expectedFinalCount;
must(sourceScopedItemCount === canonical.total, `Expected ${canonical.total} canonical course-learning items, verified ${sourceScopedItemCount} across rendered formative checks plus the secured final.`);
must(sourceScopedItemCount === canonical.release.publicScope.publicCourseItems, `Verified source-scoped total ${sourceScopedItemCount} differs from release manifest ${canonical.release.publicScope.publicCourseItems}.`);
must(verified.length === 19, `Expected 19 managed base Course 1 pages, verified ${verified.length}.`);

const idSet = new Set(verified.map((page) => Number(page.id)));
must(idSet.size === 19, 'Managed Course 1 base page IDs are not unique.');

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  site,
  courseId: local.course.id,
  sourceRelease: canonical.release.id,
  learnPageId: learn.id,
  managedBasePages: verified.length,
  publicCourseItems: canonical.total,
  renderedFormativeItems: publicQuestionCount,
  securedFinalItems: expectedFinalCount,
  moduleItemCounts: local.modules.map((module) => ({ module: module.number, assessmentId: module.assessment, items: canonical.counts.get(module.assessment) })),
  finalItemCount: expectedFinalCount,
  finalDeliveryMode: 'authenticated-graded-runtime',
  guidedUi: true,
  responsiveLayout: 'v4',
  pageIds: verified.map(({ type, number, id, slug, questionCount }) => ({ type, ...(number ? { number } : {}), id, slug, ...(questionCount ? { questionCount } : {}) })),
  result: 'success'
}, null, 2));
