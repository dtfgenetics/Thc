import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_CERTIFICATION_CATALOG_V6 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const data = JSON.parse(await readFile(process.env.CERTIFICATION_CATALOG_PATH || 'site/wordpress/education/course-catalog-v4.json', 'utf8'));
const tech1 = JSON.parse(await readFile(process.env.TECH1_PUBLIC_COURSES_PATH || 'site/wordpress/education/tech1-courses-public-v1.json', 'utf8'));
const tech2 = JSON.parse(await readFile(process.env.TECH2_PUBLIC_COURSES_PATH || 'site/wordpress/education/tech2-courses-public-v1.json', 'utf8'));
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-certification-catalog-v6';
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = (value, message) => { if (!value) throw new Error(message); };
const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

must(data.schemaVersion === 4 && data.id === 'dtf-courses-catalog-v4', 'Unexpected base catalog.');
must(tech1.id === 'tech1-courses-public-v1' && tech2.id === 'tech2-courses-public-v1', 'Unexpected public-course route config.');

for (const routeSet of [tech1, tech2]) {
  for (const entry of routeSet.courses) {
    const course = data.courses.find(x => x.id === entry.id);
    must(course, `Missing catalog course ${entry.id}`);
    course.status = 'available-academic';
    course.statusLabel = 'Available academic course';
    course.publicLessonReleaseAvailable = true;
    course.href = `${routeSet.program.route}${entry.slug}/`;
    course.availabilityNote = 'Public learner lessons and learning assessments are open now. Professional credential issuance remains separate and restricted.';
  }
}

data.intro = 'Structured cultivation learning paths built from researched instruction, guided practice, job tasks, learning assessments and separate credential validation. All seven Technician I and all eight Technician II academic training courses are publicly open.';
if (data.coursesSection) data.coursesSection.intro = 'All 15 built Technician I and Technician II academic course packages are publicly open with direct course links. Professional certification issuance remains a separate validation and governance process.';

const offerings = data.credentialSections.flatMap(x => x.offerings || []);
const tech1Offering = offerings.find(x => x.id === 'CREDPROG-CULT-TECH-I-001');
if (tech1Offering) tech1Offering.availableCourse = { href: tech1.program.route, label: 'All 7 Technician I academic courses are open' };
const tech2Offering = offerings.find(x => x.id === 'CREDPROG-CULT-TECH-II-001');
if (tech2Offering) tech2Offering.availableCourse = { href: tech2.program.route, label: 'All 8 Technician II academic courses are open' };

must(offerings.length === 10, 'Expected 10 credential offerings.');
must(offerings.every(x => x.issuanceAvailable === false), 'No credential may be marked issuance-available.');
must(data.courses.length === 15, 'Expected 15 Technician courses.');
const open = data.courses.filter(x => x.publicLessonReleaseAvailable === true);
must(open.length === 15, `Expected all 15 academic courses open, found ${open.length}.`);
must(open.filter(x => x.id.startsWith('COURSE-LH-TECH1-')).length === 7, 'Expected seven open Technician I courses.');
must(open.filter(x => x.id.startsWith('COURSE-LH-TECH2-')).length === 8, 'Expected eight open Technician II courses.');
must(open.every(x => x.href), 'Every public academic course requires an href.');

