import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_ACADEMY_V2 || '').toLowerCase() === 'true';
const curriculumPath = process.env.ACADEMY_V2_PATH || 'site/wordpress/education/academy-v2.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-academy-v2';
const curriculum = JSON.parse(await readFile(curriculumPath, 'utf8'));

const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered = v => typeof v === 'string' ? v : (v?.raw || v?.rendered || '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function validate(data) {
  if (data?.schemaVersion !== 1 || data?.id !== 'thc-academy-v2' || data?.route !== '/learn/academy/') throw new Error('Invalid THC Academy V2 package identity.');
  if (!Array.isArray(data.studyRules) || data.studyRules.length < 5) throw new Error('Academy V2 requires at least five study rules.');
  if (!Array.isArray(data.courses) || data.courses.length !== 12) throw new Error(`Academy V2 requires exactly 12 courses; found ${data?.courses?.length || 0}.`);
  const ids = new Set();
  let units = 0, exercises = 0, capstones = 0, checklistItems = 0;
  for (const course of data.courses) {
    if (!course.id || ids.has(course.id)) throw new Error(`Duplicate or missing course id: ${course.id}`);
    ids.add(course.id);
    if (!course.title || !course.route || !course.purpose || !course.evidenceBoundary) throw new Error(`${course.id}: incomplete course metadata.`);
    if (!Array.isArray(course.units) || course.units.length !== 5) throw new Error(`${course.id}: expected 5 units.`);
    if (!Array.isArray(course.exercises) || course.exercises.length !== 2) throw new Error(`${course.id}: expected 2 practical exercises.`);
    if (!course.capstone) throw new Error(`${course.id}: capstone is required.`);
    if (!Array.isArray(course.completion) || course.completion.length < 4) throw new Error(`${course.id}: completion checklist requires at least 4 items.`);
    for (const unit of course.units) if (!unit.title || !unit.task || !unit.verify) throw new Error(`${course.id}: incomplete unit.`);
    for (const ex of course.exercises) if (!ex.title || !ex.deliverable) throw new Error(`${course.id}: incomplete exercise.`);
    units += course.units.length;
    exercises += course.exercises.length;
    capstones += 1;
    checklistItems += course.completion.length;
  }
  if (!Array.isArray(data.supportRoutes) || data.supportRoutes.length < 5) throw new Error('Academy V2 support routes are incomplete.');
  const forbidden = [/guaranteed yield/i,/always use/i,/one universal/i,/couchlock/i,/fixed safe distance/i];
  const text = JSON.stringify(data);
  for (const re of forbidden) if (re.test(text)) throw new Error(`Academy V2 contains forbidden universal/unsupported wording: ${re}`);
  return { courses:data.courses.length, units, exercises, capstones, checklistItems, supportRoutes:data.supportRoutes.length };
}

const totals = validate(curriculum);
if (validateOnly) {
  console.log(JSON.stringify({ valid:true, id:curriculum.id, route:curriculum.route, ...totals }, null, 2));
  process.exit(0);
}
if (!apply) throw new Error('Set APPLY_ACADEMY_V2=true for production publication.');
if (!user || !pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required for production publication.');

const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
async function request(path, options={}) {
  let last;
  for (let attempt=1; attempt<=8; attempt++) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect:'follow',
        signal:AbortSignal.timeout(60000),
        headers:{ Authorization:auth, Accept:'application/json', 'User-Agent':'DTFSeeds-Academy-V2/1.0', ...(options.body?{'Content-Type':'application/json'}:{}), ...(options.headers||{}) }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 8) { await sleep(attempt * 1500); continue; }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0,600) : JSON.stringify(body).slice(0,600)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 8) await sleep(attempt * 1500);
    }
  }
  throw last;
}

const learnRows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=20');
if (!Array.isArray(learnRows) || learnRows.length !== 1) throw new Error(`Expected exactly one Learn parent page; found ${Array.isArray(learnRows)?learnRows.length:'invalid response'}.`);
const learn = learnRows[0];
const academyRows = await request('/wp-json/wp/v2/pages?slug=academy&context=edit&per_page=100');
const academyChildren = Array.isArray(academyRows) ? academyRows.filter(page => Number(page.parent) === Number(learn.id)) : [];
if (academyChildren.length !== 1) throw new Error(`Expected exactly one /learn/academy/ child page; found ${academyChildren.length}.`);
const page = academyChildren[0];
const before = rendered(page.content);
if (!before.includes('THC Academy') && !before.includes('DTF-PUBLIC-LEARNING-PAGE') && !before.includes('data-dtf-academy-v2')) throw new Error('Academy page does not look like the expected learning-center owner; refusing replacement.');

