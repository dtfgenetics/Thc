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

data.eyebrow = 'THC Academy';
data.title = 'Professional Cannabis Cultivation Education';
data.intro = 'Build practical cultivation knowledge through plant science, applied practice, field references, and progressive training pathways. Start with Technician I, advance through Technician II, then explore specialist and leadership programs.';
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

const publicCredentialTitle = (item) => {
  const map = {
    'THC Safety & Responsible Practice Certificate': 'Cultivation Safety & Professional Practice',
    'THC Cultivation Foundations Certificate': 'Cannabis Cultivation Foundations',
    'THC Cultivation Technician I': 'Cultivation Technician I',
    'THC Cultivation Technician II': 'Cultivation Technician II',
    'THC Plant Health, IPM & Biosecurity Specialist': 'Plant Health & IPM Specialist',
    'THC Environmental, Irrigation & Fertigation Systems Specialist': 'Environmental & Irrigation Systems',
    'THC Propagation & Clean Stock Specialist': 'Propagation & Clean Stock',
    'THC Postharvest Quality Specialist': 'Postharvest & Quality',
    'THC Genetics, Breeding & Preservation Specialist': 'Genetics & Breeding Specialist',
    'THC Cultivation Lead & Operations Professional': 'Cultivation Leadership & Operations'
  };
  return map[item.title] || item.title;
};
const publicCourseTitle = (course) => {
  const map = {
    'Safety, Responsible Practice & Cultivation Workflows': 'Cultivation Safety & Professional Practice',
    'Plant Observation, Growth Stages & Crop Records': 'Plant Observation & Crop Records',
    'Environmental, Light & Sensor Fundamentals': 'Environment, Lighting & Sensors',
    'Water, Root Zone, Nutrition & Irrigation Fundamentals': 'Water, Nutrition & Root-Zone Management',
    'Propagation, Canopy, IPM Scouting & Crop Care': 'Propagation, Canopy & Crop Health',
    'Harvest, Postharvest, Traceability & Shift Handoff': 'Harvest, Postharvest & Traceability',
    'Integrated Cultivation Technician Practice Lab': 'Technician I Practical Lab',
    'Advanced Crop Observation & Diagnostic Reasoning': 'Advanced Crop Diagnostics',
    'Environmental Data, Sensors & Equipment Response': 'Environmental Systems & Equipment Response',
    'Fertigation Execution, Verification & Root-Zone Interpretation': 'Fertigation & Root-Zone Diagnostics',
    'Plant Health, IPM & Biosecurity Troubleshooting': 'Plant Health & IPM Troubleshooting',
    'Propagation & Canopy Performance Troubleshooting': 'Propagation & Canopy Troubleshooting',
    'Harvest/Postharvest Deviations & Quality Response': 'Postharvest Quality & Corrective Action',
    'Traceability, Production Metrics, Shift Coordination & Peer Support': 'Production Records & Shift Leadership',
    'Integrated Technician II Simulation Lab': 'Technician II Simulation Lab'
  };
  return map[course.title] || course.title;
};
const publicSectionTitle = (section) => ({
  foundational: 'Foundations',
  technician: 'Technician Pathways',
  specialist: 'Specialist Training',
  'advanced-professional': 'Leadership & Operations'
}[section.id] || section.title);
const publicStatus = (item) => item.status === 'planned' ? 'Coming later' : item.status === 'in-development' ? 'In development' : item.statusLabel || item.status;

