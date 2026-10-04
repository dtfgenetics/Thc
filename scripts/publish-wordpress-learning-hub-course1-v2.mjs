import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_LEARNING_HUB_COURSE1 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-hub-course1';
const packagePath = process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json';
const local = JSON.parse(await readFile(packagePath, 'utf8'));
const sourceRepo = local.source.repository;
const configuredSourceRef = local.source.ref || 'main';
const sourceRef = String(process.env.THC_LEARNING_SOURCE_SHA || configuredSourceRef).trim();
if (process.env.THC_LEARNING_SOURCE_SHA && !/^[0-9a-f]{40}$/i.test(sourceRef)) throw new Error('THC_LEARNING_SOURCE_SHA must be a full 40-character Git commit SHA.');
const rawBase = `https://raw.githubusercontent.com/${sourceRepo}/${encodeURIComponent(sourceRef)}`;
const releaseManifestPath = 'content/public-releases/PUBLIC-RELEASE-LH-TECH1-001.json';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const must = (value, message) => { if (!value) throw new Error(message); };
const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');

function validateLocalPackage(data) {
  must(data?.schemaVersion === 1 && data?.id === 'learning-hub-course1', 'Invalid Course 1 site package identity.');
  must(data.publicationState === 'publish', 'Course 1 site package must be publish state.');
  must(data.course?.id === 'COURSE-LH-TECH1-001', 'Unexpected Course 1 ID.');
  must(Array.isArray(data.modules) && data.modules.length === 6, 'Course 1 requires six modules.');
  must(Array.isArray(data.learnerDocuments) && data.learnerDocuments.length >= 3, 'Course 1 requires learner documents.');
  const requiredLearnerDocs = new Set(['workbook', 'workbook-templates', 'integrated-practical']);
  const learnerDocSlugs = new Set(data.learnerDocuments.map((document) => document?.slug).filter(Boolean));
  for (const slug of requiredLearnerDocs) must(learnerDocSlugs.has(slug), `Course 1 requires learner document '${slug}'.`);
  must(learnerDocSlugs.size === data.learnerDocuments.length, 'Course 1 learner document slugs must be unique.');
  must(data.finalAssessment === 'ASSESS-LH-TECH1-001-FINAL', 'Unexpected final Course 1 assessment.');
  must(!/\b(draft|preview|tbd|todo|lorem ipsum|not approved)\b/i.test(JSON.stringify(data)), 'Site package contains unfinished public wording.');
}
validateLocalPackage(local);

async function fetchText(url) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'DTF-Learning-Hub-Course1/3.0' }
      });
      if (response.ok) return response.text();
      last = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      last = error;
    }
    if (attempt < 6) await sleep(attempt * 800);
  }
  throw last;
}

async function fetchJson(relativePath) {
  return JSON.parse(await fetchText(`${rawBase}/${relativePath}`));
}

async function fetchLearner(relativePath) {
  return fetchText(`${rawBase}/${local.source.basePath}/${relativePath}`);
}

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = '';
  let table = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = '';
    }
  };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((row, index) => !(index === 1 && row.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))));
    if (rows.length) {
      out.push('<div class="lh1-table"><table><thead><tr>' + rows[0].map((cell) => `<th scope="col">${inline(cell.trim())}</th>`).join('') + '</tr></thead><tbody>');
      for (const row of rows.slice(1)) out.push('<tr>' + row.map((cell) => `<td>${inline(cell.trim())}</td>`).join('') + '</tr>');
      out.push('</tbody></table></div>');
    }
    table = [];
  };
  const flush = () => { flushParagraph(); flushList(); flushTable(); };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      flushParagraph();
      flushList();
      table.push(line.slice(1, -1).split('|'));
      continue;
    }
    if (table.length) flushTable();
    if (!line) { flushParagraph(); flushList(); continue; }
    if (/^---+$/.test(line)) { flush(); out.push('<hr>'); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      const level = Math.min(5, Math.max(2, heading[1].length + 1));
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (list !== 'ul') { flushList(); list = 'ul'; out.push('<ul>'); }
      out.push(`<li>${inline(unordered[1])}</li>`);
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (list !== 'ol') { flushList(); list = 'ol'; out.push('<ol>'); }
      out.push(`<li>${inline(ordered[1])}</li>`);
      continue;
    }
    if (line.startsWith('>')) {
      flush();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return out.join('\n');
}