const courseNav = curriculum.courses.map(c => `<a href="#av2-${esc(c.id)}"><span>${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('');
const unitHtml = unit => `<article class="av2-unit"><h4>${esc(unit.title)}</h4><p>${esc(unit.task)}</p><div class="av2-verify"><strong>Verify</strong><span>${esc(unit.verify)}</span></div></article>`;
const exerciseHtml = ex => `<article class="av2-exercise"><p class="av2-label">Practical exercise</p><h4>${esc(ex.title)}</h4><p>${esc(ex.deliverable)}</p></article>`;
const courseHtml = course => `<section class="av2-course" data-av2-course="${esc(course.id)}" id="av2-${esc(course.id)}"><header><div><p class="av2-kicker">Course ${String(course.number).padStart(2,'0')}</p><h3>${esc(course.title)}</h3><p>${esc(course.purpose)}</p></div><a class="av2-ref" href="${esc(course.route)}">Open V6 subject →</a></header><aside class="av2-boundary"><strong>Evidence boundary</strong><span>${esc(course.evidenceBoundary)}</span></aside><div class="av2-units">${course.units.map(unitHtml).join('')}</div><div class="av2-practice">${course.exercises.map(exerciseHtml).join('')}<article class="av2-capstone"><p class="av2-label">Course capstone</p><h4>Show that you can use the system</h4><p>${esc(course.capstone)}</p></article></div><details class="av2-completion"><summary>Completion checklist</summary><ul>${course.completion.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></details></section>`;
const supportHtml = curriculum.supportRoutes.map(r => `<a href="${esc(r.href)}">${esc(r.label)} →</a>`).join('');

const content = `<style id="dtf-academy-v2-style">
body.page-id-${page.id} .entry-title,body.page-id-${page.id} .wp-block-post-title,body.page-id-${page.id} header.entry-header>h1{display:none!important}.av2{--deep:#102115;--forest:#254a2c;--green:#3f733f;--gold:#d8bd73;--cream:#f7f5ec;--paper:#fffdf8;--ink:#213626;--muted:#5c6b5e;--line:#dce3d8;background:linear-gradient(180deg,#f8f5ea,#eef4ea);color:var(--ink);padding:68px 0 82px}.av2 *{box-sizing:border-box}.av2-wrap{width:min(1200px,calc(100% - 34px));margin:auto}.av2-kicker,.av2-label{margin:0 0 7px;color:#806d32;font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.av2-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:26px;align-items:start}.av2 h2{margin:0;font-size:clamp(2.5rem,5vw,4.7rem);line-height:.96;letter-spacing:-.05em}.av2 h3{margin:0;font-size:clamp(2rem,3.5vw,3rem);line-height:1;letter-spacing:-.035em}.av2 h4{margin:0 0 8px}.av2 p{color:var(--muted);line-height:1.68}.av2-lede{font-size:1.08rem}.av2-stats{background:linear-gradient(145deg,var(--deep),var(--forest));border-radius:24px;padding:24px;color:#fff;display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.av2-stat strong{display:block;color:var(--gold);font-size:2.35rem;line-height:1}.av2-stat span{display:block;color:#d7e2d5;margin-top:5px;font-size:.88rem}.av2-rules{margin:28px 0;padding:22px;border:1px solid var(--line);border-radius:20px;background:#fff}.av2-rules ol{margin:0;padding-left:22px;columns:2;gap:34px}.av2-rules li{break-inside:avoid;margin:8px 0;color:#4c5e4e;line-height:1.55}.av2-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:30px 0 56px}.av2-nav a{padding:12px;border-radius:13px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.av2-nav span{display:block;color:#806d32;font-size:.65rem;margin-bottom:3px}.av2-course{padding:44px 0;border-top:1px solid var(--line)}.av2-course>header{display:flex;justify-content:space-between;gap:22px;align-items:end}.av2-course>header>div{max-width:830px}.av2-ref{white-space:nowrap;color:var(--green)!important;text-decoration:none!important;font-weight:900}.av2-boundary{display:flex;gap:12px;margin:18px 0;padding:13px 15px;border-left:4px solid var(--gold);background:#fff8e7;border-radius:10px}.av2-boundary strong{color:#68551f}.av2-boundary span{color:#625f51}.av2-units{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.av2-unit{background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:15px}.av2-unit h4{font-size:1rem}.av2-unit p{font-size:.9rem;margin:0}.av2-verify{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}.av2-verify strong{display:block;color:#806d32;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em}.av2-verify span{display:block;margin-top:4px;color:#536255;font-size:.84rem;line-height:1.48}.av2-practice{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.av2-exercise,.av2-capstone{padding:16px;border-radius:15px;border:1px solid #dce3d8;background:#f0f5ec}.av2-capstone{background:linear-gradient(145deg,#17321d,#2c512f);color:#fff;border:0}.av2-capstone p{color:#d6e2d4}.av2-capstone .av2-label{color:var(--gold)}.av2-completion{margin-top:11px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:0 16px}.av2-completion summary{cursor:pointer;padding:14px 0;font-weight:900}.av2-completion ul{margin-top:0;columns:2;color:#526254;line-height:1.55}.av2-support{margin-top:38px;padding:27px;border-radius:22px;background:linear-gradient(145deg,#142c18,#29482a);color:#fff}.av2-support p{color:#d1ddd0}.av2-links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.av2-links a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}
@media(max-width:1050px){.av2-units{grid-template-columns:repeat(2,minmax(0,1fr))}.av2-nav{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:800px){.av2-hero{grid-template-columns:1fr}.av2-practice,.av2-links{grid-template-columns:1fr}.av2-rules ol,.av2-completion ul{columns:1}}@media(max-width:620px){.av2{padding:50px 0 64px}.av2-wrap{width:min(100% - 26px,1200px)}.av2-nav,.av2-units{grid-template-columns:1fr}.av2-course>header{align-items:flex-start;flex-direction:column}.av2-boundary{display:block}.av2-boundary strong{display:block;margin-bottom:5px}}
</style><section class="av2" data-dtf-academy-v2="true"><div class="av2-wrap"><div class="av2-hero"><div><p class="av2-kicker">Teaching Healthy Cultivation · Academy V2</p><h2>${esc(curriculum.subtitle)}</h2><p class="av2-lede">${esc(curriculum.learningOutcome)}</p></div><aside class="av2-stats"><div class="av2-stat"><strong>${totals.courses}</strong><span>connected courses</span></div><div class="av2-stat"><strong>${totals.units}</strong><span>guided learning units</span></div><div class="av2-stat"><strong>${totals.exercises}</strong><span>practical exercises</span></div><div class="av2-stat"><strong>${totals.capstones}</strong><span>course capstones</span></div></aside></div><section class="av2-rules"><p class="av2-kicker">How to use the Academy</p><h3>Learn, do, verify.</h3><ol>${curriculum.studyRules.map(rule=>`<li>${esc(rule)}</li>`).join('')}</ol></section><nav class="av2-nav">${courseNav}</nav>${curriculum.courses.map(courseHtml).join('')}<section class="av2-support"><p class="av2-kicker">Supporting systems</p><h3>Use the reference layer when practice exposes a gap.</h3><p>The Academy is the practice layer. The V6 subject pages explain the system, the Encyclopedia goes deeper, records preserve evidence, and the diagnostic/tools layer helps organize real observations.</p><div class="av2-links">${supportHtml}</div></section></div></section>`;

const stamp = new Date().toISOString().replace(/[-:.]/g,'');
const backupDir = join(backupRoot, `academy-v2-${stamp}`);
await mkdir(backupDir, { recursive:true });
await writeFile(join(backupDir, `page-${page.id}-before.json`), `${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir, `academy-v2-planned.html`), `${content}\n`);

let changed = false;
try {
  const updated = await request(`/wp-json/wp/v2/pages/${page.id}`, { method:'POST', body:JSON.stringify({ title:'THC Academy', slug:'academy', parent:learn.id, status:'publish', content }) });
  changed = true;
  const restHtml = rendered(updated.content);
  const restCourses = (restHtml.match(/data-av2-course=/g) || []).length;
  const restUnits = (restHtml.match(/class="av2-unit"/g) || []).length;
  const restExercises = (restHtml.match(/class="av2-exercise"/g) || []).length;
  const restCapstones = (restHtml.match(/class="av2-capstone"/g) || []).length;
  if (!restHtml.includes('data-dtf-academy-v2="true"') || restCourses !== 12 || restUnits !== 60 || restExercises !== 24 || restCapstones !== 12) throw new Error(`REST verification failed: courses=${restCourses} units=${restUnits} exercises=${restExercises} capstones=${restCapstones}`);
  const report = { generatedAt:new Date().toISOString(), pageId:page.id, route:curriculum.route, ...totals, backupDir };
  await writeFile(join(backupDir,'report.json'), `${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
} catch (error) {
  if (changed) {
    try {
      await request(`/wp-json/wp/v2/pages/${page.id}`, { method:'POST', body:JSON.stringify({ title:page.title?.raw || 'THC Academy', slug:'academy', parent:learn.id, status:page.status || 'publish', content:before }) });
    } catch (rollbackError) {
      throw new Error(`${error.message}; rollback also failed: ${rollbackError.message}`);
    }
  }
  throw error;
}
