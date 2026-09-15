import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_CERTIFICATION_CATALOG_V4 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const dataPath = process.env.CERTIFICATION_CATALOG_PATH || 'site/wordpress/education/course-catalog-v4.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-certification-catalog-v4';
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const must = (value, message) => { if (!value) throw new Error(message); };
const rendered = value => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');

must(data.schemaVersion === 4 && data.id === 'dtf-courses-catalog-v4', 'Unexpected certification catalog schema.');
must(Array.isArray(data.credentialSections) && data.credentialSections.length === 4, 'Four credential sections are required.');
must(Array.isArray(data.courses) && data.courses.length === 15, `Expected all 15 Technician I/II courses to be visible, found ${data.courses?.length ?? 0}.`);
const expectedCourseIds = [...Array.from({length:7},(_,i)=>`COURSE-LH-TECH1-00${i+1}`), ...Array.from({length:8},(_,i)=>`COURSE-LH-TECH2-00${i+1}`)];
must(expectedCourseIds.every(id => data.courses.some(course => course.id === id)), 'Certification catalog is missing one or more canonical Technician I/II course IDs.');
must(new Set(data.courses.map(course => course.id)).size === 15, 'Certification catalog course IDs must be unique.');
must(data.courses.filter(course => course.publicLessonReleaseAvailable === true).length === 1, 'Exactly one course is currently released as a public academic page.');
must(data.courses.every(course => course.publicLessonReleaseAvailable === true || !course.href), 'Unreleased courses must not publish a live course href.');
const pendingCourses = data.courses.filter(course => course.publicLessonReleaseAvailable !== true);
must(pendingCourses.length === 14, `Expected 14 visible pending course overviews, found ${pendingCourses.length}.`);
must(pendingCourses.every(course => course.overviewSlug && course.overviewHref && course.sourceDefinitionUrl && course.downloadDefinitionUrl && course.performanceEvidence && course.releaseRequirements), 'Every pending course requires overview routing, source/download links, performance evidence and release requirements.');
must(new Set(pendingCourses.map(course => course.overviewSlug)).size === 14, 'Pending course overview slugs must be unique.');
const offerings = data.credentialSections.flatMap(section => section.offerings || []);
must(offerings.length === 10, `Expected exactly 10 visible certificate/certification offerings, found ${offerings.length}.`);
must(offerings.every(item => item.title && item.type && item.status && item.statusLabel && item.summary), 'Every credential offering requires title, type, status, statusLabel, and summary.');
must(offerings.every(item => item.issuanceAvailable === false), 'No unfinished credential may be marked issuance-available.');
must(offerings.filter(item => item.status === 'in-development').length === 4, 'Expected four in-development offerings: two foundational certificates plus Technician I and II.');
must(offerings.filter(item => item.status === 'planned').length === 6, 'Expected six planned specialist/lead credentials.');
const tech1 = offerings.find(item => item.id === 'CREDPROG-CULT-TECH-I-001');
must(tech1?.availableCourse?.id === 'COURSE-LH-TECH1-001', 'Technician I must expose Course 1 as the current public academic course.');

