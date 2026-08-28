import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const file = 'site/wordpress/education/outdoor-applied-v1.json';
const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_OUTDOOR_APPLIED_V1 || '').toLowerCase() === 'true';
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-outdoor-applied-v1';
const start = '<!-- thc-outdoor-applied-v1:start -->';
const end = '<!-- thc-outdoor-applied-v1:end -->';

const fail = (message) => { throw new Error(message); };
const esc = (v = '') => String(v)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const rendered = (v) => typeof v === 'string' ? v : (v?.raw || v?.rendered || '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadData() {
  return JSON.parse(await readFile(join(ROOT, file), 'utf8'));
}

function validateData(data) {
  if (data?.schemaVersion !== 1 || data?.id !== 'outdoor-applied-v1') fail('Invalid Outdoor applied schema/id');
  if (data.route !== '/learn/outdoor/') fail(`Unexpected route ${data.route}`);
  if (!data.title || !data.purpose || !data.evidenceBoundary) fail('Missing Outdoor applied metadata');
  if (!Array.isArray(data.sourceRefs) || data.sourceRefs.length < 6) fail('Expected at least six evidence references');
  const sourceIds = new Set();
  for (const source of data.sourceRefs) {
    if (!source.id || sourceIds.has(source.id) || !source.type || !source.citation || !source.supports) fail(`Invalid source ${source.id || 'unknown'}`);
    sourceIds.add(source.id);
  }
  if (!Array.isArray(data.modules) || data.modules.length !== 5) fail('Expected exactly five applied modules');
  const moduleIds = new Set();
  let lessons = 0;
  for (const module of data.modules) {
    if (!module.id || moduleIds.has(module.id)) fail(`Missing/duplicate module id ${module.id}`);
    moduleIds.add(module.id);
    if (!module.title || !module.learnerQuestion || !Array.isArray(module.sourceIds) || module.sourceIds.length < 1) fail(`${module.id}: incomplete module metadata`);
    for (const sourceId of module.sourceIds) if (!sourceIds.has(sourceId)) fail(`${module.id}: unknown source ${sourceId}`);
    if (!Array.isArray(module.lessons) || module.lessons.length !== 4) fail(`${module.id}: expected four lessons`);
    if (!Array.isArray(module.fieldChecklist) || module.fieldChecklist.length < 8) fail(`${module.id}: field checklist too thin`);
    for (const lesson of module.lessons) {
      lessons += 1;
      for (const key of ['title', 'coreIdea', 'inspect', 'decision', 'avoid']) if (!lesson[key] || String(lesson[key]).length < 45) fail(`${module.id}/${lesson.title || 'lesson'}: missing or thin ${key}`);
    }
  }
  if (lessons !== 20) fail(`Expected 20 applied lessons, found ${lessons}`);

  const raw = JSON.stringify(data).toLowerCase();
  const forbidden = [
    /harvest at \d+\s*%/,
    /universal.*(?:spacing|irrigation|flowering date|frost|harvest)/,
    /all photoperiod.*(?:12 hours|12 h)/,
    /curing (?:kills|removes|fixes) mold/,
    /rain(?:fall)? (?:total|amount) (?:equals|is) root-zone recharge/
  ];
  for (const pattern of forbidden) if (pattern.test(raw)) fail(`Forbidden universal/unsupported claim matched ${pattern}`);
  return { modules: data.modules.length, lessons, sources: data.sourceRefs.length, checklists: data.modules.length };
}

function sourceCards(data, ids) {
  const wanted = new Set(ids || []);
  return data.sourceRefs
    .filter((source) => wanted.has(source.id))
    .map((source) => `<article class="oav1-source"><span>${esc(source.id)} · ${esc(source.type)}</span><strong>${esc(source.citation)}</strong><p>${esc(source.supports)}</p></article>`)
    .join('');
}

