import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_TECH2_PUBLIC_COURSES || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const configPath = process.env.TECH2_PUBLIC_COURSES_PATH || 'site/wordpress/education/tech2-courses-public-v1.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-tech2-public-courses';
const config = JSON.parse(await readFile(configPath, 'utf8'));
const configuredSourceRef = String(config.source?.ref || 'main');
const sourceRef = String(process.env.THC_LEARNING_SOURCE_SHA || configuredSourceRef).trim();
if (process.env.THC_LEARNING_SOURCE_SHA && !/^[0-9a-f]{40}$/i.test(sourceRef)) throw new Error('THC_LEARNING_SOURCE_SHA must be a full 40-character Git commit SHA.');
const rawBase = `https://raw.githubusercontent.com/${config.source.repository}/${encodeURIComponent(sourceRef)}`;
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = (value, message) => { if (!value) throw new Error(message); };
const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

must(config.schemaVersion === 1 && config.id === 'tech2-courses-public-v1', 'Unexpected Technician II public-course config.');
must(Array.isArray(config.courses) && config.courses.length === 8, 'Expected Technician II Courses 1-8.');
must(new Set(config.courses.map(x => x.id)).size === 8, 'Technician II public-course IDs must be unique.');

const transientCodes = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN']);
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
async function fetchRetry(url, options = {}, label = url) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (response.ok || !transientStatuses.has(response.status)) return response;
      last = new Error(`${label} returned transient HTTP ${response.status}`);
    } catch (error) {
      last = error;
      const code = error?.cause?.code || error?.code;
      if (code && !transientCodes.has(code) && error?.name !== 'TimeoutError') throw error;
    }
    if (attempt < 6) await sleep(Math.min(10000, 900 * attempt));
  }
  throw last;
}
async function fetchText(url) {
  const response = await fetchRetry(url, { headers: { 'User-Agent': 'DTF-Tech2-Public-Courses/1.0' } }, url);
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${text.slice(0, 500)}`);
  return text;
}
async function fetchJson(rel) { return JSON.parse(await fetchText(`${rawBase}/${rel}`)); }

async function loadCourse(entry) {
  const course = await fetchJson(`content/courses/${entry.id}.json`);
  const release = await fetchJson(`content/public-releases/${entry.releaseId}.json`);
  must(release.courseId === entry.id && release.publicationState === 'published', `${entry.id}: public academic release missing or not published.`);
  must(release.publicationBoundary?.learnerPackage === 'released', `${entry.id}: learner package is not released.`);
  must(release.publicationBoundary?.credentialExam === 'restricted', `${entry.id}: credential exam must remain restricted.`);
  must(Array.isArray(release.publicScope?.modules) && release.publicScope.modules.length === 1, `${entry.id}: expected one dedicated public module.`);
  const module = await fetchJson(`content/modules/${release.publicScope.modules[0]}.json`);
  must(Array.isArray(module.lessons) && module.lessons.length === 4, `${entry.id}: expected four dedicated lessons.`);
  const lessons = [];
  for (const lessonId of module.lessons) {
    must(release.publicScope.studentSources.includes(`content/lessons/${lessonId}.json`), `${entry.id}: ${lessonId} not authorized by public release.`);
    const lesson = await fetchJson(`content/lessons/${lessonId}.json`);
    must(lesson.id === lessonId && lesson.content?.overview && lesson.content?.summary, `${lessonId}: incomplete learner lesson source.`);
    must(Array.isArray(lesson.learningObjectives) && lesson.learningObjectives.length > 0, `${lessonId}: objectives missing.`);
    lessons.push(lesson);
  }
  const assessments = [];
  let itemCount = 0;
  for (const assessmentId of release.publicScope.assessments || []) {
    const assessment = await fetchJson(`content/assessments/${assessmentId}.json`);
    must(['formative', 'summative'].includes(assessment.purpose), `${assessmentId}: credential-purpose assessment blocked.`);
    const items = [];
    for (const itemId of assessment.items || []) {
      const q = await fetchJson(`content/questions/${itemId}.json`);
      must(['formative', 'summative'].includes(q.purpose), `${itemId}: credential-purpose item blocked.`);
      must(Array.isArray(q.choices) && Number.isInteger(q.correct), `${itemId}: unsupported public question format.`);
      items.push(q);
      itemCount += 1;
    }
    assessments.push({ ...assessment, items });
  }
  must(itemCount === release.publicScope.publicCourseItems, `${entry.id}: public item count ${itemCount} differs from release ${release.publicScope.publicCourseItems}.`);
  return { ...entry, course, release, module, lessons, assessments, itemCount, route: `${config.program.route}${entry.slug}/` };
}

const css = `<style id="dtf-tech2-public-courses-v1">.t2c{--ink:#14291c;--muted:#58695f;--deep:#082419;--deep2:#153f2b;--green:#26784a;--green2:#e9f4ec;--soft:#f4f8f4;--line:#d6e3d8;--gold:#c7a24d;--paper:#fff;background:linear-gradient(180deg,#fbfaf5,#eef5ef);color:var(--ink);padding:28px 0 72px}.t2c *{box-sizing:border-box}.t2c-wrap{width:min(1180px,calc(100% - 28px));margin:auto}.t2c-hero{padding:clamp(26px,5vw,54px);border-radius:24px;background:linear-gradient(135deg,var(--deep),var(--deep2));color:#fff;box-shadow:0 18px 55px rgba(8,36,25,.12)}.t2c-k{font-size:.75rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#b9e5c4}.t2c h1{font-size:clamp(2.15rem,5vw,4.65rem);line-height:1;letter-spacing:-.045em;margin:.2em 0}.t2c h2{font-size:clamp(1.45rem,3vw,2.2rem);line-height:1.14}.t2c h3{line-height:1.2}.t2c p,.t2c li{line-height:1.7}.t2c-hero p{color:#e1eee5;max-width:850px}.t2c-nav{display:flex;flex-wrap:wrap;gap:8px;margin:15px 0}.t2c-nav a,.t2c-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 14px;border:1px solid var(--line);border-radius:11px;background:#fff;color:#185f38!important;font-weight:850;text-decoration:none!important}.t2c-btn.primary{background:var(--green);border-color:var(--green);color:#fff!important}.t2c-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.t2c-card,.t2c-panel,.t2c-q,.t2c-outline{background:var(--paper);border:1px solid var(--line);border-radius:17px;padding:20px}.t2c-card h3,.t2c-panel h2{margin-top:0}.t2c-card p{color:var(--muted)}.t2c-meta{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.t2c-pill{padding:6px 10px;border-radius:999px;background:var(--green2);color:#285e3b;font-size:.78rem;font-weight:850}.t2c-boundary{margin:18px 0;padding:15px 17px;border-left:5px solid var(--gold);background:#fff7df;border-radius:10px;color:#564b2c}.t2c-section{margin-top:28px}.t2c-vocab{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.t2c-vocab div{padding:14px;background:var(--soft);border-radius:12px}.t2c-step{padding:14px 16px;border-left:4px solid #4b9d63;background:#f7faf7;margin:10px 0}.t2c-scenario{padding:18px;background:#f8f5e9;border:1px solid #e5dcc1;border-radius:14px}.t2c details{background:#fff;border:1px solid var(--line);border-radius:12px;padding:0 14px}.t2c summary{cursor:pointer;font-weight:900;padding:12px 0}.t2c-q{margin:12px 0}.t2c-q ol{padding-left:24px}.t2c-table{overflow:auto}.t2c table{width:100%;border-collapse:collapse;min-width:620px}.t2c th,.t2c td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.t2c th{background:var(--soft)}.t2c-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:start}.t2c-outline{position:sticky;top:20px}.t2c-outline h2{font-size:1rem;margin-top:0}.t2c-outline ol{padding-left:20px;margin-bottom:0}.t2c-outline li{margin:7px 0}.t2c-outline a{color:#185f38;font-weight:750}.t2c-objectives{padding:18px 20px;background:#edf6ef;border-radius:15px}.t2c-program{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}.t2c-program .t2c-card{display:flex;flex-direction:column}.t2c-program .t2c-btn{margin-top:auto;align-self:flex-start}.t2c :focus-visible{outline:3px solid #155fbd;outline-offset:3px}@media(max-width:880px){.t2c-layout{grid-template-columns:1fr}.t2c-outline{position:static;order:initial}.t2c-grid,.t2c-program{grid-template-columns:1fr}}@media(max-width:620px){
.t2c{padding:12px 0 calc(84px + env(safe-area-inset-bottom));font-size:16.5px}
.t2c-wrap{width:min(100% - 28px,1180px)}
.t2c-hero{padding:22px 18px 20px;border-radius:15px;box-shadow:none}
.t2c h1{font-size:clamp(2rem,9.8vw,3rem);line-height:.98;letter-spacing:-.035em;text-wrap:balance}
.t2c h2{font-size:clamp(1.35rem,6.5vw,1.75rem);line-height:1.12}
.t2c h3{font-size:1.08rem}
.t2c p,.t2c li{line-height:1.62}
.t2c-hero p{font-size:.98rem;line-height:1.58}
.t2c-crumbs{margin:4px 0 12px;display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.t2c-crumbs::-webkit-scrollbar{display:none}
.t2c-crumbs a,.t2c-crumbs .t2c-pill{flex:0 0 auto;width:auto;min-height:44px;white-space:nowrap}
.t2c-meta{gap:6px;margin:13px 0 0;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none}
.t2c-meta::-webkit-scrollbar{display:none}
.t2c-pill{flex:0 0 auto;font-size:.73rem}
.t2c-section{margin-top:22px}
.t2c-card,.t2c-panel,.t2c-q,.t2c-outline{padding:16px;border-radius:14px}
.t2c-outline{margin-top:22px}
.t2c-outline h2{font-size:1rem}
.t2c-q{margin:10px 0}
.t2c-q ol{padding-left:22px}
.t2c-vocab{grid-template-columns:1fr}
.t2c-nav:not(.t2c-crumbs):not(.t2c-lesson-nav){display:grid}
.t2c-nav:not(.t2c-crumbs):not(.t2c-lesson-nav) a,.t2c-btn{width:100%}
.t2c-program .t2c-btn{align-self:stretch}
.t2c-btn{min-height:46px;padding:10px 14px}
.t2c-scenario{padding:15px}
.t2c-step{padding:13px 14px}
.t2c-table{margin-inline:-2px;padding-bottom:8px;overflow-x:auto;overscroll-behavior-inline:contain}
.t2c table{min-width:520px;font-size:.88rem}
.t2c th,.t2c td{padding:9px}
.t2c figure{margin-left:0;margin-right:0}
.t2c figure img{max-height:none!important;border-radius:12px!important}
.t2c figcaption{padding-top:8px;color:var(--muted);font-size:.88rem;line-height:1.45}
.t2c-mobile-progress{display:grid;gap:7px;margin:0 0 12px;font-size:.75rem;font-weight:850;color:#496052}
.t2c-mobile-progress>div{height:5px;overflow:hidden;border-radius:999px;background:#dce8de}
.t2c-mobile-progress i{display:block;height:100%;border-radius:inherit;background:var(--green)}
.t2c-lesson-nav{position:fixed;z-index:40;left:0;right:0;bottom:0;margin:0;padding:9px 12px calc(9px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;background:rgba(250,251,247,.96);border-top:1px solid var(--line);box-shadow:0 -8px 24px rgba(17,45,28,.08);backdrop-filter:blur(12px)}
.t2c-lesson-nav .t2c-btn{width:auto;min-width:0;padding:9px 11px;justify-content:center}
.t2c-lesson-nav .t2c-btn:first-of-type{grid-column:1}
.t2c-lesson-nav .t2c-btn:last-of-type{grid-column:3}
.t2c-lesson-count{grid-column:2;grid-row:1;font-size:.72rem;font-weight:900;color:var(--muted);white-space:nowrap}
.t2c-boundary{padding:13px 14px;font-size:.88rem}
}
@media(min-width:621px){.t2c-mobile-progress,.t2c-lesson-count{display:none}}
@media print{.t2c{background:#fff;padding:0}.t2c-nav,.t2c-outline{display:none}.t2c-layout{display:block}}</style>`;
const shell = body => `${css}<main class="t2c"><div class="t2c-wrap">${body}</div></main>`;
const crumbs = (course, title = '') => `<nav class="t2c-nav t2c-crumbs" aria-label="Learning Hub breadcrumb"><a href="/courses/">Courses</a><a href="${esc(config.program.route)}">${esc(config.program.title)}</a><a href="${esc(course.route)}">Course ${course.number}</a>${title ? `<span class="t2c-pill">${esc(title)}</span>` : ''}</nav>`;
const outline = (course, current = '') => `<aside class="t2c-outline" aria-label="Course outline"><h2>Course ${course.number} outline</h2><ol>${course.lessons.map((l, i) => `<li>${current === `lesson-${i + 1}` ? `<strong>${esc(l.title)}</strong>` : `<a href="${course.route}lesson-${String(i + 1).padStart(2, '0')}/">${esc(l.title)}</a>`}</li>`).join('')}</ol><hr><p><a href="${course.route}">Course home</a></p></aside>`;

function renderBlock(block) {
  if (!block || typeof block !== 'object') return '';
  if (block.type === 'steps') return `<section class="t2c-section"><h2>${esc(block.title || 'Steps')}</h2>${(block.items || []).map((x, i) => `<div class="t2c-step"><strong>${i + 1}. ${esc(x.title || 'Step')}</strong><p>${esc(x.body || '')}</p></div>`).join('')}</section>`;
  if (block.type === 'scenario') return `<section class="t2c-section t2c-scenario"><h2>${esc(block.title || 'Scenario')}</h2>${block.setting ? `<p><strong>Setting:</strong> ${esc(block.setting)}</p>` : ''}<p><strong>Prompt:</strong> ${esc(block.prompt || '')}</p>${Array.isArray(block.options) ? `<ol type="A">${block.options.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${block.answer ? `<details><summary>Check response</summary><p><strong>Answer:</strong> ${esc(block.answer)}</p>${block.feedback ? `<p>${esc(block.feedback)}</p>` : ''}</details>` : ''}</section>`;
  if (block.type === 'comparison') return `<section class="t2c-section"><h2>${esc(block.title || 'Comparison')}</h2><div class="t2c-grid">${(block.items || []).map(x => `<article class="t2c-card"><h3>${esc(x.title || x.label || '')}</h3><p>${esc(x.body || x.description || '')}</p></article>`).join('')}</div></section>`;
  if (block.type === 'table') {
    const headers = block.headers || block.columns || [];
    const rows = block.rows || [];
    return `<section class="t2c-section"><h2>${esc(block.title || 'Reference table')}</h2><div class="t2c-table"><table>${headers.length ? `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${(Array.isArray(r) ? r : Object.values(r)).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }
  if (block.type === 'activity') return `<section class="t2c-section t2c-card"><h2>${esc(block.title || 'Practice')}</h2><p>${esc(block.prompt || block.body || block.instructions || '')}</p></section>`;
  if (block.type === 'document') return `<section class="t2c-section t2c-card"><h2>${esc(block.title || 'Document practice')}</h2><p>${esc(block.body || block.prompt || '')}</p></section>`;
  if (block.type === 'image' && (block.src || block.url)) return `<figure class="t2c-section"><img src="${esc(block.src || block.url)}" alt="${esc(block.alt || '')}" loading="lazy" style="max-width:100%;height:auto;border-radius:14px"><figcaption>${esc(block.caption || '')}</figcaption></figure>`;
  return '';
}

function renderLesson(course, lesson, index) {
  const c = lesson.content || {};
  const vocab = (c.vocabulary || []).map(v => `<div><strong>${esc(v.term)}</strong><p>${esc(v.definition)}</p></div>`).join('');
  const sections = (c.sections || []).map(s => `<section class="t2c-section"><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></section>`).join('');
  const examples = (c.workedExamples || []).length ? `<section class="t2c-section t2c-panel"><h2>Worked examples</h2><ul>${c.workedExamples.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : '';
  const mistakes = (c.commonMistakes || []).length ? `<section class="t2c-section t2c-panel"><h2>Common mistakes</h2><ul>${c.commonMistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : '';
  const blocks = (c.blocks || []).map(renderBlock).join('');
  const nav = [];
  if (index > 0) nav.push(`<a class="t2c-btn" href="${course.route}lesson-${String(index).padStart(2, '0')}/">← Previous lesson</a>`);
  if (index < course.lessons.length - 1) nav.push(`<a class="t2c-btn primary" href="${course.route}lesson-${String(index + 2).padStart(2, '0')}/">Next lesson →</a>`);
  return shell(`${crumbs(course, `Lesson ${index + 1}`)}<div class="t2c-mobile-progress" role="status" aria-label="Lesson ${index + 1} of ${course.lessons.length}"><span>Lesson ${index + 1} of ${course.lessons.length}</span><div><i style="width:${Math.round(((index + 1) / course.lessons.length) * 100)}%"></i></div></div><div class="t2c-layout"><div><header class="t2c-hero"><span class="t2c-k">Technician II · Course ${course.number} · Lesson ${index + 1}</span><h1>${esc(lesson.title)}</h1><p>${esc(c.overview)}</p><div class="t2c-meta"><span class="t2c-pill">${esc(lesson.estimatedMinutes || '')} min</span><span class="t2c-pill">${esc((lesson.learningObjectives || []).length)} objectives</span></div></header><section class="t2c-section t2c-objectives"><h2>Learning objectives</h2><ul>${(lesson.learningObjectives || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>${vocab ? `<section class="t2c-section"><h2>Key vocabulary</h2><div class="t2c-vocab">${vocab}</div></section>` : ''}${sections}${examples}${mistakes}${blocks}${c.practicalApplication ? `<section class="t2c-section t2c-panel"><h2>Practical application</h2><p>${esc(c.practicalApplication)}</p></section>` : ''}<section class="t2c-section t2c-panel"><h2>Lesson summary</h2><p>${esc(c.summary)}</p></section><div class="t2c-nav t2c-lesson-nav"><span class="t2c-lesson-count">Lesson ${index + 1} of ${course.lessons.length}</span>${nav.join('')}</div><div class="t2c-boundary"><strong>Training boundary:</strong> this public lesson is academic learning only. It does not validate a Technician II practical, authorize a professional credential decision, or issue certification.</div></div>${outline(course, `lesson-${index + 1}`)}</div>`);
}

function assessmentRoute(course, assessment) {
  if (assessment.purpose === 'summative') return { slug: 'course-assessment', label: 'Course assessment' };
  if (course.number === 8) return { slug: 'readiness-check', label: 'Readiness check' };
  return { slug: 'knowledge-check', label: 'Knowledge check' };
}
function renderAssessment(course, assessment, label) {
  if (assessment.purpose === 'summative') {
    return shell(`${crumbs(course, label)}<div class="t2c-layout"><div><header class="t2c-hero"><span class="t2c-k">Technician II · Course ${course.number} · ${esc(label)}</span><h1>${esc(assessment.title)}</h1><p>This final is graded by the authenticated assessment system after submission. Public answer keys and self-verification are disabled.</p></header><div class="t2c-boundary"><strong>Graded assessment:</strong> responses are saved to the learner attempt, the server enforces the timer, and the result is written to the learner record. <a href="/learn/academy/?course=${encodeURIComponent(course.course.id)}&amp;view=final">Open this graded final in the Academy →</a></div></div>${outline(course)}</div>`);
  }
  const qs = assessment.items.map((q, i) => `<article class="t2c-q"><h3>${i + 1}. ${esc(q.stem)}</h3><ol type="A">${q.choices.map(x => `<li>${esc(x)}</li>`).join('')}</ol><details><summary>Check answer and rationale</summary><p><strong>Answer:</strong> ${String.fromCharCode(65 + q.correct)}. ${esc(q.choices[q.correct])}</p>${q.rationale ? `<p>${esc(q.rationale)}</p>` : ''}</details></article>`).join('');
  return shell(`${crumbs(course, label)}<div class="t2c-layout"><div><header class="t2c-hero"><span class="t2c-k">Technician II · Course ${course.number} · ${esc(label)}</span><h1>${esc(assessment.title)}</h1><p>Answer each item before opening its rationale. Use missed items to identify which lesson evidence you should revisit.</p></header><div class="t2c-boundary"><strong>Formative learning check:</strong> this self-check is for study only and does not create a graded certification record.</div><section class="t2c-section">${qs}</section></div>${outline(course)}</div>`);
}
function renderIndex(course) {
  const lessonCards = course.lessons.map((l, i) => `<article class="t2c-card"><span class="t2c-k" style="color:#47755a">Lesson ${i + 1}</span><h3>${esc(l.title)}</h3><p>${esc(l.content?.overview || '')}</p><a class="t2c-btn primary" href="${course.route}lesson-${String(i + 1).padStart(2, '0')}/">Open lesson →</a></article>`).join('');
  const assessmentCards = course.assessments.map(a => { const route = assessmentRoute(course, a); return `<article class="t2c-card"><span class="t2c-k" style="color:#47755a">${esc(route.label)}</span><h3>${esc(a.title)}</h3><p>${a.items.length} public learning items. Answers and rationales are for study, not credential scoring.</p><a class="t2c-btn" href="${course.route}${route.slug}/">Open ${esc(route.label.toLowerCase())} →</a></article>`; }).join('');
  return shell(`${crumbs(course)}<header class="t2c-hero"><span class="t2c-k">THC Cultivation Technician II · Course ${course.number}</span><h1>${esc(course.course.title)}</h1><p>${esc(course.course.description)}</p><div class="t2c-meta"><span class="t2c-pill">${course.lessons.length} lessons</span><span class="t2c-pill">${course.itemCount} public learning items</span><span class="t2c-pill">Technician I prerequisite pathway</span></div></header><section class="t2c-section t2c-panel"><h2>What you will learn</h2><ul>${(course.course.learningOutcomes || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section><section class="t2c-section"><h2>Lessons</h2><div class="t2c-grid">${lessonCards}</div></section><section class="t2c-section"><h2>Learning assessments</h2><div class="t2c-grid">${assessmentCards}</div></section><div class="t2c-boundary"><strong>Public professional training:</strong> this course is open for academic study. Technician II professional certification still requires separately validated practical/capstone evidence, secure assessment controls, human review, calibration, standard setting and explicit release approval.</div>`);
}
function renderProgram(courses) {
  const cards = courses.map(c => `<article class="t2c-card"><span class="t2c-k" style="color:#47755a">Course ${c.number}</span><h3>${esc(c.course.title)}</h3><p>${esc(c.course.description)}</p><div class="t2c-meta"><span class="t2c-pill">${c.lessons.length} lessons</span><span class="t2c-pill">${c.itemCount} learning items</span></div><a class="t2c-btn primary" href="${c.route}">Open Course ${c.number} →</a></article>`).join('');
  return shell(`<nav class="t2c-nav" aria-label="Learning Hub breadcrumb"><a href="/courses/">Courses</a><span class="t2c-pill">Technician II</span></nav><header class="t2c-hero"><span class="t2c-k">Advanced professional training pathway</span><h1>${esc(config.program.title)}</h1><p>Eight public academic courses focused on evidence-based troubleshooting, verification, coordination and supervised performance preparation. Complete the Technician I prerequisite pathway before using Technician II as an advanced sequence.</p><div class="t2c-meta"><span class="t2c-pill">8 courses</span><span class="t2c-pill">32 dedicated lessons</span><span class="t2c-pill">268 public learning items</span></div></header><section class="t2c-section"><h2>Technician II course sequence</h2><div class="t2c-program">${cards}</div></section><div class="t2c-boundary"><strong>Credential boundary:</strong> public course access is not professional certification issuance. Operational practical/capstone forms and credential decisions remain restricted until validation and governance gates are complete.</div>`);
}

async function wp(endpoint, options = {}) {
  must(auth, 'WordPress credentials are required.');
  const response = await fetchRetry(`${site}/wp-json/wp/v2/${endpoint.replace(/^\//, '')}`, {
    ...options,
    headers: { Authorization: auth, 'Content-Type': 'application/json', ...(options.headers || {}) },
  }, `WordPress ${endpoint}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
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
  must(courses.every(c => c.lessons.length === 4), 'Every Technician II public package must resolve four dedicated lessons.');
  must(courses.filter(c => c.number < 8).every(c => c.assessments.length === 2), 'Technician II Courses 1-7 require formative and summative learning assessments.');
  must(courses.find(c => c.number === 8)?.assessments.length === 1, 'Technician II Course 8 requires one public readiness assessment only.');
  must(courses.reduce((sum, c) => sum + c.itemCount, 0) === 268, 'Technician II public package must resolve 268 learning items.');
  console.log(JSON.stringify({ result: 'success', courses: courses.map(c => ({ id: c.id, route: c.route, lessons: c.lessons.length, assessments: c.assessments.length, items: c.itemCount })) }, null, 2));
  process.exit(0);
}
if (!apply) { console.log('Validation passed. Set APPLY_TECH2_PUBLIC_COURSES=true to publish.'); process.exit(0); }

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
  program = await upsertPage({ slug: config.program.slug, title: config.program.title, parent: hub.id, content: renderProgram(courses), excerpt: 'Advanced eight-course Technician II academic training pathway.' });
} else {
  program = await upsertPage({ slug: config.program.slug, title: config.program.title, parent: program.parent, content: renderProgram(courses), excerpt: 'Advanced eight-course Technician II academic training pathway.' });
}

const published = [];
for (const course of courses) {
  const root = await upsertPage({ slug: course.slug, title: `Course ${course.number} — ${course.course.title}`, parent: program.id, content: renderIndex(course), excerpt: course.course.description });
  for (let i = 0; i < course.lessons.length; i++) await upsertPage({ slug: `lesson-${String(i + 1).padStart(2, '0')}`, title: `Course ${course.number} Lesson ${i + 1} — ${course.lessons[i].title}`, parent: root.id, content: renderLesson(course, course.lessons[i], i) });
  for (const assessment of course.assessments) {
    const route = assessmentRoute(course, assessment);
    await upsertPage({ slug: route.slug, title: `Course ${course.number} ${route.label} — ${assessment.title}`, parent: root.id, content: renderAssessment(course, assessment, route.label) });
  }
  published.push({ courseId: course.id, pageId: root.id, route: course.route, lessons: course.lessons.length, assessments: course.assessments.length, items: course.itemCount });
}
await mkdir(backupRoot, { recursive: true });
await writeFile(join(backupRoot, 'publication-result.json'), JSON.stringify({ publishedAt: new Date().toISOString(), published }, null, 2));
console.log(JSON.stringify({ result: 'success', published }, null, 2));