const css = `<style id="dtf-courses-v4-style">
.dtf-courses-v4{--ink:#17271c;--muted:#5d6b61;--deep:#092116;--deep2:#143c27;--green:#1f6f3d;--green2:#2e8550;--paper:#fff;--soft:#f4f7f2;--line:#d7e2d8;--gold:#c7a24b;background:linear-gradient(180deg,#f8f6ef 0,#f2f6f1 100%);color:var(--ink);padding:28px 0 78px}.dtf-courses-v4 *{box-sizing:border-box}.dc4-wrap{width:min(1240px,calc(100% - 30px));margin:auto}.dc4-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(270px,.75fr);gap:26px;padding:clamp(30px,6vw,64px);border-radius:24px;background:radial-gradient(circle at 88% 12%,rgba(95,196,105,.16),transparent 34%),linear-gradient(135deg,var(--deep),var(--deep2));color:#fff;box-shadow:0 18px 50px rgba(13,44,26,.12)}.dc4-kicker{display:inline-flex;align-items:center;gap:8px;color:#a9dfaF;font-size:.76rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.dc4-kicker:before{content:"";width:22px;height:2px;background:#63cf71}.dc4-hero h1{margin:.18em 0 .26em;font-size:clamp(2.35rem,6vw,5rem);line-height:.98;letter-spacing:-.055em}.dc4-hero p{margin:0;color:#dce9df;font-size:1.02rem;line-height:1.72}.dc4-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.dc4-btn{display:inline-flex;min-height:46px;align-items:center;justify-content:center;padding:11px 16px;border:1px solid transparent;border-radius:10px;background:var(--green2);color:#fff!important;font-weight:850;text-decoration:none!important}.dc4-btn.secondary{background:transparent;border-color:rgba(255,255,255,.28)}.dc4-guide{padding:20px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(255,255,255,.06)}.dc4-guide strong{display:block;margin-bottom:8px}.dc4-guide p{font-size:.9rem;line-height:1.55}.dc4-section{margin-top:38px}.dc4-section-head{display:flex;justify-content:space-between;align-items:end;gap:22px;margin-bottom:14px}.dc4-section-head h2{margin:0;font-size:clamp(1.7rem,3vw,2.35rem);letter-spacing:-.025em}.dc4-section-head p{max-width:650px;margin:0;color:var(--muted);line-height:1.6}.dc4-pathway{margin-top:22px}.dc4-pathway h3{margin:0 0 5px;font-size:1.45rem}.dc4-pathway>p{margin:0 0 12px;color:var(--muted);line-height:1.55}.dc4-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.dc4-card{padding:20px;border:1px solid var(--line);border-radius:17px;background:var(--paper);box-shadow:0 10px 28px rgba(15,46,28,.045)}.dc4-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dc4-card-type{font-size:.76rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#54705d}.dc4-status{display:inline-flex;padding:6px 9px;border-radius:999px;background:#eef4ee;color:#285b38;font-size:.71rem;font-weight:900;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}.dc4-status.planned{background:#f4f1e9;color:#695b38}.dc4-card h4{margin:11px 0 8px;font-size:1.25rem;line-height:1.25}.dc4-card p{margin:0;color:var(--muted);line-height:1.62}.dc4-meta{margin-top:14px;color:#405147;font-size:.88rem}.dc4-available{display:inline-flex;margin-top:14px;color:#155f35;font-weight:850}.dc4-boundary{margin-top:18px;padding:15px 17px;border-left:5px solid var(--gold);border-radius:10px;background:#fff8e7;color:#554b2c;line-height:1.55}.dc4-course-list{display:grid;gap:14px}.dc4-course{display:grid;grid-template-columns:180px minmax(0,1fr);overflow:hidden;border:1px solid var(--line);border-radius:18px;background:var(--paper)}.dc4-course-rail{padding:20px;background:#10311f;color:#fff}.dc4-course-rail strong{display:block;margin-top:12px;line-height:1.35}.dc4-course-body{padding:24px}.dc4-course-body h3{margin:0;font-size:1.7rem}.dc4-course-body p{color:var(--muted);line-height:1.65}.dc4-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:16px 0}.dc4-metric{padding:12px;border:1px solid var(--line);border-radius:11px;background:var(--soft)}.dc4-metric strong{display:block;color:#185f36;font-size:1.2rem}.dc4-metric span{color:#657269;font-size:.78rem}.dc4-surfaces{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.dc4-surface{padding:19px;border:1px solid var(--line);border-radius:15px;background:#fff}.dc4-surface h3{margin:0 0 7px}.dc4-surface p{margin:0;color:var(--muted);line-height:1.58}.dc4-surface a{display:inline-block;margin-top:12px;color:#155f35;font-weight:850}.dtf-courses-v4 :focus-visible{outline:3px solid #1765a1;outline-offset:3px}
@media(max-width:900px){.dc4-hero{grid-template-columns:1fr}.dc4-grid{grid-template-columns:1fr}.dc4-surfaces{grid-template-columns:1fr}.dc4-course{grid-template-columns:145px minmax(0,1fr)}}
@media(max-width:650px){.dtf-courses-v4{padding-top:16px}.dc4-wrap{width:min(100% - 20px,1240px)}.dc4-hero{padding:24px 18px;border-radius:16px}.dc4-actions{display:grid;grid-template-columns:1fr}.dc4-btn{width:100%}.dc4-section-head{display:block}.dc4-section-head p{margin-top:8px}.dc4-card-head{display:block}.dc4-status{margin-top:9px}.dc4-course{grid-template-columns:1fr}.dc4-course-rail{padding:14px 18px}}
</style>`;

