import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_LEARNING_HUB_COURSE1 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const dataPath = process.env.COURSE_CATALOG_PATH || 'site/wordpress/education/course-catalog-v3.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-hub-course1';
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const must = (value, message) => { if (!value) throw new Error(message); };
const rendered = value => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');

must(data.schemaVersion === 3 && data.id === 'dtf-courses-catalog-v3', 'Unexpected Courses catalog schema.');
must(Array.isArray(data.courses) && data.courses.length >= 1, 'At least one course is required.');
must(Array.isArray(data.primaryActions), 'primaryActions must be an array.');
must(Array.isArray(data.learningSurfaces), 'learningSurfaces must be an array.');
must(Array.isArray(data.courseFlow), 'courseFlow must be an array.');
for (const course of data.courses) {
  must(course.id && course.title && course.href && course.summary, 'Every course needs id, title, href, and summary.');
  must(Array.isArray(course.metrics), `${course.id}: metrics must be an array.`);
  must(Array.isArray(course.includes), `${course.id}: includes must be an array.`);
}

const css = `<style id="dtf-courses-v3-style">
.dtf-courses-v3{--ink:#15261b;--muted:#5b6b60;--deep:#071d12;--deep2:#123a24;--green:#1e6a3b;--green2:#2c814b;--cream:#f5f2e8;--paper:#fff;--line:#d8e1d9;--gold:#c7a24b;background:linear-gradient(180deg,#f7f5ed 0,#f3f6f1 100%);color:var(--ink);padding:30px 0 80px}.dtf-courses-v3 *{box-sizing:border-box}.dtf-courses-v3 a{font-weight:800}.dc3-wrap{width:min(1240px,calc(100% - 30px));margin:auto}.dc3-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:28px;align-items:end;padding:clamp(30px,6vw,66px);border:1px solid rgba(103,193,115,.2);border-radius:24px;background:radial-gradient(circle at 85% 15%,rgba(82,182,91,.17),transparent 34%),linear-gradient(135deg,var(--deep),var(--deep2));color:#fff;box-shadow:0 20px 50px rgba(10,37,22,.12)}.dc3-kicker{display:inline-flex;align-items:center;gap:8px;color:#a7dfab;font-size:.77rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.dc3-kicker:before{content:"";width:22px;height:2px;background:#64cf6d}.dc3-hero h1{max-width:850px;margin:.2em 0 .25em;font-size:clamp(2.4rem,6vw,5.1rem);line-height:.96;letter-spacing:-.055em}.dc3-hero p{max-width:820px;margin:0;color:#dbe7de;font-size:1.03rem;line-height:1.72}.dc3-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.dc3-btn{min-height:46px;display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border:1px solid transparent;border-radius:10px;background:#2c7c45;color:#fff!important;text-decoration:none!important}.dc3-btn.secondary{background:transparent;border-color:rgba(255,255,255,.27);color:#fff!important}.dc3-hero-guide{padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.055);backdrop-filter:blur(8px)}.dc3-hero-guide strong{display:block;margin-bottom:8px;color:#fff;font-size:1.02rem}.dc3-hero-guide p{font-size:.9rem;line-height:1.55}.dc3-section{margin-top:38px}.dc3-section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:14px}.dc3-section-head h2{margin:0;font-size:clamp(1.7rem,3vw,2.35rem);letter-spacing:-.025em}.dc3-section-head p{max-width:600px;margin:0;color:var(--muted);line-height:1.55}.dc3-course-list{display:grid;gap:16px}.dc3-course{display:grid;grid-template-columns:180px minmax(0,1fr);overflow:hidden;border:1px solid var(--line);border-radius:20px;background:var(--paper);box-shadow:0 12px 34px rgba(16,48,29,.05)}.dc3-course-rail{padding:22px;background:#102f1e;color:#fff}.dc3-status{display:inline-flex;padding:6px 9px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.07);font-size:.72rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.dc3-course-no{display:block;margin-top:28px;color:#8fda99;font-size:.76rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.dc3-course-rail strong{display:block;margin-top:7px;font-size:1rem;line-height:1.3}.dc3-course-body{padding:clamp(22px,4vw,36px)}.dc3-course-body h3{margin:0;font-size:clamp(1.65rem,3vw,2.25rem);letter-spacing:-.03em}.dc3-course-body>p{max-width:900px;color:var(--muted);line-height:1.7}.dc3-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px;margin:20px 0}.dc3-metric{padding:13px 14px;border:1px solid var(--line);border-radius:12px;background:#f8faf7}.dc3-metric strong{display:block;color:#155b32;font-size:1.25rem}.dc3-metric span{display:block;margin-top:2px;color:#647369;font-size:.78rem;font-weight:760}.dc3-includes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 16px;margin:18px 0;padding:0;list-style:none}.dc3-includes li{position:relative;padding-left:19px;color:#425449;line-height:1.5}.dc3-includes li:before{content:"✓";position:absolute;left:0;color:#237743;font-weight:950}.dc3-surface-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.dc3-card{padding:20px;border:1px solid var(--line);border-radius:16px;background:#fff}.dc3-card h3{margin:0 0 8px}.dc3-card p{margin:0;color:var(--muted);line-height:1.62}.dc3-card a{display:inline-block;margin-top:13px;color:#145e34}.dc3-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;counter-reset:flow}.dc3-flow-item{position:relative;padding:20px;border:1px solid var(--line);border-radius:16px;background:#fff}.dc3-flow-item .n{display:grid;place-items:center;width:32px;height:32px;margin-bottom:14px;border-radius:9px;background:#e5f0e7;color:#185f35;font-weight:950}.dc3-flow-item h3{margin:0 0 7px}.dc3-flow-item p{margin:0;color:var(--muted);font-size:.91rem;line-height:1.58}.dc3-note{margin-top:18px;padding:16px 18px;border-left:5px solid var(--gold);border-radius:10px;background:#fff8e6;color:#544a2a;line-height:1.55}.dtf-courses-v3 :focus-visible{outline:3px solid #1765a1;outline-offset:3px}
@media(max-width:920px){.dc3-hero{grid-template-columns:1fr}.dc3-course{grid-template-columns:145px minmax(0,1fr)}.dc3-surface-grid{grid-template-columns:1fr}.dc3-flow{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){.dtf-courses-v3{padding-top:18px}.dc3-wrap{width:min(100% - 20px,1240px)}.dc3-hero{padding:24px 18px;border-radius:16px}.dc3-hero h1{font-size:clamp(2.15rem,12vw,3.4rem)}.dc3-actions{display:grid;grid-template-columns:1fr}.dc3-btn{width:100%}.dc3-section-head{display:block}.dc3-section-head p{margin-top:8px}.dc3-course{grid-template-columns:1fr}.dc3-course-rail{padding:15px 18px}.dc3-course-no{margin-top:12px}.dc3-includes{grid-template-columns:1fr}.dc3-flow{grid-template-columns:1fr}}
</style>`;