const css = `<style id="dtf-courses-v6-style">
.dc6{--ink:#17291d;--muted:#5b6b61;--deep:#082419;--green:#237345;--paper:#fff;--soft:#f3f7f3;--line:#d7e3d8;--gold:#c7a14b;background:linear-gradient(180deg,#faf8f1,#edf5ef);color:var(--ink);padding:30px 0 76px}.dc6 *{box-sizing:border-box}.dc6-wrap{width:min(1240px,calc(100% - 28px));margin:auto}.dc6-hero{display:grid;grid-template-columns:1.25fr .75fr;gap:24px;padding:clamp(28px,5vw,58px);border-radius:24px;background:linear-gradient(135deg,var(--deep),#18452c);color:#fff}.dc6-k{font-size:.75rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#b6e3bd}.dc6 h1{font-size:clamp(2.4rem,5.8vw,5rem);letter-spacing:-.05em;line-height:.98;margin:.18em 0}.dc6 h2{font-size:clamp(1.7rem,3vw,2.45rem);letter-spacing:-.035em}.dc6 p,.dc6 li{line-height:1.65}.dc6-hero p{color:#dfebe2}.dc6-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.dc6-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 15px;border-radius:10px;background:#2f8650;color:#fff!important;font-weight:850;text-decoration:none!important}.dc6-btn.secondary{background:transparent;border:1px solid rgba(255,255,255,.3)}.dc6-guide,.dc6-surface{border:1px solid var(--line);border-radius:16px;background:#fff}.dc6-guide{padding:19px;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}.dc6-guide p{color:#dfeae2}.dc6-section{margin-top:clamp(38px,6vw,72px)}.dc6-section-head{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:24px;align-items:end;margin-bottom:20px}.dc6-section-head>p{margin:0;color:var(--muted);max-width:66ch}.dc6-jump{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.dc6-jump a{display:inline-flex;align-items:center;min-height:38px;padding:8px 11px;border:1px solid rgba(255,255,255,.22);border-radius:999px;color:#e8f2eb!important;text-decoration:none!important;font-size:.78rem;font-weight:850}.dc6-disclosure-list{display:grid;gap:10px}.dc6-disclosure{overflow:hidden;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.82);box-shadow:0 7px 20px rgba(18,45,28,.035)}.dc6-disclosure[open]{background:#fff;box-shadow:0 14px 34px rgba(18,45,28,.065)}.dc6-disclosure>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:minmax(150px,.32fr) minmax(0,1fr) auto;gap:16px;align-items:center;padding:17px 18px}.dc6-disclosure>summary::-webkit-details-marker{display:none}.dc6-disclosure>summary:after{content:'+';display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);color:#1d6338;font-size:1.18rem;font-weight:900}.dc6-disclosure[open]>summary:after{content:'−'}.dc6-summary-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dc6-type{font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#56705e}.dc6-status{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf4ee;color:#285d39;font-size:.68rem;font-weight:900;text-transform:uppercase}.dc6-summary-title{font-size:clamp(1.05rem,2vw,1.28rem);line-height:1.25}.dc6-disclosure-body{padding:0 18px 20px;border-top:1px solid rgba(215,227,216,.7)}.dc6-disclosure-body>p{max-width:78ch;color:var(--muted)}.dc6-credential-group+.dc6-credential-group{margin-top:30px}.dc6-credential-group h3{margin:0 0 5px;font-size:1.35rem}.dc6-credential-group>p{margin:0 0 12px;color:var(--muted);max-width:78ch}.dc6-course-summary{grid-template-columns:160px minmax(0,1fr) auto!important}.dc6-path{display:flex;flex-direction:column;gap:4px}.dc6-path strong{font-size:.82rem}.dc6-course-title{font-weight:900;font-size:clamp(1.02rem,2vw,1.22rem)}.dc6-metrics{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0}.dc6-metric{padding:8px 10px;border-radius:9px;background:var(--soft);font-size:.8rem}.dc6-metric strong{color:#185f36;margin-right:4px}.dc6-boundary{margin-top:18px;padding:15px 17px;border-left:5px solid var(--gold);border-radius:10px;background:#fff7df;color:#574c2c}.dc6-surfaces{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.dc6-surface{padding:18px}.dc6-surface p{color:var(--muted)}.dc6 :focus-visible{outline:3px solid #1763ae;outline-offset:3px}.dc6 summary:focus-visible{outline-offset:-4px}@media(max-width:850px){.dc6-hero,.dc6-section-head,.dc6-surfaces{grid-template-columns:1fr}.dc6-disclosure>summary,.dc6-course-summary{grid-template-columns:1fr auto!important}.dc6-summary-meta,.dc6-path{grid-column:1}.dc6-summary-title,.dc6-course-title{grid-column:1}.dc6-disclosure>summary:after{grid-column:2;grid-row:1 / span 2}}@media(max-width:620px){.dc6-wrap{width:min(100% - 18px,1240px)}.dc6-hero{grid-template-columns:1fr;padding:23px 17px;border-radius:16px}.dc6-actions{display:grid}.dc6-btn{width:100%}.dc6-disclosure>summary{padding:15px}.dc6-disclosure-body{padding:0 15px 18px}.dc6-jump{display:grid;grid-template-columns:1fr 1fr}.dc6-jump a{justify-content:center}}
</style>`;
const actions = (data.primaryActions || []).map(a => `<a class="dc6-btn${a.style === 'secondary' ? ' secondary' : ''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('');
const credentialSections = data.credentialSections.map((section, sectionIndex) => `<section class="dc6-credential-group" data-credential-section="${esc(section.id)}"><h3>${esc(section.title)}</h3><p>${esc(section.description)}</p><div class="dc6-disclosure-list">${(section.offerings || []).map((item, itemIndex) => `<details class="dc6-disclosure" data-credential-offering="${esc(item.title)}" data-issuance-available="${item.issuanceAvailable ? 'true' : 'false'}"${sectionIndex === 0 && itemIndex === 0 ? ' open' : ''}><summary><span class="dc6-summary-meta"><span class="dc6-type">${esc(item.type)}${item.plannedCourses ? ` · ${esc(item.plannedCourses)} courses` : ''}</span><span class="dc6-status">${esc(item.statusLabel)}</span></span><strong class="dc6-summary-title">${esc(item.title)}</strong></summary><div class="dc6-disclosure-body"><p>${esc(item.summary)}</p>${item.availableCourse ? `<p><a href="${esc(item.availableCourse.href)}"><strong>${esc(item.availableCourse.label)} →</strong></a></p>` : ''}</div></details>`).join('')}</div></section>`).join('');
const courses = data.courses.map((course, index) => `<details class="dc6-disclosure dc6-course" data-course-id="${esc(course.id)}" data-course-release="available"${index === 0 ? ' open' : ''}><summary class="dc6-course-summary"><span class="dc6-path"><span class="dc6-status">${esc(course.statusLabel || course.status)}</span><strong>${esc(course.pathLabel || '')}</strong></span><span class="dc6-course-title">Course ${esc(course.number)} — ${esc(course.title)}</span></summary><div class="dc6-disclosure-body"><p>${esc(course.summary)}</p><div class="dc6-metrics">${(course.metrics || []).map(m => `<span class="dc6-metric"><strong>${esc(m.value)}</strong>${esc(m.label)}</span>`).join('')}</div><a class="dc6-btn" data-course-open="true" href="${esc(course.href)}">Open Course ${esc(course.number)} →</a></div></details>`).join('');
const surfaces = (data.learningSurfaces || []).map(x => `<article class="dc6-surface"><h3>${esc(x.title)}</h3><p>${esc(x.copy)}</p><a href="${esc(x.href)}"><strong>Open ${esc(x.title)} →</strong></a></article>`).join('');
const content = `${css}<main class="dc6" data-dtf-courses-catalog="v6"><div class="dc6-wrap"><section class="dc6-hero"><div><span class="dc6-k">${esc(data.eyebrow)}</span><h1>${esc(data.title)}</h1><p>${esc(data.intro)}</p><div class="dc6-actions">${actions}</div><nav class="dc6-jump" aria-label="Course catalog sections"><a href="#credentials">Credentials</a><a href="#technician-courses">Technician courses</a><a href="#learning-surfaces">Learning systems</a></nav></div><aside class="dc6-guide"><strong>Training availability and credential issuance are separate.</strong><p>All Technician I and II academic courses are open for study and learning assessment. No professional credential shown here is currently available for issuance until its validation and governance gates are complete.</p></aside></section><section class="dc6-section" id="credentials"><div class="dc6-section-head"><h2>Certificates & professional certifications</h2><p>Scan the credential path first, then expand only the program you need. All roadmap content remains public and searchable.</p></div>${credentialSections}<div class="dc6-boundary"><strong>Credential boundary:</strong> course publication does not authorize certification issuance.</div></section><section class="dc6-section" id="technician-courses"><div class="dc6-section-head"><h2>${esc(data.coursesSection?.title || 'Technician I & II courses')}</h2><p>${esc(data.coursesSection?.intro || '')}</p></div><div class="dc6-disclosure-list">${courses}</div></section><section class="dc6-section" id="learning-surfaces"><div class="dc6-section-head"><h2>Know where you are learning</h2><p>Use the course catalog for structured training, then move to the supporting learning system when you need broader reference depth.</p></div><div class="dc6-surfaces">${surfaces}</div><div class="dc6-boundary"><strong>Assessment boundary:</strong> ${esc(data.assessmentNote || 'Course tests are learning assessments and do not issue a professional credential.')}</div></section></div></main>`;

must((content.match(/data-credential-offering=/g) || []).length === 10, 'Rendered V6 catalog requires 10 credential offerings.');
must((content.match(/data-course-id=/g) || []).length === 15, 'Rendered V6 catalog requires 15 courses.');
must((content.match(/data-course-open="true"/g) || []).length === 15, 'Rendered V6 catalog requires all 15 courses open.');
must((content.match(/<details class="dc6-disclosure/g) || []).length === 25, 'Rendered V6 catalog requires 25 progressive-disclosure records.');
must(!content.includes('data-issuance-available="true"'), 'Rendered V6 catalog cannot advertise credential issuance.');

if (validateOnly) { console.log(JSON.stringify({ result: 'success', version: 6, presentation: 'progressive-disclosure', openCourses: open.map(x => x.id) }, null, 2)); process.exit(0); }
if (!apply) { console.log('Validation passed. Set APPLY_CERTIFICATION_CATALOG_V6=true to publish.'); process.exit(0); }
must(auth, 'WordPress credentials required.');

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
    if (attempt < 6) await sleep(Math.min(10000, attempt * 900));
  }
  throw last;
}
async function wp(endpoint, options = {}) {
  const response = await fetchRetry(`${site}/wp-json/wp/v2/${endpoint.replace(/^\//, '')}`, { ...options, headers: { Authorization: auth, 'Content-Type': 'application/json', ...(options.headers || {}) } }, `WordPress ${endpoint}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const rows = await wp('pages?slug=courses&context=edit&per_page=100');
must(rows.length, '/courses/ WordPress page not found.');
const page = rows[0];
await mkdir(backupRoot, { recursive: true });
await writeFile(join(backupRoot, `courses-${page.id}.json`), JSON.stringify(page, null, 2));
const updated = await wp(`pages/${page.id}`, { method: 'POST', body: JSON.stringify({ status: 'publish', content, title: 'Courses' }) });
console.log(JSON.stringify({ result: 'success', version: 6, presentation: 'progressive-disclosure', pageId: updated.id, openCourses: open.map(x => ({ id: x.id, href: x.href })) }, null, 2));