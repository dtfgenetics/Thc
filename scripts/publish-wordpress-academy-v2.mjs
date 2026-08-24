import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_ACADEMY_V2 || '').toLowerCase() === 'true';
const source = process.env.ACADEMY_V2_PATH || 'site/wordpress/education/academy-v2.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-academy-v2';
const data = JSON.parse(await readFile(source, 'utf8'));
const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered = v => typeof v === 'string' ? v : (v?.raw || v?.rendered || '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function validate(d) {
  if (d?.schemaVersion !== 1 || d?.id !== 'thc-academy-v2' || d?.route !== '/learn/academy/') throw new Error('Invalid Academy V2 identity.');
  if (!Array.isArray(d.studyRules) || d.studyRules.length < 5) throw new Error('Academy V2 requires five study rules.');
  if (!Array.isArray(d.courses) || d.courses.length !== 12) throw new Error(`Expected 12 courses, found ${d?.courses?.length || 0}.`);
  const ids = new Set(); let units=0, exercises=0, capstones=0, checklistItems=0;
  for (const c of d.courses) {
    if (!c.id || ids.has(c.id)) throw new Error(`Duplicate/missing course id: ${c.id}`); ids.add(c.id);
    if (!c.title || !c.route || !c.purpose || !c.evidenceBoundary) throw new Error(`${c.id}: incomplete metadata.`);
    if (!Array.isArray(c.units) || c.units.length !== 5) throw new Error(`${c.id}: expected 5 units.`);
    if (!Array.isArray(c.exercises) || c.exercises.length !== 2) throw new Error(`${c.id}: expected 2 exercises.`);
    if (!c.capstone || !Array.isArray(c.completion) || c.completion.length < 4) throw new Error(`${c.id}: capstone/checklist incomplete.`);
    for (const u of c.units) if (!u.title || !u.task || !u.verify) throw new Error(`${c.id}: incomplete unit.`);
    for (const e of c.exercises) if (!e.title || !e.deliverable) throw new Error(`${c.id}: incomplete exercise.`);
    units += 5; exercises += 2; capstones += 1; checklistItems += c.completion.length;
  }
  if (!Array.isArray(d.supportRoutes) || d.supportRoutes.length < 5) throw new Error('Support routes incomplete.');
  const text = JSON.stringify(d);
  const unsupportedPositiveClaims = [/guaranteed\s+yield/i,/amber\s*=\s*couchlock/i,/zero[- ]risk\s+isolation\s+(?:is|can be)\s+guaranteed/i,/always\s+use\s+\d/i];
  for (const re of unsupportedPositiveClaims) if (re.test(text)) throw new Error(`Unsupported universal claim found: ${re}`);
  return { courses:12, units, exercises, capstones, checklistItems, supportRoutes:d.supportRoutes.length };
}
const totals = validate(data);
if (validateOnly) { console.log(JSON.stringify({valid:true,id:data.id,route:data.route,...totals},null,2)); process.exit(0); }
if (!apply) throw new Error('Set APPLY_ACADEMY_V2=true for production.');
if (!user || !pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

async function request(path, options={}) {
  let last;
  for (let attempt=1; attempt<=8; attempt++) {
    try {
      const response = await fetch(`${site}${path}`, { ...options, redirect:'follow', signal:AbortSignal.timeout(60000), headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Academy-V2/1.1',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})} });
      const text = await response.text(); let body=text; try { body=text?JSON.parse(text):null; } catch {}
      if ((response.status===429 || response.status>=500) && attempt<8) { await sleep(attempt*1500); continue; }
      if (!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    } catch (error) { last=error; if (attempt<8) await sleep(attempt*1500); }
  }
  throw last;
}

const learnRows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=20');
if (!Array.isArray(learnRows) || learnRows.length !== 1) throw new Error(`Expected one Learn parent, found ${Array.isArray(learnRows)?learnRows.length:'invalid'}.`);
const learn = learnRows[0];
const rows = await request('/wp-json/wp/v2/pages?slug=academy&context=edit&per_page=100');
const children = Array.isArray(rows) ? rows.filter(p => Number(p.parent) === Number(learn.id)) : [];
if (children.length !== 1) throw new Error(`Expected one /learn/academy/ child, found ${children.length}.`);
const page = children[0];
const before = rendered(page.content);
if (!before.includes('THC Academy') && !before.includes('DTF-PUBLIC-LEARNING-PAGE') && !before.includes('data-dtf-academy-v2')) throw new Error('Academy page ownership check failed.');

const unit = u => `<article class="av2-unit"><h4>${esc(u.title)}</h4><p>${esc(u.task)}</p><div class="av2-verify"><b>Verify</b><span>${esc(u.verify)}</span></div></article>`;
const exercise = e => `<article class="av2-exercise"><small>Practical exercise</small><h4>${esc(e.title)}</h4><p>${esc(e.deliverable)}</p></article>`;
const course = c => `<section class="av2-course" data-av2-course="${esc(c.id)}" id="av2-${esc(c.id)}"><header><div><small>Course ${String(c.number).padStart(2,'0')}</small><h3>${esc(c.title)}</h3><p>${esc(c.purpose)}</p></div><a href="${esc(c.route)}">Open V6 subject →</a></header><aside class="av2-boundary"><b>Evidence boundary</b><span>${esc(c.evidenceBoundary)}</span></aside><div class="av2-units">${c.units.map(unit).join('')}</div><div class="av2-practice">${c.exercises.map(exercise).join('')}<article class="av2-capstone"><small>Course capstone</small><h4>Show that you can use the system</h4><p>${esc(c.capstone)}</p></article></div><details class="av2-check"><summary>Completion checklist</summary><ul>${c.completion.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></section>`;
const nav = data.courses.map(c=>`<a href="#av2-${esc(c.id)}"><span>${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('');
const support = data.supportRoutes.map(r=>`<a href="${esc(r.href)}">${esc(r.label)} →</a>`).join('');
const css = `<style id="dtf-academy-v2-style">body.page-id-${page.id} .entry-title,body.page-id-${page.id} .wp-block-post-title,body.page-id-${page.id} header.entry-header>h1{display:none!important}.av2{--d:#102115;--g:#3f733f;--gold:#d8bd73;--bg:#f6f5ed;--p:#fffdf8;--ink:#213626;--muted:#5c6b5e;--line:#dce3d8;background:linear-gradient(180deg,#f8f5ea,#eef4ea);color:var(--ink);padding:68px 0 82px}.av2 *{box-sizing:border-box}.av2-wrap{width:min(1200px,calc(100% - 34px));margin:auto}.av2 small{display:block;color:#806d32;font-weight:950;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}.av2 h2{font-size:clamp(2.5rem,5vw,4.7rem);line-height:.96;letter-spacing:-.05em;margin:0}.av2 h3{font-size:clamp(1.9rem,3.4vw,2.9rem);line-height:1;letter-spacing:-.035em;margin:0}.av2 h4{margin:0 0 8px}.av2 p{color:var(--muted);line-height:1.65}.av2-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:26px}.av2-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;background:linear-gradient(145deg,var(--d),#29482a);border-radius:24px;padding:24px;color:white}.av2-stats b{display:block;color:var(--gold);font-size:2.25rem}.av2-rules{margin:28px 0;padding:22px;background:white;border:1px solid var(--line);border-radius:20px}.av2-rules ol{columns:2;gap:34px}.av2-rules li{margin:8px 0;color:#4c5e4e}.av2-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:30px 0 56px}.av2-nav a{padding:12px;border:1px solid var(--line);border-radius:13px;background:white;color:var(--ink)!important;text-decoration:none!important;font-weight:850}.av2-nav span{display:block;color:#806d32;font-size:.65rem}.av2-course{padding:44px 0;border-top:1px solid var(--line)}.av2-course>header{display:flex;justify-content:space-between;align-items:end;gap:22px}.av2-course>header>div{max-width:830px}.av2-course>header>a{color:var(--g)!important;font-weight:900;text-decoration:none!important;white-space:nowrap}.av2-boundary{display:flex;gap:12px;margin:18px 0;padding:13px 15px;border-left:4px solid var(--gold);background:#fff8e7;border-radius:10px}.av2-units{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.av2-unit{padding:15px;background:var(--p);border:1px solid var(--line);border-radius:15px}.av2-unit p{font-size:.9rem;margin:0}.av2-verify{border-top:1px solid var(--line);margin-top:11px;padding-top:9px}.av2-verify b{display:block;color:#806d32;font-size:.68rem;text-transform:uppercase}.av2-verify span{display:block;color:#536255;font-size:.84rem;margin-top:4px}.av2-practice{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.av2-exercise,.av2-capstone{padding:16px;border-radius:15px;background:#f0f5ec;border:1px solid var(--line)}.av2-capstone{background:linear-gradient(145deg,#17321d,#2c512f);color:white;border:0}.av2-capstone p{color:#d6e2d4}.av2-capstone small{color:var(--gold)}.av2-check{margin-top:11px;padding:0 16px;background:white;border:1px solid var(--line);border-radius:14px}.av2-check summary{padding:14px 0;font-weight:900;cursor:pointer}.av2-check ul{columns:2}.av2-support{margin-top:38px;padding:27px;border-radius:22px;background:linear-gradient(145deg,#142c18,#29482a);color:white}.av2-support p{color:#d1ddd0}.av2-links{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.av2-links a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:white!important;text-decoration:none!important;font-weight:850}@media(max-width:1050px){.av2-units{grid-template-columns:repeat(2,1fr)}.av2-nav{grid-template-columns:repeat(3,1fr)}}@media(max-width:800px){.av2-hero,.av2-practice,.av2-links{grid-template-columns:1fr}.av2-rules ol,.av2-check ul{columns:1}}@media(max-width:620px){.av2{padding:50px 0 64px}.av2-wrap{width:min(100% - 26px,1200px)}.av2-nav,.av2-units{grid-template-columns:1fr}.av2-course>header{align-items:flex-start;flex-direction:column}.av2-boundary{display:block}}</style>`;
const content = `${css}<section class="av2" data-dtf-academy-v2="true"><div class="av2-wrap"><div class="av2-hero"><div><small>Teaching Healthy Cultivation · Academy V2</small><h2>${esc(data.subtitle)}</h2><p>${esc(data.learningOutcome)}</p></div><aside class="av2-stats"><div><b>${totals.courses}</b><span>connected courses</span></div><div><b>${totals.units}</b><span>guided units</span></div><div><b>${totals.exercises}</b><span>practical exercises</span></div><div><b>${totals.capstones}</b><span>capstones</span></div></aside></div><section class="av2-rules"><small>How to use the Academy</small><h3>Learn, do, verify.</h3><ol>${data.studyRules.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section><nav class="av2-nav">${nav}</nav>${data.courses.map(course).join('')}<section class="av2-support"><small>Supporting systems</small><h3>Use the reference layer when practice exposes a gap.</h3><p>The Academy is the practice layer. V6 subjects explain the system, the Encyclopedia goes deeper, records preserve evidence, and tools organize real observations.</p><div class="av2-links">${support}</div></section></div></section>`;

const stamp = new Date().toISOString().replace(/[-:.]/g,'');
const backupDir = join(backupRoot,`academy-v2-${stamp}`); await mkdir(backupDir,{recursive:true});
await writeFile(join(backupDir,`page-${page.id}-before.json`),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'academy-v2-planned.html'),`${content}\n`);
let changed=false;
try {
  const updated = await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({title:'THC Academy',slug:'academy',parent:learn.id,status:'publish',content})}); changed=true;
  const html=rendered(updated.content); const counts={courses:(html.match(/data-av2-course=/g)||[]).length,units:(html.match(/class="av2-unit"/g)||[]).length,exercises:(html.match(/class="av2-exercise"/g)||[]).length,capstones:(html.match(/class="av2-capstone"/g)||[]).length};
  if (!html.includes('data-dtf-academy-v2="true"') || counts.courses!==12 || counts.units!==60 || counts.exercises!==24 || counts.capstones!==12) throw new Error(`REST verification failed: ${JSON.stringify(counts)}`);
  const report={generatedAt:new Date().toISOString(),pageId:page.id,route:data.route,...totals,backupDir}; await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`); console.log(JSON.stringify(report,null,2));
} catch (error) {
  if (changed) { try { await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({title:page.title?.raw||'THC Academy',slug:'academy',parent:learn.id,status:page.status||'publish',content:before})}); } catch (rollbackError) { throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`); } }
  throw error;
}