const unfinished = /\b(tbd|todo|lorem ipsum|not approved for public release|draft production package|preview only)\b/i;
function validateLearnerSource(text, label) {
  must(text.trim().length >= 900, `${label}: learner source is too short.`);
  must(!unfinished.test(text), `${label}: unfinished release wording found in public source.`);
}

const css = `<style id="dtf-learning-hub-course1-style">.lh1{--f:#102a19;--g:#1f6a3b;--lime:#d6ec77;--gold:#d9be74;--ink:#193422;--muted:#586d60;--line:#d9e5db;background:linear-gradient(180deg,#fafbf7,#eef5ef);color:var(--ink);padding:54px 0 76px}.lh1 *{box-sizing:border-box}.lh1-wrap{width:min(1120px,calc(100% - 32px));margin:auto}.lh1-hero{display:grid;grid-template-columns:1.2fr .8fr;gap:24px}.lh1 h1{font-size:clamp(2.5rem,6vw,5rem);letter-spacing:-.05em;line-height:1;margin:.18em 0}.lh1 h2{font-size:clamp(1.7rem,3vw,2.6rem);line-height:1.1;margin-top:1.45em}.lh1 h3{line-height:1.18}.lh1 p,.lh1 li{line-height:1.72}.lh1 p{color:var(--muted)}.lh1 a{color:#176739;font-weight:850}.lh1-k{font-size:.76rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#6e5d27}.lh1-card,.lh1-content,.lh1-test,.lh1 details{background:#fff;border:1px solid var(--line);border-radius:16px}.lh1-card{padding:18px}.lh1-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.lh1-content{padding:clamp(20px,4vw,42px);margin-top:20px}.lh1-summary{padding:22px;background:#fff;border:1px solid var(--line);border-radius:16px}.lh1-summary strong{display:block;font-size:2rem;color:var(--g)}.lh1-nav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.lh1-nav a{background:#fff;border:1px solid var(--line);border-radius:999px;padding:9px 13px;text-decoration:none}.lh1-boundary{padding:16px 18px;border-left:5px solid var(--gold);background:#fff8e7;border-radius:10px;margin:20px 0}.lh1-test{padding:18px;margin:12px 0}.lh1-answer{margin-top:10px;padding:0 14px}.lh1-answer summary{cursor:pointer;font-weight:900;padding:12px 0}.lh1-table{overflow-x:auto}.lh1 table{border-collapse:collapse;width:100%;min-width:620px}.lh1 th,.lh1 td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.lh1 th{background:#eef5ef}.lh1 blockquote{border-left:4px solid var(--gold);margin:18px 0;padding:10px 18px;background:#fff9e9}.lh1-footer{margin-top:34px;padding:24px;border-radius:18px;background:linear-gradient(145deg,var(--f),#2b4d31);color:#fff}.lh1-footer p{color:#dce8df}.lh1-footer a{color:var(--lime)}.lh1 :focus-visible{outline:3px solid #0b64c0;outline-offset:3px}@media(max-width:850px){.lh1-hero,.lh1-grid{grid-template-columns:1fr}}@media print{.lh1-nav,.lh1-footer{display:none}.lh1{background:#fff;padding:0}}</style>`;
const shell = (body) => `${css}<main class="lh1"><div class="lh1-wrap">${body}<footer class="lh1-footer"><h2>Continue in the Learning Hub</h2><p>Course learning assessments are separate from the secure certification examination.</p><p><a href="/learn/learning-hub/">Learning Hub</a> · <a href="/learn/">Teaching Healthy Cultivation</a> · <a href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">THC Community</a></p></footer></div></main>`;
const crumb = (extra = '') => `<nav class="lh1-nav" aria-label="Learning Hub breadcrumb"><a href="/learn/">Learn</a><a href="/learn/learning-hub/">Learning Hub</a><a href="${esc(local.program.route)}">${esc(local.program.title)}</a>${extra}</nav>`;