function lessonCard(lesson, index) {
  return `<article class="oav1-lesson"><div class="oav1-lesson-head"><span>${String(index + 1).padStart(2, '0')}</span><h4>${esc(lesson.title)}</h4></div><p class="oav1-core">${esc(lesson.coreIdea)}</p><div class="oav1-three"><section><strong>Inspect first</strong><p>${esc(lesson.inspect)}</p></section><section><strong>Decision framework</strong><p>${esc(lesson.decision)}</p></section><section><strong>Avoid this shortcut</strong><p>${esc(lesson.avoid)}</p></section></div></article>`;
}

function moduleBlock(data, module) {
  return `<details class="oav1-module" id="oav1-${esc(module.id)}" data-oav1-module="${esc(module.id)}"><summary><span>Module ${String(module.number).padStart(2, '0')}</span><div><h3>${esc(module.title)}</h3><p>${esc(module.learnerQuestion)}</p></div></summary><div class="oav1-module-body"><div class="oav1-lessons">${module.lessons.map(lessonCard).join('')}</div><div class="oav1-bottom"><article class="oav1-check"><p class="oav1-kicker">Field checklist</p><h4>Capture these before you call the problem solved</h4><ul>${module.fieldChecklist.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></article><article><p class="oav1-kicker">Evidence context</p><div class="oav1-sources">${sourceCards(data, module.sourceIds)}</div></article></div></div></details>`;
}

function renderBlock(data) {
  const styles = `<style id="thc-outdoor-applied-v1-style">
.oav1{--deep:#071b16;--forest:#103b2e;--green:#1f704f;--gold:#a9852e;--cream:#f7f4ea;--paper:#fffdf8;--ink:#143027;--muted:#52665e;--line:#d7e2dc;background:#f7f4ea;color:var(--ink);padding:58px 0 72px}.oav1 *{box-sizing:border-box}.oav1-wrap{width:min(1120px,calc(100% - 34px));margin:auto}.oav1-kicker{margin:0 0 7px!important;color:#78672f!important;font-size:.7rem!important;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.oav1-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:start;margin-bottom:28px}.oav1 h2{margin:0;font-size:clamp(2.2rem,4.8vw,4rem);line-height:.98;letter-spacing:-.045em}.oav1 h3{margin:0;font-size:clamp(1.35rem,2.5vw,2rem);line-height:1.05}.oav1 h4{margin:0}.oav1 p,.oav1 li{color:var(--muted);line-height:1.6}.oav1-boundary{padding:17px 18px;border-radius:16px;background:#fff9eb;border:1px solid #eadbb8;border-left:4px solid var(--gold)}.oav1-boundary strong{display:block;color:#5f5124;margin-bottom:5px}.oav1-module{background:var(--paper);border:1px solid var(--line);border-radius:20px;margin:12px 0;overflow:hidden}.oav1-module>summary{display:grid;grid-template-columns:95px 1fr;gap:15px;padding:21px;cursor:pointer;list-style:none;background:linear-gradient(135deg,#fffdf8,#f0f5f1)}.oav1-module>summary::-webkit-details-marker{display:none}.oav1-module>summary>span{display:inline-flex;align-items:center;justify-content:center;height:35px;border-radius:999px;background:#e6efe9;color:#3d6553;font-size:.68rem;font-weight:950;letter-spacing:.05em}.oav1-module>summary p{margin:6px 0 0}.oav1-module-body{padding:0 20px 22px}.oav1-lessons{display:grid;gap:11px}.oav1-lesson{padding:17px;border:1px solid #e0e7e3;border-radius:15px;background:#fff}.oav1-lesson-head{display:flex;gap:10px;align-items:center}.oav1-lesson-head>span{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#edf3ef;color:#3d6553;font-size:.68rem;font-weight:950}.oav1-core{margin:10px 0 12px}.oav1-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.oav1-three section{padding:12px;border-radius:12px;background:#f3f6f4;border:1px solid #e1e8e4}.oav1-three section:nth-child(2){background:#eef5f0}.oav1-three section:nth-child(3){background:#fff8eb;border-color:#eadfc6}.oav1-three strong{font-size:.8rem;color:#365546}.oav1-three p{margin:5px 0 0;font-size:.89rem}.oav1-bottom{display:grid;grid-template-columns:.8fr 1.2fr;gap:12px;margin-top:13px}.oav1-bottom>article{padding:15px;border-radius:14px;background:#f3f6f4;border:1px solid #e0e7e3}.oav1-check ul{margin:8px 0 0;padding-left:1.15rem}.oav1-check li{margin:5px 0;font-size:.9rem}.oav1-sources{display:grid;gap:7px}.oav1-source{padding:10px;border-radius:10px;background:#fff;border:1px solid #dfe7e2}.oav1-source span{display:block;color:#78672f;font-size:.63rem;font-weight:950;text-transform:uppercase}.oav1-source strong{display:block;margin:4px 0;font-size:.8rem;line-height:1.4}.oav1-source p{margin:0;font-size:.84rem}@media(max-width:860px){.oav1-hero,.oav1-bottom{grid-template-columns:1fr}.oav1-three{grid-template-columns:1fr}}@media(max-width:620px){.oav1-module>summary{grid-template-columns:1fr}.oav1-module-body{padding:0 13px 16px}.oav1-lesson{padding:13px}}
</style>`;
  return `${start}${styles}<section class="oav1" data-thc-outdoor-applied-v1="true"><div class="oav1-wrap"><div class="oav1-hero"><div><p class="oav1-kicker">THC · Teaching Healthy Cultivation · Applied Outdoor field guide</p><h2>Make outdoor decisions from evidence, not recipes.</h2><p>${esc(data.purpose)}</p></div><div class="oav1-boundary"><strong>Evidence boundary</strong><p>${esc(data.evidenceBoundary)}</p></div></div>${data.modules.map((module) => moduleBlock(data, module)).join('')}</div></section>${end}`;
}

