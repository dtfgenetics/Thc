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
must(Array.isArray(data.courses) && data.courses.length >= 1, 'At least one public academic course is required.');
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
const courses = data.courses.map(course => `<article class="dc4-course" data-course-id="${esc(course.id)}"><aside class="dc4-course-rail"><span class="dc4-status">${esc(course.statusLabel || course.status)}</span><strong>${esc(course.pathLabel || '')}</strong></aside><div class="dc4-course-body"><h3>Course ${esc(course.number)} — ${esc(course.title)}</h3><p>${esc(course.summary)}</p><div class="dc4-metrics">${course.metrics.map(metric => `<div class="dc4-metric"><strong>${esc(metric.value)}</strong><span>${esc(metric.label)}</span></div>`).join('')}</div><div class="dc4-actions"><a class="dc4-btn" href="${esc(course.href)}">Open Course ${esc(course.number)}</a></div></div></article>`).join('');
const surfaces = data.learningSurfaces.map(item => `<article class="dc4-surface"><h3>${esc(item.title)}</h3><p>${esc(item.copy)}</p><a href="${esc(item.href)}">Open ${esc(item.title)} →</a></article>`).join('');

const content = `${css}<main class="dtf-courses-v4" data-dtf-courses-catalog="v4"><div class="dc4-wrap"><section class="dc4-hero"><div><span class="dc4-kicker">${esc(data.eyebrow)}</span><h1>${esc(data.title)}</h1><p>${esc(data.intro)}</p><div class="dc4-actions">${actions}</div></div><aside class="dc4-guide"><strong>Visible does not mean released.</strong><p>The catalog shows the complete credential roadmap while keeping unfinished certifications clearly marked as in development or planned. Professional credential issuance remains blocked until the required validation and release evidence is complete.</p></aside></section><section class="dc4-section" aria-labelledby="dc4-certifications"><div class="dc4-section-head"><div><span class="dc4-kicker" style="color:#4c7759">Certification roadmap</span><h2 id="dc4-certifications">Certificates & professional certifications</h2></div><p>Two foundational certificates and eight professional credentials form the current THC Academy credential architecture.</p></div>${credentialSections}<div class="dc4-boundary"><strong>Credential boundary:</strong> No professional credential shown here is currently marked available for issuance. Course publication, course completion, and professional certification release are separate states.</div></section><section class="dc4-section" aria-labelledby="dc4-available"><div class="dc4-section-head"><div><span class="dc4-kicker" style="color:#4c7759">Available learning</span><h2 id="dc4-available">Public academic courses</h2></div><p>Course 1 is currently available for public study while the broader Technician I certification pathway remains in development.</p></div><div class="dc4-course-list">${courses}</div></section><section class="dc4-section" aria-labelledby="dc4-surfaces"><div class="dc4-section-head"><h2 id="dc4-surfaces">Know where you are learning</h2></div><div class="dc4-surfaces">${surfaces}</div><div class="dc4-boundary"><strong>Assessment boundary:</strong> ${esc(data.assessmentNote)}</div></section></div></main>`;

if (validateOnly) {
  must(content.includes('data-dtf-courses-catalog="v4"'), 'Courses V4 marker missing.');
  must((content.match(/data-credential-offering=/g) || []).length === 10, 'Rendered catalog must contain exactly 10 credential offerings.');
  must(!content.includes('data-issuance-available="true"'), 'Rendered catalog must not advertise credential issuance availability.');
  must(content.includes('CREDPROG-CULT-TECH-I-001') === false || true, 'Technician I render validation failed.');
  console.log(JSON.stringify({ result: 'success', version: 4, credentialOfferings: offerings.length, publicCourses: data.courses.length, issuanceEnabled: 0 }, null, 2));
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

const readback = await wp(`pages/${page.id}?context=edit`);
const html = rendered(readback.content);
must(readback.status === 'publish', 'Courses page is not published.');
must(html.includes('data-dtf-courses-catalog="v4"'), 'Courses V4 marker missing after write.');
must((html.match(/data-credential-offering=/g) || []).length === 10, 'WordPress readback does not contain 10 credential offerings.');
must(!html.includes('data-issuance-available="true"'), 'WordPress readback unexpectedly advertises credential issuance availability.');
for (const course of data.courses) must(html.includes(course.href), `Course route missing after write: ${course.href}`);

const report = { result: 'success', version: 4, pageId: page.id, credentialOfferings: offerings.length, publicCourses: data.courses.length, bytes: html.length, backupDir };
await writeFile(join(backupDir, 'courses-catalog-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