const css = `<style id="dtf-courses-v6-style">
.dc6{--ink:#14271b;--muted:#647168;--deep:#0c281a;--green:#2f7449;--paper:#fffefb;--soft:#f1f5f0;--line:#dce4dc;--gold:#b99543;background:linear-gradient(180deg,#fbfcf9,#f4f7f2);color:var(--ink);padding:22px 0 72px}.dc6 *{box-sizing:border-box}.dc6-wrap{width:min(1180px,calc(100% - 28px));margin:auto}.dc6 a{text-underline-offset:3px}
.dc6-hero{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(270px,.7fr);gap:24px;padding:clamp(30px,5vw,56px);border-radius:22px;background:linear-gradient(135deg,#0c281a,#19472e);color:#fff;box-shadow:0 18px 48px rgba(17,47,31,.12)}.dc6-k{display:block;margin-bottom:8px;font-size:.75rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#c9e3cf}.dc6 h1{font-size:clamp(2.35rem,5vw,4.8rem);letter-spacing:-.05em;line-height:1;margin:.18em 0}.dc6 h2{font-size:clamp(1.65rem,3vw,2.45rem);letter-spacing:-.03em;line-height:1.08}.dc6 p,.dc6 li{line-height:1.58}.dc6-hero>div>p{max-width:66ch;color:#e0ebe4;font-size:1.04rem}
.dc6-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.dc6-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 16px;border-radius:10px;background:#3a8658;color:#fff!important;font-weight:850;text-decoration:none!important}.dc6-btn.secondary{background:transparent;border:1px solid rgba(255,255,255,.34)}
.dc6-guide{padding:20px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.07)}.dc6-guide>strong{display:block;font-size:1.08rem}.dc6-guide>p{margin:10px 0 0;color:#dce8e0;font-size:.92rem}.dc6-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:15px}.dc6-flow span{padding:9px 7px;border-radius:9px;background:rgba(255,255,255,.08);font-size:.78rem;font-weight:800;text-align:center}.dc6-flow b{display:block;color:#efd985;font-size:.7rem;margin-bottom:2px}.dc6-jump{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.dc6-jump a{display:inline-flex;align-items:center;min-height:38px;padding:7px 11px;border:1px solid rgba(255,255,255,.22);border-radius:999px;color:#e8f2eb!important;text-decoration:none!important;font-size:.77rem;font-weight:800}
.dc6-section{margin-top:38px}.dc6-section-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.75fr);gap:24px;align-items:end;margin-bottom:18px}.dc6-section-head>p{margin:0;color:var(--muted);max-width:68ch}.dc6-credential-group{padding:18px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.72)}.dc6-credential-group+.dc6-credential-group{margin-top:12px}.dc6-credential-group h3{margin:0 0 4px;font-size:1.3rem}.dc6-credential-group>p{margin:0 0 12px;color:var(--muted)}
.dc6-disclosure-list{display:grid;gap:9px}.dc6-disclosure{border:1px solid var(--line);border-radius:13px;background:#fff;overflow:hidden}.dc6-disclosure>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:minmax(150px,.3fr) minmax(0,1fr) auto;gap:12px;align-items:center;min-height:64px;padding:14px 16px}.dc6-disclosure>summary::-webkit-details-marker{display:none}.dc6-disclosure>summary:after{content:'+';display:grid;place-items:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:#f7faf7;color:#1d6338;font-weight:900}.dc6-disclosure[open]>summary:after{content:'−';background:#edf4ee}.dc6-disclosure-body{padding:2px 16px 16px;border-top:1px solid var(--line)}.dc6-disclosure-body>p{max-width:78ch;color:var(--muted)}
.dc6-summary-meta{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.dc6-type{font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#56705e}.dc6-status{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf4ee;color:#285d39;font-size:.67rem;font-weight:900;text-transform:uppercase}.dc6-summary-title{font-size:1.12rem;line-height:1.25}
.dc6-course-summary{grid-template-columns:135px minmax(0,1fr) auto!important}.dc6-path{display:flex;flex-direction:column;gap:4px}.dc6-path strong{font-size:.78rem}.dc6-course-title{font-weight:900;font-size:1.1rem}.dc6-metrics{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.dc6-metric{padding:7px 9px;border-radius:8px;background:var(--soft);font-size:.76rem}.dc6-metric strong{color:#185f36;margin-right:4px}
.dc6-note{margin-top:14px;padding:13px 15px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--muted);font-size:.88rem}.dc6-note strong{color:var(--ink)}
.dc6-surfaces{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.dc6-surface{padding:18px;border:1px solid var(--line);border-radius:14px;background:#fff}.dc6-surface h3{margin-top:0;font-size:1.22rem}.dc6-surface p{color:var(--muted)}
.dc6 :focus-visible{outline:3px solid #1763ae;outline-offset:3px}
@media(max-width:900px){.dc6-hero,.dc6-section-head,.dc6-surfaces{grid-template-columns:1fr}.dc6-disclosure>summary,.dc6-course-summary{grid-template-columns:1fr auto!important}.dc6-summary-meta,.dc6-path,.dc6-summary-title,.dc6-course-title{grid-column:1}.dc6-disclosure>summary:after{grid-column:2;grid-row:1 / span 2}}
@media(max-width:640px){.dc6{padding:10px 0 52px}.dc6-wrap{width:min(100% - 18px,1180px)}.dc6-hero{padding:24px 18px;border-radius:15px;box-shadow:none}.dc6 h1{font-size:clamp(2.05rem,10vw,3rem)}.dc6 h2{font-size:clamp(1.5rem,7vw,1.95rem)}.dc6-actions{display:grid}.dc6-btn{width:100%}.dc6-guide{padding:15px}.dc6-flow{grid-template-columns:1fr 1fr}.dc6-jump{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.dc6-jump a{flex:0 0 auto}.dc6-section{margin-top:30px}.dc6-section-head{gap:8px;margin-bottom:14px}.dc6-credential-group{padding:12px;border-radius:13px}.dc6-credential-group h3{font-size:1.12rem}.dc6-credential-group>p{font-size:.9rem}.dc6-disclosure{border-radius:11px}.dc6-disclosure>summary,.dc6-course-summary{grid-template-columns:minmax(0,1fr) 34px!important;gap:8px;min-height:58px;padding:12px}.dc6-summary-title,.dc6-course-title{font-size:.98rem}.dc6-disclosure-body{padding:2px 12px 13px}.dc6-disclosure-body>p{font-size:.9rem}.dc6-metrics{gap:5px;margin:10px 0}.dc6-metric{padding:6px 7px;font-size:.72rem}.dc6-surfaces{gap:9px}.dc6-surface{padding:14px}.dc6-surface h3{font-size:1.08rem}.dc6-note{font-size:.84rem}}
</style>`;
const actions = (data.primaryActions || []).map(a => `<a class="dc6-btn${a.style === 'secondary' ? ' secondary' : ''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('');
const credentialSections = data.credentialSections.map(section => `<section class="dc6-credential-group" data-credential-section="${esc(section.id)}"><h3>${esc(publicSectionTitle(section))}</h3><p>${esc(section.description)}</p><div class="dc6-disclosure-list">${(section.offerings || []).map(item => `<details class="dc6-disclosure" data-credential-offering="${esc(item.title)}" data-issuance-available="${item.issuanceAvailable ? 'true' : 'false'}"><summary><span class="dc6-summary-meta"><span class="dc6-type">${esc(item.type)}${item.plannedCourses ? ` · ${esc(item.plannedCourses)} courses` : ''}</span><span class="dc6-status">${esc(publicStatus(item))}</span></span><strong class="dc6-summary-title">${esc(publicCredentialTitle(item))}</strong></summary><div class="dc6-disclosure-body"><p>${esc(item.summary)}</p>${item.availableCourse ? `<p><a href="${esc(item.availableCourse.href)}"><strong>Open pathway →</strong></a></p>` : ''}</div></details>`).join('')}</div></section>`).join('');
const courses = data.courses.map((course, index) => `<details class="dc6-disclosure dc6-course" data-course-id="${esc(course.id)}" data-course-release="available"${index === 0 ? ' open' : ''}><summary class="dc6-course-summary"><span class="dc6-path"><span class="dc6-status">Open</span><strong>${esc((course.pathLabel || '').replace(/^THC\\s+/, ''))}</strong></span><span class="dc6-course-title">Course ${esc(course.number)} · ${esc(publicCourseTitle(course))}</span></summary><div class="dc6-disclosure-body"><p>${esc(course.summary)}</p><div class="dc6-metrics">${(course.metrics || []).slice(0,3).map(m => `<span class="dc6-metric"><strong>${esc(m.value)}</strong>${esc(m.label)}</span>`).join('')}</div><a class="dc6-btn" data-course-open="true" href="${esc(course.href)}">Open Course ${esc(course.number)} →</a></div></details>`).join('');
const surfaces = (data.learningSurfaces || []).map(x => `<article class="dc6-surface"><h3>${esc(x.title)}</h3><p>${esc(x.copy)}</p><a href="${esc(x.href)}"><strong>Open ${esc(x.title)} →</strong></a></article>`).join('');
const content = `${css}<main class="dc6" data-dtf-courses-catalog="v6"><div class="dc6-wrap">
<section class="dc6-hero"><div><span class="dc6-k">${esc(data.eyebrow)}</span><h1>${esc(data.title)}</h1><p>${esc(data.intro)}</p><div class="dc6-actions">${actions}</div><nav class="dc6-jump" aria-label="Course catalog sections"><a href="#credentials">Learning pathways</a><a href="#technician-courses">Courses</a><a href="#learning-surfaces">Tools & references</a></nav></div><aside class="dc6-guide"><strong>How the Academy works</strong><div class="dc6-flow"><span><b>1</b>Learn</span><span><b>2</b>Practice</span><span><b>3</b>Assess</span><span><b>4</b>Certify</span></div><p>Course assessments support learning. Professional certification uses a separate final eligibility and credential process.</p></aside></section>
<section class="dc6-section" id="credentials"><div class="dc6-section-head"><h2>Choose your learning pathway</h2><p>Start with core cultivation training, build advanced technician skills, then explore focused specialist and leadership programs.</p></div>${credentialSections}<div class="dc6-note"><strong>Certification:</strong> Course completion and professional credential issuance are separate stages. <a href="/certification/">Learn how certification works →</a></div></section>
<section class="dc6-section" id="technician-courses"><div class="dc6-section-head"><h2>Technician courses</h2><p>Follow the courses in order for a guided progression from safe cultivation practice through advanced systems and diagnostic reasoning.</p></div><div class="dc6-disclosure-list">${courses}</div></section>
<section class="dc6-section" id="learning-surfaces"><div class="dc6-section-head"><h2>Learning tools & references</h2><p>Use focused reference systems when you need deeper plant science, field guidance, or interactive support alongside the course sequence.</p></div><div class="dc6-surfaces">${surfaces}</div></section>
</div></main>`;

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