async function loadSources() {
  const release = await fetchJson(releaseManifestPath);
  must(release.id === 'PUBLIC-RELEASE-LH-TECH1-001' && release.courseId === local.course.id && release.publicationState === 'published', 'Canonical Course 1 public-release manifest is missing or not published.');
  must(Number.isInteger(release.publicScope?.publicCourseItems) && release.publicScope.publicCourseItems > 0, 'Canonical public release must declare a positive public-course item count.');

  const expectedAssessments = [...local.modules.map((module) => module.assessment), local.finalAssessment];
  must(JSON.stringify(release.publicScope.assessments) === JSON.stringify(expectedAssessments), 'Site assessment scope differs from canonical public-release manifest.');

  const expectedSources = [
    ...local.modules.map((module) => `${local.source.basePath}/${module.source}`),
    ...local.learnerDocuments.map((document) => `${local.source.basePath}/${document.source}`)
  ];
  for (const source of expectedSources) must(release.publicScope.studentSources.includes(source), `Public source not authorized by release manifest: ${source}`);

  const modules = [];
  for (const module of local.modules) {
    const markdown = await fetchLearner(module.source);
    validateLearnerSource(markdown, module.title);
    modules.push({ ...module, html: markdownToHtml(markdown) });
  }

  const docs = [];
  for (const document of local.learnerDocuments) {
    const markdown = await fetchLearner(document.source);
    validateLearnerSource(markdown, document.title);
    docs.push({ ...document, html: markdownToHtml(markdown) });
  }

  const assessments = [];
  let itemCount = 0;
  for (const assessmentId of expectedAssessments) {
    const assessment = await fetchJson(`content/assessments/${assessmentId}.json`);
    must(assessment?.id === assessmentId, `${assessmentId}: assessment identity mismatch.`);
    must(['formative', 'summative'].includes(assessment.purpose), `${assessmentId}: credential assessment blocked from public release.`);
    must(Array.isArray(assessment.items) && assessment.items.length > 0, `${assessmentId}: public assessment contains no items.`);
    must(new Set(assessment.items).size === assessment.items.length, `${assessmentId}: duplicate item references are not allowed.`);

    const items = [];
    for (const itemId of assessment.items) {
      const question = await fetchJson(`content/questions/${itemId}.json`);
      must(['formative', 'summative'].includes(question.purpose), `${itemId}: credential-purpose item blocked.`);
      must(Array.isArray(question.choices) && question.choices.length >= 2 && Number.isInteger(question.correct), `${itemId}: unsupported public item format.`);
      items.push(question);
      itemCount++;
    }
    assessments.push({ ...assessment, items });
  }

  must(itemCount === release.publicScope.publicCourseItems, `Public Course 1 item count ${itemCount} must match release manifest ${release.publicScope.publicCourseItems}.`);
  return { release, modules, docs, assessments, publicItemCount: itemCount };
}

function renderTest(assessment, label) {
  const target = Number(assessment.passingScorePercent || local.course.masteryTarget || 80);
  if (assessment.purpose === 'summative') {
    return shell(`${crumb(`<a href="${esc(local.course.route)}">Course 1</a>`)}<p class="lh1-k">${esc(label)}</p><h1>${esc(assessment.title)}</h1><div class="lh1-boundary"><strong>Graded assessment:</strong> final-test answers and rationales are not exposed on this public page. The authenticated assessment runtime records each response, enforces the attempt timer, grades after submission, and writes the result to the learner record.</div><section class="lh1-content"><h2>Take the graded final</h2><p>This ${assessment.items.length}-item final uses a ${assessment.timeLimitMinutes || 60}-minute timed attempt. Sign in through the Academy assessment portal to begin or resume your saved attempt.</p><p><a href="/learn/academy/?course=${encodeURIComponent(local.course.id)}&amp;view=final">Open this graded final in the Academy →</a></p><p><strong>Current academic threshold:</strong> ${target}%.</p></section>`);
  }
  const questions = assessment.items.map((question, index) => `<article class="lh1-test"><h3>${index + 1}. ${esc(question.stem)}</h3><ol type="A">${question.choices.map((choice) => `<li>${esc(choice)}</li>`).join('')}</ol><details class="lh1-answer"><summary>Check answer and rationale</summary><p><strong>Answer:</strong> ${String.fromCharCode(65 + question.correct)}. ${esc(question.choices[question.correct])}</p><p>${esc(question.rationale)}</p></details></article>`).join('');
  return shell(`${crumb(`<a href="${esc(local.course.route)}">Course 1</a>`)}<p class="lh1-k">${esc(label)}</p><h1>${esc(assessment.title)}</h1><p>Complete the questions before opening the answer panels. Then review every missed rationale.</p><div class="lh1-boundary"><strong>Course mastery target: ${target}%.</strong> This is a formative learning test.</div>${questions}`);
}

