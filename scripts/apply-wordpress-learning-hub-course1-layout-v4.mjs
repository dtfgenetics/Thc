import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_LEARNING_HUB_COURSE1 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-hub-course1';
const rootSlug = 'safety-responsible-practice-cultivation-workflows';
const marker = 'dtf-learning-hub-course1-layout-v4';
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const rendered = value => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const must = (value, message) => { if (!value) throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const style = `<style id="${marker}">
.lhv3{--lhv4-rail:248px;--lhv4-context:248px;--lhv4-gap:20px}
.lhv3-layout.lhv4-lesson-layout{display:grid!important;grid-template-columns:var(--lhv4-rail) minmax(0,1fr) var(--lhv4-context)!important;gap:var(--lhv4-gap)!important;align-items:start!important}
.lhv3-layout.lhv4-lesson-layout>.lhv3-sidebar{grid-column:1!important;grid-row:1!important;order:-1!important;position:sticky!important;top:110px!important;max-height:calc(100vh - 132px)!important;overflow:auto!important;overscroll-behavior:contain!important;padding:14px!important;border-radius:14px!important;scrollbar-width:thin}
.lhv3-layout.lhv4-lesson-layout>.lhv3-main{grid-column:2!important;grid-row:1!important;min-width:0!important}
.lhv4-context{grid-column:3;grid-row:1;position:sticky;top:110px;align-self:start;min-width:0}
.lhv4-context-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;box-shadow:0 8px 24px rgba(13,42,25,.045)}
.lhv4-context-title{margin:0 0 10px;color:#173c27;font-size:.78rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
.lhv4-context .lhv3-objective,.lhv4-context .lhv3-toc{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}
.lhv4-context .lhv3-objective{border-left:0!important}
.lhv4-context .lhv3-objective strong,.lhv4-context .lhv3-toc>strong{display:block;margin:0 0 8px;color:#173c27;font-size:.88rem;font-weight:900}
.lhv4-context .lhv3-objective p{margin:0;color:#52655a;font-size:.88rem;line-height:1.58}
.lhv4-context .lhv3-toc{margin-top:14px!important;padding-top:14px!important;border-top:1px solid var(--line)!important}
.lhv4-context .lhv3-toc ul{margin:6px 0 0!important;padding:0!important;list-style:none!important;display:grid;gap:3px}
.lhv4-context .lhv3-toc a{display:block;padding:7px 8px;border-radius:8px;color:#355342!important;text-decoration:none!important;font-size:.84rem!important;font-weight:760!important;line-height:1.35}
.lhv4-context .lhv3-toc a:hover,.lhv4-context .lhv3-toc a:focus-visible{background:#eef4ef;color:#0c532b!important}
.lhv3-layout.lhv4-lesson-layout .lhv3-content{border-radius:14px!important;box-shadow:0 10px 26px rgba(13,42,25,.045)!important}
.lhv3-layout.lhv4-lesson-layout .lhv3-visual{border-radius:14px!important}
.lhv3-layout.lhv4-lesson-layout .lhv3-actions{align-items:center}
.lhv3-layout.lhv4-lesson-layout .lhv3-complete,.lhv3-layout.lhv4-lesson-layout .lhv3-button{min-height:44px;display:inline-flex;align-items:center;justify-content:center}
.lhv3-layout.lhv4-lesson-layout .lhv3-nextprev a{min-height:74px;display:flex;flex-direction:column;justify-content:center}
@media(max-width:1180px){
 .lhv3{--lhv4-rail:220px;--lhv4-gap:16px}
 .lhv3-layout.lhv4-lesson-layout{grid-template-columns:var(--lhv4-rail) minmax(0,1fr)!important}
 .lhv3-layout.lhv4-lesson-layout>.lhv3-sidebar{grid-column:1!important;grid-row:1 / span 2!important;top:96px!important;max-height:calc(100vh - 118px)!important}
 .lhv3-layout.lhv4-lesson-layout>.lhv3-main{grid-column:2!important;grid-row:2!important}
 .lhv4-context{grid-column:2!important;grid-row:1!important;position:static!important;display:block!important}
 .lhv4-context-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;padding:14px 16px}
 .lhv4-context-title{grid-column:1/-1;margin-bottom:0}
 .lhv4-context .lhv3-toc{margin-top:0!important;padding-top:0!important;padding-left:16px!important;border-top:0!important;border-left:1px solid var(--line)!important}
}
@media(max-width:900px){
 .lhv3-layout.lhv4-lesson-layout{grid-template-columns:minmax(0,1fr)!important;gap:14px!important}
 .lhv3-layout.lhv4-lesson-layout>.lhv3-sidebar{display:none!important}
 .lhv3-layout.lhv4-lesson-layout>.lhv3-main{grid-column:1!important;grid-row:2!important}
 .lhv4-context{grid-column:1!important;grid-row:1!important}
 .lhv4-context-card{grid-template-columns:1fr!important}
 .lhv4-context .lhv3-toc{padding-left:0!important;padding-top:12px!important;margin-top:2px!important;border-left:0!important;border-top:1px solid var(--line)!important}
 .lhv3-mobile-outline{display:block!important}
}
@media(max-width:600px){
 .lhv3-wrap{width:min(100% - 20px,1280px)!important}
 .lhv3-crumb{overflow-x:auto!important;flex-wrap:nowrap!important;white-space:nowrap!important;padding-bottom:5px!important;scrollbar-width:thin}
 .lhv3-hero{padding:22px 18px!important;border-radius:14px!important}
 .lhv3-hero h1{font-size:clamp(1.9rem,10vw,2.8rem)!important;line-height:1.02!important}
 .lhv3-meta{gap:7px!important}.lhv3-pill{font-size:.79rem!important;padding:7px 9px!important}
 .lhv3-content{padding:22px 18px!important}.lhv3-content h2{font-size:1.5rem!important}.lhv3-content h3{font-size:1.18rem!important}
 .lhv4-context-card{padding:13px!important}
 .lhv3-actions{display:grid!important;grid-template-columns:1fr!important}.lhv3-actions>*{width:100%!important}
 .lhv3-nextprev{grid-template-columns:1fr!important}.lhv3-nextprev a:last-child{text-align:left!important}
}
@media print{.lhv4-context{position:static!important}.lhv3-layout.lhv4-lesson-layout{display:block!important}.lhv3-layout.lhv4-lesson-layout>.lhv3-sidebar,.lhv4-context .lhv3-toc{display:none!important}}
</style>`;

const script = `<script id="${marker}-script">(function(){function enhance(){document.querySelectorAll('.lhv3-layout').forEach(function(layout){if(layout.dataset.lhv4==='1')return;var main=layout.querySelector(':scope > .lhv3-main');var sidebar=layout.querySelector(':scope > .lhv3-sidebar');if(!main||!sidebar)return;var objective=main.querySelector(':scope > .lhv3-objective');var toc=main.querySelector(':scope > .lhv3-toc');if(!objective&&!toc)return;layout.dataset.lhv4='1';layout.classList.add('lhv4-lesson-layout');sidebar.setAttribute('aria-label','Course navigation');var context=document.createElement('aside');context.className='lhv4-context';context.setAttribute('aria-label','Lesson context');var card=document.createElement('div');card.className='lhv4-context-card';var title=document.createElement('div');title.className='lhv4-context-title';title.textContent='Lesson guide';card.appendChild(title);if(objective)card.appendChild(objective);if(toc)card.appendChild(toc);context.appendChild(card);layout.appendChild(context);});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();})();</script>`;

if (validateOnly) {
  must(style.includes('grid-template-columns:var(--lhv4-rail) minmax(0,1fr) var(--lhv4-context)'), 'Desktop three-column layout is missing.');
  must(style.includes('@media(max-width:900px)'), 'Mobile course breakpoint is missing.');
  must(script.includes("layout.classList.add('lhv4-lesson-layout')"), 'Lesson layout enhancer is missing.');
  console.log(JSON.stringify({ result: 'success', version: 4, marker, rootSlug }, null, 2));
  process.exit(0);
}

must(apply, 'APPLY_LEARNING_HUB_COURSE1=true is required.');
must(user && pass, 'WordPress credentials are required.');

async function wp(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${site}/wp-json/wp/v2/${path}`, {
        ...options,
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'DTF-Learning-Hub-Course1-Layout/4.0',
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0, 500)}`);
      return text ? JSON.parse(text) : null;
    } catch (error) {
      last = error;
      if (attempt < 5) await sleep(attempt * 700);
    }
  }
  throw last;
}

