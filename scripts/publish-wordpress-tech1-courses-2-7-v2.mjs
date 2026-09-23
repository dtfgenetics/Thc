import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_TECH1_PUBLIC_COURSES || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const configPath = process.env.TECH1_PUBLIC_COURSES_PATH || 'site/wordpress/education/tech1-courses-public-v1.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-tech1-public-courses';
const config = JSON.parse(await readFile(configPath, 'utf8'));
const configuredSourceRef = String(config.source?.ref || 'main');
const sourceRef = String(process.env.THC_LEARNING_SOURCE_SHA || configuredSourceRef).trim();
if (process.env.THC_LEARNING_SOURCE_SHA && !/^[0-9a-f]{40}$/i.test(sourceRef)) throw new Error('THC_LEARNING_SOURCE_SHA must be a full 40-character Git commit SHA.');
const rawBase = `https://raw.githubusercontent.com/${config.source.repository}/${encodeURIComponent(sourceRef)}`;
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = (value, message) => { if (!value) throw new Error(message); };
const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

must(config.schemaVersion === 1 && config.id === 'tech1-courses-public-v1', 'Unexpected Technician I public-course config.');
must(config.source?.repository === 'dtfgenetics/Thc-learning-courses-', 'Unexpected Technician I source repository.');
must(Array.isArray(config.courses) && config.courses.length === 6, 'Expected Courses 2-7 in public-course config.');
must(new Set(config.courses.map(x => x.id)).size === 6, 'Technician I public-course IDs must be unique.');

async function fetchText(url) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'DTF-Tech1-Public-Courses/2.0' } });
      if (response.ok) return response.text();
      last = new Error(`${url} returned ${response.status}`);
    } catch (error) { last = error; }
    if (attempt < 6) await sleep(attempt * 700);
  }
  throw last;
}
const fetchJson = async rel => JSON.parse(await fetchText(`${rawBase}/${rel}`));