function stripExisting(content) {
  const a = content.indexOf(start);
  if (a < 0) return content.trimEnd();
  const b = content.indexOf(end, a);
  if (b < 0) fail('Found Outdoor applied start marker without end marker');
  return `${content.slice(0, a)}${content.slice(b + end.length)}`.trimEnd();
}

async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
          Accept: 'application/json',
          'User-Agent': 'THC-Outdoor-Applied-V1/1.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 8) {
        await sleep(attempt * 1500);
        continue;
      }
      if (!response.ok) fail(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 8) await sleep(attempt * 1500);
    }
  }
  throw last;
}

async function pageBySlug(slug) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  if (!Array.isArray(rows) || rows.length !== 1) fail(`Expected one WordPress page for ${slug}, found ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

const data = await loadData();
const validation = validateData(data);
if (validateOnly) {
  console.log(JSON.stringify({ valid: true, id: data.id, ...validation }, null, 2));
  process.exit(0);
}
if (!apply) fail('Refusing production write: set APPLY_OUTDOOR_APPLIED_V1=true');
if (!user || !pass) fail('WP_API_USERNAME and WP_API_PASSWORD are required');

const page = await pageBySlug('outdoor');
const before = rendered(page.content);
const clean = stripExisting(before);
const next = `${clean}\n\n${renderBlock(data)}`;
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `outdoor-applied-v1-${stamp}`);
await mkdir(backupDir, { recursive: true });
await writeFile(join(backupDir, 'before.html'), before, 'utf8');
await writeFile(join(backupDir, 'after.html'), next, 'utf8');

const updated = await request(`/wp-json/wp/v2/pages/${page.id}`, {
  method: 'POST',
  body: JSON.stringify({ content: next, status: 'publish' })
});
const stored = rendered(updated.content);
if (!stored.includes('data-thc-outdoor-applied-v1="true"')) fail('WordPress response missing Outdoor applied marker');
for (const module of data.modules) if (!stored.includes(`data-oav1-module="${module.id}"`)) fail(`WordPress response missing module ${module.id}`);

const report = {
  ok: true,
  pageId: page.id,
  route: data.route,
  validation,
  backupDir,
  publishedAt: new Date().toISOString()
};
await writeFile(join(backupDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