async function findRoot() {
  const pages = await wp(`pages?slug=${encodeURIComponent(rootSlug)}&context=edit&per_page=100`);
  must(Array.isArray(pages) && pages.length >= 1, `Course root page not found for slug ${rootSlug}.`);
  return pages.find(page => rendered(page.content).includes('dtf-learning-hub-course1-ui-v3')) || pages[0];
}

async function collectTree(root) {
  const out = [root];
  const queue = [root.id];
  while (queue.length) {
    const parent = queue.shift();
    const children = await wp(`pages?parent=${parent}&context=edit&per_page=100&orderby=menu_order&order=asc`);
    for (const child of children || []) {
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}

function patch(content) {
  let next = String(content || '');
  next = next.replace(new RegExp(`<style\\s+id=["']${marker}["'][^>]*>[\\s\\S]*?<\\/style>`, 'gi'), '');
  next = next.replace(new RegExp(`<script\\s+id=["']${marker}-script["'][^>]*>[\\s\\S]*?<\\/script>`, 'gi'), '');
  return `${style}\n${script}\n${next.trimStart()}`;
}

const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `course1-layout-v4-${stamp}`);
await mkdir(backupDir, { recursive: true });

const root = await findRoot();
const pages = await collectTree(root);
must(pages.length >= 25, `Expected a complete Course 1 page tree; found only ${pages.length} pages.`);

const updated = [];
for (const page of pages) {
  const before = rendered(page.content);
  must(before.length > 0, `Page ${page.id} ${page.slug} has empty content.`);
  await writeFile(join(backupDir, `page-${page.id}-${page.slug}-before.html`), before);
  const content = patch(before);
  await wp(`pages/${page.id}`, { method: 'POST', body: JSON.stringify({ content, status: 'publish' }) });
  updated.push({ id: page.id, slug: page.slug, parent: page.parent, bytes: content.length });
}

for (const page of updated) {
  const current = await wp(`pages/${page.id}?context=edit`);
  const content = rendered(current?.content);
  must(content.includes(`id="${marker}"`), `V4 course layout marker missing after write on ${page.slug}.`);
}

const report = {
  result: 'success',
  version: 4,
  marker,
  rootPageId: root.id,
  rootSlug,
  pageCount: updated.length,
  updated
};
await writeFile(join(backupDir, 'course1-layout-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'course1-layout-v4-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