function isControlledRasterAssetPath(value) {
  return /^\/assets\/course\d+\/[A-Za-z0-9._-]+\.(?:png|webp|jpe?g)$/i.test(String(value || ''));
}
function sourceAssetUrl(value) {
  if (typeof value !== 'string') return '';
  if (/^https:\/\//i.test(value)) return value;
  if (isControlledRasterAssetPath(value)) return `${rawBase}/apps/web/public${value}`;
  return value;
}
function assetIdFromBlock(block) {
  return block?.assetId || block?.extensions?.assetId || null;
}
function lessonAssetBlocks(lesson) {
  return (lesson?.content?.blocks || []).filter(block =>
    (block?.type === 'image' && assetIdFromBlock(block) && (block.src || block.url)) ||
    (block?.type === 'resource' && assetIdFromBlock(block) && block.href)
  );
}

async function loadCourse(entry) {
  const course = await fetchJson(`content/courses/${entry.id}.json`);
  const release = await fetchJson(`content/public-releases/${entry.releaseId}.json`);
  must(release.courseId === entry.id && release.publicationState === 'published', `${entry.id}: public release missing or not published.`);
  must(release.publicationBoundary?.credentialExam === 'restricted', `${entry.id}: credential exam must remain restricted.`);
  must(Array.isArray(release.publicScope?.modules) && release.publicScope.modules.length === 1, `${entry.id}: expected one dedicated public module.`);
  const module = await fetchJson(`content/modules/${release.publicScope.modules[0]}.json`);
  const lessons = [];
  for (const lessonId of module.lessons || []) {
    must(release.publicScope.studentSources.includes(`content/lessons/${lessonId}.json`), `${entry.id}: ${lessonId} not authorized by public release.`);
    const lesson = await fetchJson(`content/lessons/${lessonId}.json`);
    must(lesson.id === lessonId && lesson.content?.overview && lesson.content?.summary, `${lessonId}: incomplete learner lesson source.`);
    lessons.push(lesson);
  }
  const assessments = [];
  let itemCount = 0;
  for (const assessmentId of release.publicScope.assessments || []) {
    const assessment = await fetchJson(`content/assessments/${assessmentId}.json`);
    must(['formative', 'summative'].includes(assessment.purpose), `${assessmentId}: credential-purpose assessment blocked.`);
    const items = [];
    for (const itemId of assessment.items || []) {
      const question = await fetchJson(`content/questions/${itemId}.json`);
      must(['formative', 'summative'].includes(question.purpose), `${itemId}: credential-purpose item blocked.`);
      must(Array.isArray(question.choices) && Number.isInteger(question.correct), `${itemId}: unsupported public question format.`);
      items.push(question);
      itemCount++;
    }
    assessments.push({ ...assessment, items });
  }
  must(itemCount === release.publicScope.publicCourseItems, `${entry.id}: public item count ${itemCount} differs from release ${release.publicScope.publicCourseItems}.`);
  return { ...entry, course, release, module, lessons, assessments, itemCount, route: `${config.program.route}${entry.slug}/` };
}

const css = `<style id="dtf-tech1-public-courses-v2">
.t1c{--ink:#183223;--muted:#5a6b60;--deep:#0b281a;--green:#227244;--soft:#f4f8f4;--line:#d8e4da;--gold:#c9a74f;background:linear-gradient(180deg,#fafbf7,#f1f6f1);color:var(--ink);padding:32px 0 72px}.t1c *{box-sizing:border-box}.t1c-wrap{width:min(1120px,calc(100% - 28px));margin:auto}.t1c-hero{padding:clamp(26px,5vw,54px);border-radius:22px;background:linear-gradient(135deg,var(--deep),#1b4a2f);color:#fff}.t1c-k{font-size:.75rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#b8e3be}.t1c h1{font-size:clamp(2.2rem,5vw,4.6rem);line-height:1;letter-spacing:-.045em;margin:.2em 0}.t1c h2{font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.12}.t1c p,.t1c li{line-height:1.7}.t1c-hero p{color:#dfece2;max-width:820px}.t1c-nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.t1c-nav a,.t1c-btn{display:inline-flex;align-items:center;min-height:42px;padding:9px 13px;border:1px solid var(--line);border-radius:10px;background:#fff;color:#175f36!important;font-weight:850;text-decoration:none!important}.t1c-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.t1c-card,.t1c-panel,.t1c-q{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px}.t1c-card h3,.t1c-panel h2{margin-top:0}.t1c-meta{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.t1c-pill{padding:6px 9px;border-radius:999px;background:#eaf3eb;color:#285d3a;font-size:.78rem;font-weight:850}.t1c-boundary{margin:18px 0;padding:15px 17px;border-left:5px solid var(--gold);background:#fff7df;border-radius:10px;color:#554b2c}.t1c-callout{margin:18px 0;padding:16px;border:1px solid #d5c896;background:#fff9e8;border-radius:12px}.t1c-section{margin-top:28px}.t1c-vocab{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.t1c-vocab div{padding:14px;background:var(--soft);border-radius:12px}.t1c-step{padding:14px 16px;border-left:4px solid #4a9a61;background:#f7faf7;margin:10px 0}.t1c-scenario{padding:18px;background:#f8f5e9;border:1px solid #e6dcc1;border-radius:14px}.t1c-resource{display:flex;flex-direction:column;gap:10px}.t1c-resource a{align-self:flex-start}.t1c-figure img{display:block;width:100%;max-height:760px;object-fit:contain;background:#fff;border:1px solid var(--line)}.t1c-docfields{display:grid;gap:8px}.t1c-docfield{padding:10px 12px;background:var(--soft);border-radius:9px}.t1c details{background:#fff;border:1px solid var(--line);border-radius:12px;padding:0 14px}.t1c summary{cursor:pointer;font-weight:900;padding:12px 0}.t1c-q{margin:12px 0}.t1c-q ol{padding-left:24px}.t1c-table{overflow:auto}.t1c table{width:100%;border-collapse:collapse;min-width:620px}.t1c th,.t1c td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.t1c th{background:var(--soft)}.t1c :focus-visible{outline:3px solid #155fbd;outline-offset:3px}@media(max-width:760px){.t1c-grid,.t1c-vocab{grid-template-columns:1fr}.t1c-hero{border-radius:16px;padding:24px 18px}.t1c-wrap{width:min(100% - 18px,1120px)}.t1c table{min-width:560px}}@media print{.t1c{background:#fff;padding:0}.t1c-nav{display:none}}
</style>`;
const shell = body => `${css}<main class="t1c" data-tech1-source-ref="${esc(sourceRef)}"><div class="t1c-wrap">${body}</div></main>`;
const crumbs = (course, title = '') => `<nav class="t1c-nav" aria-label="Learning Hub breadcrumb"><a href="/courses/">Courses</a><a href="${esc(config.program.route)}">${esc(config.program.title)}</a><a href="${esc(course.route)}">Course ${course.number}</a>${title ? `<span class="t1c-pill">${esc(title)}</span>` : ''}</nav>`;
const assetMarker = id => id ? `<span class="t1c-asset-marker" data-asset-id="${esc(id)}" hidden>${esc(id)}</span>` : '';

function renderComparison(block) {
  const sides = Array.isArray(block.items) && block.items.length ? block.items : [block.left, block.right].filter(Boolean);
  return `<section class="t1c-section"><h2>${esc(block.title || 'Comparison')}</h2><div class="t1c-grid">${sides.map(side => `<article class="t1c-card"><h3>${esc(side.title || side.label || '')}</h3><p>${esc(side.body || side.description || '')}</p>${side.image ? `<img src="${esc(sourceAssetUrl(side.image))}" alt="${esc(side.alt || '')}" loading="lazy" style="max-width:100%;height:auto">` : ''}</article>`).join('')}</div></section>`;
}
function renderDocument(block) {
  const intro = block.description || block.body || block.prompt || '';
  const fields = Array.isArray(block.fields) ? block.fields : [];
  return `<section class="t1c-section t1c-card"><h2>${esc(block.title || 'Document practice')}</h2>${intro ? `<p>${esc(intro)}</p>` : ''}${fields.length ? `<div class="t1c-docfields">${fields.map(field => `<div class="t1c-docfield"><strong>${esc(field.label || '')}</strong><div>${esc(field.value || '')}</div></div>`).join('')}</div>` : ''}${block.note ? `<p><em>${esc(block.note)}</em></p>` : ''}</section>`;
}
function renderBlock(block) {
  if (!block || typeof block !== 'object') return '';
  if (block.type === 'steps') return `<section class="t1c-section"><h2>${esc(block.title || 'Steps')}</h2>${(block.items || block.steps || []).map((item, index) => `<div class="t1c-step"><strong>${index + 1}. ${esc(item.title || 'Step')}</strong><p>${esc(item.body || '')}</p></div>`).join('')}</section>`;
  if (block.type === 'scenario') return `<section class="t1c-section t1c-scenario"><h2>${esc(block.title || 'Scenario')}</h2>${block.setting ? `<p><strong>Setting:</strong> ${esc(block.setting)}</p>` : ''}<p><strong>Prompt:</strong> ${esc(block.prompt || '')}</p>${Array.isArray(block.options) ? `<ol type="A">${block.options.map(option => `<li>${esc(option)}</li>`).join('')}</ol>` : ''}${block.answer ? `<details><summary>Check response</summary><p><strong>Answer:</strong> ${esc(block.answer)}</p>${block.feedback ? `<p>${esc(block.feedback)}</p>` : ''}</details>` : ''}</section>`;
  if (block.type === 'comparison') return renderComparison(block);
  if (block.type === 'table') {
    const headers = block.headers || block.columns || [];
    const rows = block.rows || [];
    return `<section class="t1c-section"><h2>${esc(block.title || 'Reference table')}</h2>${block.caption ? `<p>${esc(block.caption)}</p>` : ''}<div class="t1c-table"><table>${headers.length ? `<thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(row => `<tr>${(Array.isArray(row) ? row : Object.values(row)).map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }
  if (block.type === 'activity') return `<section class="t1c-section t1c-card"><h2>${esc(block.title || 'Practice')}</h2><p>${esc(block.prompt || block.body || block.instructions || '')}</p></section>`;
  if (block.type === 'document') return renderDocument(block);
  if (block.type === 'image' && (block.src || block.url)) {
    const id = assetIdFromBlock(block);
    return `<figure class="t1c-section t1c-figure">${assetMarker(id)}<img src="${esc(sourceAssetUrl(block.src || block.url))}" alt="${esc(block.alt || '')}" loading="lazy"><figcaption>${esc(block.caption || '')}</figcaption></figure>`;
  }
  if (block.type === 'resource' && block.href) {
    const id = assetIdFromBlock(block);
    return `<section class="t1c-section t1c-card t1c-resource">${assetMarker(id)}<h2>${esc(block.title || 'Learning resource')}</h2>${block.body ? `<p>${esc(block.body)}</p>` : ''}<a class="t1c-btn" href="${esc(sourceAssetUrl(block.href))}" target="_blank" rel="noopener noreferrer">${esc(block.label || 'Open resource')}</a></section>`;
  }
  if (block.type === 'callout' && (block.body || block.title)) return `<aside class="t1c-callout"><strong>${esc(block.title || 'Important')}</strong>${block.body ? `<p>${esc(block.body)}</p>` : ''}</aside>`;
  if (block.type === 'text' && block.body) return `<section class="t1c-section">${block.title ? `<h2>${esc(block.title)}</h2>` : ''}<p>${esc(block.body)}</p></section>`;
  if (block.type === 'divider') return '<hr class="t1c-section">';
  return '';
}

function renderLesson(course, lesson, index) {
  const content = lesson.content || {};
  const vocab = (content.vocabulary || []).map(item => `<div><strong>${esc(item.term)}</strong><p>${esc(item.definition)}</p></div>`).join('');
  const sections = (content.sections || []).map(section => `<section class="t1c-section"><h2>${esc(section.title)}</h2><p>${esc(section.body)}</p></section>`).join('');
  const examples = (content.workedExamples || []).length ? `<section class="t1c-section t1c-panel"><h2>Worked examples</h2><ul>${content.workedExamples.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>` : '';
  const mistakes = (content.commonMistakes || []).length ? `<section class="t1c-section t1c-panel"><h2>Common mistakes</h2><ul>${content.commonMistakes.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>` : '';
  const blocks = (content.blocks || []).map(renderBlock).join('');
  const nav = [];
  if (index > 0) nav.push(`<a class="t1c-btn" href="${course.route}lesson-${String(index).padStart(2, '0')}/">← Previous lesson</a>`);
  if (index < course.lessons.length - 1) nav.push(`<a class="t1c-btn" href="${course.route}lesson-${String(index + 2).padStart(2, '0')}/">Next lesson →</a>`);
  return shell(`${crumbs(course, `Lesson ${index + 1}`)}<header class="t1c-hero"><span class="t1c-k">Course ${course.number} · Lesson ${index + 1}</span><h1>${esc(lesson.title)}</h1><p>${esc(content.overview)}</p><div class="t1c-meta"><span class="t1c-pill">${esc(lesson.estimatedMinutes || '')} min</span><span class="t1c-pill">${esc((lesson.learningObjectives || []).length)} objectives</span></div></header>${vocab ? `<section class="t1c-section"><h2>Key vocabulary</h2><div class="t1c-vocab">${vocab}</div></section>` : ''}${sections}${examples}${mistakes}${blocks}${content.practicalApplication ? `<section class="t1c-section t1c-panel"><h2>Practical application</h2><p>${esc(content.practicalApplication)}</p></section>` : ''}<section class="t1c-section t1c-panel"><h2>Lesson summary</h2><p>${esc(content.summary)}</p></section><div class="t1c-nav">${nav.join('')}</div><div class="t1c-boundary"><strong>Training boundary:</strong> Public lesson completion is academic learning evidence only. It does not issue the THC Cultivation Technician I professional certification.</div>`);
}
function renderAssessment(course, assessment, label) {
  const questions = assessment.items.map((question, index) => `<article class="t1c-q"><h3>${index + 1}. ${esc(question.stem)}</h3><ol type="A">${question.choices.map(choice => `<li>${esc(choice)}</li>`).join('')}</ol><details><summary>Check answer and rationale</summary><p><strong>Answer:</strong> ${String.fromCharCode(65 + question.correct)}. ${esc(question.choices[question.correct])}</p>${question.rationale ? `<p>${esc(question.rationale)}</p>` : ''}</details></article>`).join('');
  return shell(`${crumbs(course, label)}<header class="t1c-hero"><span class="t1c-k">Course ${course.number} · ${esc(label)}</span><h1>${esc(assessment.title)}</h1><p>Complete each item before opening the answer panel. Use missed rationales to return to the matching lesson.</p></header><div class="t1c-boundary"><strong>Assessment boundary:</strong> This is a public learning assessment, not the secure professional certification examination.</div><section class="t1c-section">${questions}</section>`);
}
function renderIndex(course) {
  const lessonCards = course.lessons.map((lesson, index) => `<article class="t1c-card"><span class="t1c-k" style="color:#47755a">Lesson ${index + 1}</span><h3>${esc(lesson.title)}</h3><p>${esc(lesson.content?.overview || '')}</p><a class="t1c-btn" href="${course.route}lesson-${String(index + 1).padStart(2, '0')}/">Open lesson →</a></article>`).join('');
  const assessmentCards = course.assessments.map(assessment => {
    const label = assessment.purpose === 'summative' ? 'Course assessment' : (course.number === 7 ? 'Readiness check' : 'Knowledge check');
    const slug = assessment.purpose === 'summative' ? 'course-assessment' : (course.number === 7 ? 'readiness-check' : 'knowledge-check');
    return `<article class="t1c-card"><span class="t1c-k" style="color:#47755a">${esc(label)}</span><h3>${esc(assessment.title)}</h3><p>${assessment.items.length} public learning items.</p><a class="t1c-btn" href="${course.route}${slug}/">Open assessment →</a></article>`;
  }).join('');
  return shell(`${crumbs(course)}<header class="t1c-hero"><span class="t1c-k">THC Cultivation Technician I · Course ${course.number}</span><h1>${esc(course.course.title)}</h1><p>${esc(course.course.description)}</p><div class="t1c-meta"><span class="t1c-pill">${course.lessons.length} lessons</span><span class="t1c-pill">${course.itemCount} public learning items</span></div></header><section class="t1c-section t1c-panel"><h2>What you will learn</h2><ul>${(course.course.learningOutcomes || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul></section><section class="t1c-section"><h2>Lessons</h2><div class="t1c-grid">${lessonCards}</div></section><section class="t1c-section"><h2>Learning assessments</h2><div class="t1c-grid">${assessmentCards}</div></section><div class="t1c-boundary"><strong>Public professional training:</strong> this course is open for study and academic learning assessment. Professional certification issuance remains a separate, restricted validation process.</div>`);
}

async function wp(endpoint, options = {}) {
  must(auth, 'WordPress credentials are required.');
  const response = await fetch(`${site}/wp-json/wp/v2/${endpoint.replace(/^\//, '')}`, { ...options, headers: { Authorization: auth, 'Content-Type': 'application/json', ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${responseText.slice(0, 500)}`);
  return responseText ? JSON.parse(responseText) : null;
}
async function findPage(slug, parent = null) {
  const parentQuery = parent === null ? '' : `&parent=${parent}`;
  const rows = await wp(`pages?slug=${encodeURIComponent(slug)}${parentQuery}&context=edit&per_page=100`);
  return rows[0] || null;
}
async function upsertPage({ slug, title, parent, content, excerpt = '' }) {
  const existing = await findPage(slug, parent);
  if (existing) {
    await mkdir(backupRoot, { recursive: true });
    await writeFile(join(backupRoot, `${existing.id}-${slug}.json`), JSON.stringify(existing, null, 2));
  }
  const body = JSON.stringify({ slug, title, parent, status: 'publish', content, excerpt, comment_status: 'closed' });
  return existing ? wp(`pages/${existing.id}`, { method: 'POST', body }) : wp('pages', { method: 'POST', body });
}

const courses = [];
for (const entry of config.courses) courses.push(await loadCourse(entry));

if (validateOnly) {
  must(courses.every(course => course.lessons.length === 4), 'Every Technician I Course 2-7 public package must resolve four dedicated lessons.');
  must(courses.filter(course => course.number < 7).every(course => course.assessments.length === 2), 'Courses 2-6 require formative and summative public learning assessments.');
  must(courses.find(course => course.number === 7)?.assessments.length === 1, 'Course 7 requires one public readiness assessment.');
  const assetRefs = [];
  for (const course of courses) for (const lesson of course.lessons) {
    for (const block of lessonAssetBlocks(lesson)) {
      const source = block.type === 'image' ? (block.src || block.url) : block.href;
      must(isControlledRasterAssetPath(source), `${lesson.id}: governed learner asset must use a controlled raster /assets/courseN/*.(png|webp|jpg|jpeg) path`);
      await fetchText(sourceAssetUrl(source));
      assetRefs.push({ lessonId: lesson.id, assetId: assetIdFromBlock(block), source });
    }
  }
  console.log(JSON.stringify({ result: 'success', sourceRef, courses: courses.map(course => ({ id: course.id, route: course.route, lessons: course.lessons.length, assessments: course.assessments.length, items: course.itemCount })), governedAssetReferencesValidated: assetRefs.length }, null, 2));
  process.exit(0);
}
if (!apply) {
  console.log('Validation passed. Set APPLY_TECH1_PUBLIC_COURSES=true to publish.');
  process.exit(0);
}

await mkdir(backupRoot, { recursive: true });
await writeFile(join(backupRoot, 'source-identity.json'), JSON.stringify({
  sourceRepository: config.source.repository,
  configuredSourceRef,
  resolvedSourceRef: sourceRef,
  exactSourceShaPinned: /^[0-9a-f]{40}$/i.test(sourceRef),
  siteRepository: process.env.GITHUB_REPOSITORY || 'dtfgenetics/Thc',
  siteSourceSha: process.env.GITHUB_SHA || null,
  workflowRunId: process.env.GITHUB_RUN_ID || null,
  workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  recordedAt: new Date().toISOString()
}, null, 2));
console.log(JSON.stringify({ sourceIdentity: { repository: config.source.repository, resolvedRef: sourceRef, exactSourceShaPinned: /^[0-9a-f]{40}$/i.test(sourceRef) } }));

let program = await findPage(config.program.slug, null);
if (!program) {
  const hub = await findPage('learning-hub', null);
  must(hub, 'Learning Hub parent page not found.');
  program = await upsertPage({ slug: config.program.slug, title: config.program.title, parent: hub.id, content: shell(`<header class="t1c-hero"><span class="t1c-k">Professional training pathway</span><h1>${esc(config.program.title)}</h1><p>Seven-course public academic training pathway. Professional credential issuance remains separate and restricted.</p></header>`) });
}

const published = [];
for (const course of courses) {
  const rootPage = await upsertPage({ slug: course.slug, title: `Course ${course.number} — ${course.course.title}`, parent: program.id, content: renderIndex(course), excerpt: course.course.description });
  for (let index = 0; index < course.lessons.length; index++) {
    await upsertPage({ slug: `lesson-${String(index + 1).padStart(2, '0')}`, title: `Course ${course.number} Lesson ${index + 1} — ${course.lessons[index].title}`, parent: rootPage.id, content: renderLesson(course, course.lessons[index], index) });
  }
  for (const assessment of course.assessments) {
    const isFinal = assessment.purpose === 'summative';
    const slug = isFinal ? 'course-assessment' : (course.number === 7 ? 'readiness-check' : 'knowledge-check');
    const label = isFinal ? 'Course assessment' : (course.number === 7 ? 'Readiness check' : 'Knowledge check');
    await upsertPage({ slug, title: `Course ${course.number} ${label} — ${assessment.title}`, parent: rootPage.id, content: renderAssessment(course, assessment, label) });
  }
  published.push({ courseId: course.id, pageId: rootPage.id, route: course.route, lessons: course.lessons.length, assessments: course.assessments.length, items: course.itemCount, governedAssetReferences: course.lessons.reduce((sum, lesson) => sum + lessonAssetBlocks(lesson).length, 0) });
}
await mkdir(backupRoot, { recursive: true });
await writeFile(join(backupRoot, 'publication-result.json'), JSON.stringify({ publishedAt: new Date().toISOString(), sourceRepository: config.source.repository, sourceRef, published }, null, 2));
console.log(JSON.stringify({ result: 'success', sourceRef, published }, null, 2));