function courseIndex(sources) {
  const cards = sources.modules.map((module) => `<article class="lh1-card"><p class="lh1-k">Module ${module.number}</p><h3>${esc(module.title)}</h3><p><a href="${local.course.route}${module.slug}/">Open module →</a></p><p><a href="${local.course.route}test-module-${module.number}/">Take module test →</a></p></article>`).join('');
  const documents = sources.docs.map((document) => `<li><a href="${local.course.route}${document.slug}/">${esc(document.title)}</a></li>`).join('');
  const finalAssessment = sources.assessments.find((assessment) => assessment.id === local.finalAssessment);
  const finalCount = finalAssessment?.items?.length || 0;
  return shell(`${crumb()}<section class="lh1-hero"><div><p class="lh1-k">THC Cultivation Technician I · Course 1</p><h1>${esc(local.course.title)}</h1><p>${esc(local.course.purpose)}</p></div><aside class="lh1-summary"><strong>${sources.modules.length}</strong> researched modules<br><strong>${sources.publicItemCount}</strong> public course-test items<br><strong>1</strong> integrated practical<p>${esc(local.course.estimatedLearningTime)}</p></aside></section><div class="lh1-boundary"><strong>Finished public learner course.</strong> This page contains the released Course 1 instruction, workbook, practical, module tests, and final course test. The secure certification examination is separate.</div><h2>Course modules</h2><div class="lh1-grid">${cards}</div><section class="lh1-content"><h2>Learner documents</h2><ul>${documents}</ul><h2>Final course test</h2><p><a href="${local.course.route}final-course-test/">Take the ${finalCount}-item final course test →</a></p><h2>Completion sequence</h2><ol><li>Study Modules 1–6 in order.</li><li>Complete each module test and review missed rationales.</li><li>Complete workbook activities and the integrated practical.</li><li>Complete the final course test and remediate weak domains.</li><li>Continue through the Cultivation Technician I learning path before the separate certification assessment.</li></ol></section>`);
}

function modulePage(module) {
  return shell(`${crumb(`<a href="${local.course.route}">Course 1</a>`)}<p class="lh1-k">Course 1 · Module ${module.number}</p><h1>${esc(module.title)}</h1><p><a href="${local.course.route}test-module-${module.number}/">Take the Module ${module.number} learning test →</a></p><article class="lh1-content">${module.html}</article>`);
}

function docPage(document) {
  return shell(`${crumb(`<a href="${local.course.route}">Course 1</a>`)}<p class="lh1-k">Course 1 learner document</p><h1>${esc(document.title)}</h1><article class="lh1-content">${document.html}</article>`);
}

if (validateOnly) {
  console.log(JSON.stringify({ valid: true, id: local.id, course: local.course.id, modules: local.modules.length, learnerDocuments: local.learnerDocuments.length, countContract: 'canonical-release-driven' }, null, 2));
  process.exit(0);
}

must(apply, 'Set APPLY_LEARNING_HUB_COURSE1=true to publish.');
must(user && pass, 'WordPress application credentials are required.');
const sources = await loadSources();
const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

async function wp(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTF-Learning-Hub-Course1/3.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 8) {
        await sleep(attempt * 1200);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 8) await sleep(attempt * 1200);
    }
  }
  throw last;
}