const actions = (data.primaryActions || []).map(action => `<a class="dc4-btn${action.style === 'secondary' ? ' secondary' : ''}" href="${esc(action.href)}">${esc(action.label)}</a>`).join('');
const credentialSections = data.credentialSections.map(section => `<section class="dc4-pathway" data-credential-section="${esc(section.id)}"><h3>${esc(section.title)}</h3><p>${esc(section.description)}</p><div class="dc4-grid">${section.offerings.map(item => `<article class="dc4-card" data-credential-offering="${esc(item.title)}" data-offering-status="${esc(item.status)}" data-issuance-available="${item.issuanceAvailable ? 'true' : 'false'}"><div class="dc4-card-head"><span class="dc4-card-type">${esc(item.type)}${item.plannedCourses ? ` · ${esc(item.plannedCourses)}-course pathway` : ''}</span><span class="dc4-status ${item.status === 'planned' ? 'planned' : ''}">${esc(item.statusLabel)}</span></div><h4>${esc(item.title)}</h4><p>${esc(item.summary)}</p>${item.availableCourse ? `<a class="dc4-available" href="${esc(item.availableCourse.href)}">${esc(item.availableCourse.label)} →</a>` : ''}</article>`).join('')}</div></section>`).join('');
const courses = data.courses.map(course => {
  const openAction = course.href && course.publicLessonReleaseAvailable === true
    ? `<div class="dc4-actions"><a class="dc4-btn" data-course-open="true" href="${esc(course.href)}">Open Course ${esc(course.number)}</a></div>`
    : `<p class="dc4-meta" data-course-open="false"><strong>Public release:</strong> ${esc(course.availabilityNote || 'Curriculum is visible, but the public academic page is not released yet.')}</p><div class="dc4-actions"><a class="dc4-btn" data-course-overview-link="true" href="${esc(course.overviewHref)}">View development overview</a></div>`;
  return `<article class="dc4-course" data-course-id="${esc(course.id)}" data-course-release="${course.publicLessonReleaseAvailable === true ? 'available' : 'pending'}"><aside class="dc4-course-rail"><span class="dc4-status">${esc(course.statusLabel || course.status)}</span><strong>${esc(course.pathLabel || '')}</strong></aside><div class="dc4-course-body"><h3>Course ${esc(course.number)} — ${esc(course.title)}</h3><p>${esc(course.summary)}</p><div class="dc4-metrics">${(course.metrics || []).map(metric => `<div class="dc4-metric"><strong>${esc(metric.value)}</strong><span>${esc(metric.label)}</span></div>`).join('')}</div>${openAction}</div></article>`;
}).join('');
const overviewCss = `<style id="dtf-course-overview-v1-style">.dtf-course-overview-v1{--ink:#17271c;--muted:#5d6b61;--deep:#0d2c1a;--green:#1f6f3d;--paper:#fff;--soft:#f4f7f2;--line:#d7e2d8;background:linear-gradient(180deg,#f8f6ef,#f2f6f1);color:var(--ink);padding:34px 0 70px}.dco-wrap{width:min(980px,calc(100% - 28px));margin:auto}.dco-hero{padding:clamp(26px,5vw,52px);border-radius:22px;background:linear-gradient(135deg,#0b2417,#17452b);color:#fff}.dco-kicker{font-size:.76rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#a9dfaf}.dco-hero h1{margin:.2em 0;font-size:clamp(2rem,5vw,4rem);line-height:1.02}.dco-hero p{color:#deebe1;line-height:1.7}.dco-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}.dco-panel{padding:22px;border:1px solid var(--line);border-radius:16px;background:var(--paper)}.dco-panel h2{margin-top:0}.dco-panel p,.dco-panel li{color:var(--muted);line-height:1.65}.dco-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:9px}.dco-metric{padding:12px;border-radius:10px;background:var(--soft);border:1px solid var(--line)}.dco-metric strong{display:block;color:var(--green);font-size:1.2rem}.dco-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.dco-btn{display:inline-flex;align-items:center;min-height:44px;padding:10px 15px;border-radius:9px;background:var(--green);color:#fff!important;text-decoration:none!important;font-weight:850}.dco-btn.secondary{background:#fff;color:var(--green)!important;border:1px solid var(--green)}.dco-boundary{margin-top:18px;padding:16px;border-left:5px solid #c7a24b;border-radius:10px;background:#fff8e7;color:#554b2c;line-height:1.6}@media(max-width:720px){.dco-grid{grid-template-columns:1fr}.dco-actions{display:grid}.dco-btn{width:100%;justify-content:center}}</style>`;
const renderOverview = course => `${overviewCss}<main class="dtf-course-overview-v1" data-dtf-course-development-overview="v1" data-course-id="${esc(course.id)}"><div class="dco-wrap"><section class="dco-hero"><span class="dco-kicker">Development overview · curriculum built</span><h1>${esc(course.pathLabel)} — Course ${esc(course.number)}<br>${esc(course.title)}</h1><p>${esc(course.summary)}</p><div class="dco-actions"><a class="dco-btn" href="/courses/">Back to Courses</a><a class="dco-btn secondary" href="${esc(course.sourceDefinitionUrl)}">View source definition</a><a class="dco-btn secondary" href="${esc(course.downloadDefinitionUrl)}" download>Download course JSON</a></div></section><section class="dco-grid"><article class="dco-panel"><h2>What is built</h2><div class="dco-metrics">${(course.metrics || []).map(metric => `<div class="dco-metric"><strong>${esc(metric.value)}</strong><span>${esc(metric.label)}</span></div>`).join('')}</div><p><strong>Performance evidence:</strong> ${esc(course.performanceEvidence)}</p></article><article class="dco-panel"><h2>Public release status</h2><p>${esc(course.availabilityNote || 'Curriculum is built; public lesson release remains pending review.')}</p><p>${esc(course.releaseRequirements)}</p></article></section><section class="dco-panel" style="margin-top:14px"><h2>Scope</h2><p>${esc(course.summary)}</p><p><strong>Source revision:</strong> <code>${esc(course.sourceRevision)}</code></p></section><div class="dco-boundary"><strong>Important:</strong> This page is a public development overview, not a released academic lesson tree and not credential evidence. Course learning assessments and professional credential examinations are separate systems; secure operational credential forms and answer keys are not published here.</div></div></main>`;
const overviewPages = pendingCourses.map(course => ({ course, content: renderOverview(course) }));
const surfaces = data.learningSurfaces.map(item => `<article class="dc4-surface"><h3>${esc(item.title)}</h3><p>${esc(item.copy)}</p><a href="${esc(item.href)}">Open ${esc(item.title)} →</a></article>`).join('');