const actions = (data.primaryActions || []).map(a => `<a class="dc3-btn${a.style === 'secondary' ? ' secondary' : ''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('');
const courses = data.courses.map(course => `<article class="dc3-course" data-course-id="${esc(course.id)}"><aside class="dc3-course-rail"><span class="dc3-status">${esc(course.statusLabel || course.status)}</span><span class="dc3-course-no">Course ${esc(course.number)}</span><strong>${esc(course.pathLabel || '')}</strong></aside><div class="dc3-course-body"><h3>${esc(course.title)}</h3><p>${esc(course.summary)}</p><div class="dc3-metrics">${course.metrics.map(m => `<div class="dc3-metric"><strong>${esc(m.value)}</strong><span>${esc(m.label)}</span></div>`).join('')}</div><ul class="dc3-includes">${course.includes.map(item => `<li>${esc(item)}</li>`).join('')}</ul><div class="dc3-actions"><a class="dc3-btn" href="${esc(course.href)}">Open Course ${esc(course.number)}</a></div></div></article>`).join('');
const surfaces = data.learningSurfaces.map(item => `<article class="dc3-card"><h3>${esc(item.title)}</h3><p>${esc(item.copy)}</p><a href="${esc(item.href)}">Open ${esc(item.title)} →</a></article>`).join('');
const flow = data.courseFlow.map(item => `<article class="dc3-flow-item"><span class="n">${esc(item.number)}</span><h3>${esc(item.title)}</h3><p>${esc(item.copy)}</p></article>`).join('');

const content = `${css}<main class="dtf-courses-v3" data-dtf-courses-catalog="v3"><div class="dc3-wrap"><section class="dc3-hero"><div><span class="dc3-kicker">${esc(data.eyebrow)}</span><h1>${esc(data.title)}</h1><p>${esc(data.intro)}</p><div class="dc3-actions">${actions}</div></div><aside class="dc3-hero-guide"><strong>Choose the surface that matches the job.</strong><p>Reference material, structured coursework, and credential assessment are intentionally separated so learners can tell what they are doing and what a result means.</p></aside></section><section class="dc3-section" aria-labelledby="dc3-available"><div class="dc3-section-head"><div><span class="dc3-kicker" style="color:#4c7759">Course catalog</span><h2 id="dc3-available">Available learning paths</h2></div><p>The catalog is content-driven: additional courses can be added, reordered, or expanded without changing the page layout code.</p></div><div class="dc3-course-list">${courses}</div></section><section class="dc3-section" aria-labelledby="dc3-surfaces"><div class="dc3-section-head"><h2 id="dc3-surfaces">Know where you are learning</h2></div><div class="dc3-surface-grid">${surfaces}</div></section><section class="dc3-section" aria-labelledby="dc3-flow"><div class="dc3-section-head"><h2 id="dc3-flow">How each course works</h2><p>A predictable instructional rhythm reduces navigation friction and keeps attention on the material.</p></div><div class="dc3-flow">${flow}</div><div class="dc3-note"><strong>Assessment boundary:</strong> ${esc(data.assessmentNote)}</div></section></div></main>`;

if (validateOnly) {
  must(content.includes('data-dtf-courses-catalog="v3"'), 'Courses V3 marker missing.');
  must(content.includes('dc3-course-list'), 'Course list renderer missing.');
  must(!content.includes('course-count-limit'), 'Unexpected course-count restriction marker.');
  console.log(JSON.stringify({ result: 'success', version: 3, courses: data.courses.length, actions: data.primaryActions.length, dataDriven: true }, null, 2));
  process.exit(0);
}

must(apply, 'APPLY_LEARNING_HUB_COURSE1=true is required.');
must(user && pass, 'WordPress credentials are required.');

async function wp(path, options={}) {
  const response = await fetch(`${site}/wp-json/wp/v2/${path}`, {
    ...options,
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'DTF-Courses-Catalog/3.0', ...(options.headers || {}) }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0,500)}`);
  return text ? JSON.parse(text) : null;
}

const existingRows = await wp('pages?slug=courses&parent=0&context=edit&per_page=100');
const existing = existingRows[0] || null;
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `courses-catalog-v3-${stamp}`);
await mkdir(backupDir, { recursive: true });
if (existing) await writeFile(join(backupDir, 'courses-before.html'), rendered(existing.content));
const payload = JSON.stringify({ slug: 'courses', title: 'Courses', status: 'publish', parent: 0, content });
const page = existing ? await wp(`pages/${existing.id}`, { method: 'POST', body: payload }) : await wp('pages', { method: 'POST', body: payload });
const readback = await wp(`pages/${page.id}?context=edit`);
const html = rendered(readback.content);
must(readback.status === 'publish', 'Courses page is not published.');
must(html.includes('data-dtf-courses-catalog="v3"'), 'Courses V3 marker missing after write.');
for (const course of data.courses) must(html.includes(course.href), `Course route missing after write: ${course.href}`);
const report = { result: 'success', version: 3, pageId: page.id, courses: data.courses.length, bytes: html.length, backupDir };
await writeFile(join(backupDir, 'courses-catalog-v3-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