async function children(slug, parent) {
  const rows = await wp(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`);
  return Array.isArray(rows) ? rows.filter((page) => Number(page.parent) === Number(parent)) : [];
}

const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `course1-${stamp}`);
await mkdir(backupDir, { recursive: true });

async function upsert({ slug, title, parent, content }) {
  const rows = await children(slug, parent);
  must(rows.length <= 1, `Duplicate page '${slug}' under parent ${parent}`);
  if (rows.length) {
    await writeFile(join(backupDir, `page-${rows[0].id}-${slug}-before.json`), `${JSON.stringify(rows[0], null, 2)}\n`);
    return wp(`/wp-json/wp/v2/pages/${rows[0].id}`, { method: 'POST', body: JSON.stringify({ title, slug, parent, status: 'publish', content }) });
  }
  return wp('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify({ title, slug, parent, status: 'publish', content }) });
}

const learnRows = await wp('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=20');
must(Array.isArray(learnRows) && learnRows.length === 1, 'Expected one canonical /learn/ page.');
const learn = learnRows[0];
await writeFile(join(backupDir, `page-${learn.id}-learn-before.json`), `${JSON.stringify(learn, null, 2)}\n`);

const hub = await upsert({
  slug: 'learning-hub',
  title: 'THC Learning Hub',
  parent: learn.id,
  content: shell(`<nav class="lh1-nav"><a href="/learn/">← Learn</a></nav><section class="lh1-hero"><div><p class="lh1-k">Teaching Healthy Cultivation</p><h1>THC Learning Hub</h1><p>Purpose-built professional learning paths connect the 420 Comprehensive Educational Resources to applied coursework, practicals, course tests, and the separate THC Academy credential system.</p></div><aside class="lh1-summary"><strong>8</strong> professional certification pathways<p>The Learning Hub contains the dedicated coursework used to prepare for those credentials.</p></aside></section><section class="lh1-content"><h2>Available professional path</h2><h3><a href="${local.program.route}">${esc(local.program.title)}</a></h3><p>Begin with workplace safety, biosecurity, controlled workflows, traceability, equipment boundaries, records, and handoff practice.</p></section>`)
});

const program = await upsert({
  slug: local.program.slug,
  title: local.program.title,
  parent: hub.id,
  content: shell(`<nav class="lh1-nav"><a href="/learn/">Learn</a><a href="/learn/learning-hub/">Learning Hub</a></nav><p class="lh1-k">Professional learning path</p><h1>${esc(local.program.title)}</h1><section class="lh1-content"><h2>Start the sequence</h2><p><a href="${local.course.route}"><strong>Course 1: ${esc(local.course.title)} →</strong></a></p><p>Additional Technician I courses are published one at a time after their complete learner packages and course assessments are finished.</p></section>`)
});

const course = await upsert({ slug: local.course.slug, title: local.course.title, parent: program.id, content: courseIndex(sources) });
const pages = [{ type: 'hub', id: hub.id }, { type: 'program', id: program.id }, { type: 'course', id: course.id }];

for (const module of sources.modules) {
  const page = await upsert({ slug: module.slug, title: `Module ${module.number}: ${module.title}`, parent: course.id, content: modulePage(module) });
  pages.push({ type: 'module', number: module.number, id: page.id });
}

for (const document of sources.docs) {
  const page = await upsert({ slug: document.slug, title: document.title, parent: course.id, content: docPage(document) });
  pages.push({ type: 'document', slug: document.slug, id: page.id });
}

for (let index = 0; index < local.modules.length; index++) {
  const assessment = sources.assessments[index];
  const moduleNumber = index + 1;
  const page = await upsert({
    slug: `test-module-${moduleNumber}`,
    title: `Module ${moduleNumber} Learning Test`,
    parent: course.id,
    content: renderTest(assessment, `Course 1 · Module ${moduleNumber} learning test`)
  });
  pages.push({ type: 'module-test', number: moduleNumber, id: page.id, itemCount: assessment.items.length });
}

const finalAssessment = sources.assessments.find((assessment) => assessment.id === local.finalAssessment);
must(finalAssessment, 'Final assessment missing.');
const final = await upsert({
  slug: 'final-course-test',
  title: 'Course 1 Final Course Test',
  parent: course.id,
  content: renderTest(finalAssessment, 'Course 1 · Final course test')
});
pages.push({ type: 'final-test', id: final.id, itemCount: finalAssessment.items.length });

const start = '<!-- DTF_LEARNING_HUB_COURSE1_START -->';
const end = '<!-- DTF_LEARNING_HUB_COURSE1_END -->';
const block = `${start}<section id="thc-learning-hub-course1"><h2>Professional certification learning paths</h2><p>The THC Learning Hub contains purpose-built professional courses, practicals, and course tests. Start with <a href="${local.course.route}"><strong>Cultivation Technician I — Course 1: ${esc(local.course.title)}</strong></a>.</p></section>${end}`;
let learnContent = rendered(learn.content);
const blockPattern = new RegExp(`${start}[\\s\\S]*?${end}`);
learnContent = blockPattern.test(learnContent) ? learnContent.replace(blockPattern, block) : `${learnContent}\n${block}`;
await wp(`/wp-json/wp/v2/pages/${learn.id}`, { method: 'POST', body: JSON.stringify({ status: 'publish', content: learnContent }) });

const report = {
  generatedAt: new Date().toISOString(),
  sourceRelease: sources.release.id,
  sourceCourse: local.course.id,
  publicItems: sources.publicItemCount,
  assessmentItemCounts: sources.assessments.map((assessment) => ({ id: assessment.id, items: assessment.items.length })),
  pages,
  backupDir
};
await writeFile(join(backupDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