const content = `${css}<main class="dtf-courses-v4" data-dtf-courses-catalog="v4"><div class="dc4-wrap"><section class="dc4-hero"><div><span class="dc4-kicker">${esc(data.eyebrow)}</span><h1>${esc(data.title)}</h1><p>${esc(data.intro)}</p><div class="dc4-actions">${actions}</div></div><aside class="dc4-guide"><strong>Visible does not mean released.</strong><p>The catalog shows the complete credential roadmap while keeping unfinished certifications clearly marked as in development or planned. Professional credential issuance remains blocked until the required validation and release evidence is complete.</p></aside></section><section class="dc4-section" aria-labelledby="dc4-certifications"><div class="dc4-section-head"><div><span class="dc4-kicker" style="color:#4c7759">Certification roadmap</span><h2 id="dc4-certifications">Certificates & professional certifications</h2></div><p>Two foundational certificates and eight professional credentials form the current THC Academy credential architecture.</p></div>${credentialSections}<div class="dc4-boundary"><strong>Credential boundary:</strong> No professional credential shown here is currently marked available for issuance. Course publication, course completion, and professional certification release are separate states.</div></section><section class="dc4-section" aria-labelledby="dc4-available"><div class="dc4-section-head"><div><span class="dc4-kicker" style="color:#4c7759">${esc(data.coursesSection?.eyebrow || "Technician curriculum")}</span><h2 id="dc4-available">${esc(data.coursesSection?.title || "Technician I & II courses")}</h2></div><p>${esc(data.coursesSection?.intro || "All built technician courses remain visible even when their public academic pages are still pending release review.")}</p></div><div class="dc4-course-list">${courses}</div></section><section class="dc4-section" aria-labelledby="dc4-surfaces"><div class="dc4-section-head"><h2 id="dc4-surfaces">Know where you are learning</h2></div><div class="dc4-surfaces">${surfaces}</div><div class="dc4-boundary"><strong>Assessment boundary:</strong> ${esc(data.assessmentNote)}</div></section></div></main>`;

if (validateOnly) {
  must(content.includes('data-dtf-courses-catalog="v4"'), 'Courses V4 marker missing.');
  must((content.match(/data-credential-offering=/g) || []).length === 10, 'Rendered catalog must contain exactly 10 credential offerings.');
  must(!content.includes('data-issuance-available="true"'), 'Rendered catalog must not advertise credential issuance availability.');
  must((content.match(/data-course-id=/g) || []).length === 15, 'Rendered catalog must contain all 15 Technician I/II courses.');
  must((content.match(/data-course-open=\"true\"/g) || []).length === 1, 'Rendered catalog must expose exactly one currently released academic course link.');
  must((content.match(/data-course-overview-link=\"true\"/g) || []).length === 14, 'Rendered catalog must expose 14 development overview links.');
  must(overviewPages.length === 14, 'Exactly 14 public development overview pages are required.');
  for (const { course, content: overview } of overviewPages) {
    must(overview.includes('data-dtf-course-development-overview="v1"'), `Overview marker missing for ${course.id}.`);
    must(overview.includes(course.id), `Course ID missing from overview for ${course.id}.`);
    must(overview.includes(course.downloadDefinitionUrl), `Download link missing from overview for ${course.id}.`);
  }
  must(content.includes('COURSE-LH-TECH1-007') && content.includes('COURSE-LH-TECH2-008'), 'Rendered catalog must expose both integrated lab course cards.');
  console.log(JSON.stringify({ result: 'success', version: 4, credentialOfferings: offerings.length, visibleTechnicianCourses: data.courses.length, publicAcademicPages: data.courses.filter(course => course.publicLessonReleaseAvailable === true).length, issuanceEnabled: 0 }, null, 2));
  process.exit(0);
}

must(apply, 'APPLY_CERTIFICATION_CATALOG_V4=true is required.');
must(user && pass, 'WordPress credentials are required.');

async function wp(apiPath, options = {}) {
  const response = await fetch(`${site}/wp-json/wp/v2/${apiPath}`, {
    ...options,
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'DTF-Certification-Catalog/4.0',
      ...(options.headers || {})
    }
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`${apiPath} returned ${response.status}: ${responseText.slice(0, 500)}`);
  return responseText ? JSON.parse(responseText) : null;
}

const existingRows = await wp('pages?slug=courses&parent=0&context=edit&per_page=100');
const existing = existingRows[0] || null;
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `courses-catalog-v4-${stamp}`);
await mkdir(backupDir, { recursive: true });
if (existing) await writeFile(join(backupDir, 'courses-before.html'), rendered(existing.content));

const payload = JSON.stringify({ slug: 'courses', title: 'Courses', status: 'publish', parent: 0, content });
const page = existing
  ? await wp(`pages/${existing.id}`, { method: 'POST', body: payload })
  : await wp('pages', { method: 'POST', body: payload });

const overviewResults = [];
for (const { course, content: overviewContent } of overviewPages) {
  const existingOverviewRows = await wp(`pages?slug=${encodeURIComponent(course.overviewSlug)}&parent=${page.id}&context=edit&per_page=100`);
  const existingOverview = existingOverviewRows[0] || null;
  if (existingOverview) await writeFile(join(backupDir, `overview-${course.id}-before.html`), rendered(existingOverview.content));
  const overviewPayload = JSON.stringify({ slug: course.overviewSlug, title: `${course.pathLabel} — Course ${course.number}: ${course.title} — Development Overview`, status: 'publish', parent: page.id, content: overviewContent });
  const written = existingOverview ? await wp(`pages/${existingOverview.id}`, { method: 'POST', body: overviewPayload }) : await wp('pages', { method: 'POST', body: overviewPayload });
  const overviewReadback = await wp(`pages/${written.id}?context=edit`);
  const overviewHtml = rendered(overviewReadback.content);
  must(overviewReadback.status === 'publish', `Overview page is not published for ${course.id}.`);
  must(overviewHtml.includes('data-dtf-course-development-overview="v1"'), `Overview marker missing after write for ${course.id}.`);
  must(overviewHtml.includes(`data-course-id="${course.id}"`), `Course ID missing after overview write for ${course.id}.`);
  must(overviewHtml.includes(course.downloadDefinitionUrl), `Course download link missing after overview write for ${course.id}.`);
  overviewResults.push({ id: course.id, pageId: written.id, href: course.overviewHref });
}

const readback = await wp(`pages/${page.id}?context=edit`);
const html = rendered(readback.content);
must(readback.status === 'publish', 'Courses page is not published.');
must(html.includes('data-dtf-courses-catalog="v4"'), 'Courses V4 marker missing after write.');
must((html.match(/data-credential-offering=/g) || []).length === 10, 'WordPress readback does not contain 10 credential offerings.');
must(!html.includes('data-issuance-available="true"'), 'WordPress readback unexpectedly advertises credential issuance availability.');
must((html.match(/data-course-id=/g) || []).length === 15, 'WordPress readback does not contain all 15 Technician I/II course cards.');
must((html.match(/data-course-overview-link="true"/g) || []).length === 14, 'WordPress readback does not contain 14 development overview links.');
must(overviewResults.length === 14, 'WordPress did not publish all 14 development overview pages.');
for (const course of data.courses.filter(course => course.publicLessonReleaseAvailable === true)) {
  must(course.href && html.includes(course.href), `Released course route missing after write: ${course.id} -> ${course.href}`);
}
for (const course of data.courses.filter(course => course.publicLessonReleaseAvailable !== true)) {
  must(!course.href, `Pending course unexpectedly exposes a live href: ${course.id} -> ${course.href}`);
}

const report = { result: 'success', version: 4, pageId: page.id, credentialOfferings: offerings.length, visibleTechnicianCourses: data.courses.length, publicAcademicPages: data.courses.filter(course => course.publicLessonReleaseAvailable === true).length, developmentOverviewPages: overviewResults.length, bytes: html.length, backupDir };
await writeFile(join(backupDir, 'courses-catalog-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
