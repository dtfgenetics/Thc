import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_LEARNING_V4 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-v4';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Learning-Hierarchy/4.0'
};
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `learning-v4-${stamp}`);
await mkdir(backupDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        await sleep(1800 * attempt);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        await sleep(1800 * attempt);
        continue;
      }
    }
  }
  throw lastError;
}

function raw(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

function stripStyle(content, id) {
  return String(content || '').replace(new RegExp(`<style\\s+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/style>`, 'gi'), '').trimStart();
}

function stripMarked(content, start, end) {
  let next = String(content || '');
  for (;;) {
    const first = next.indexOf(start);
    if (first < 0) return next;
    const last = next.indexOf(end, first + start.length);
    if (last < 0) throw new Error(`Found ${start} without matching ${end}`);
    next = `${next.slice(0, first)}${next.slice(last + end.length)}`;
  }
}

const styleId = 'dtf-learning-v4';
const startMarker = '<!-- DTF-LEARN-GUIDED-V4-START -->';
const endMarker = '<!-- DTF-LEARN-GUIDED-V4-END -->';

const styles = `<style id="${styleId}">
.dtf-learning-v4{background:linear-gradient(180deg,#f6f2e8 0%,#eef3ec 100%)!important}
.dtf-learning-v4 .dtf-heading{margin-bottom:26px!important}
.dtf-learning-modes{display:grid;grid-template-columns:1.25fr repeat(3,minmax(0,.75fr));gap:14px}
.dtf-learning-mode{min-height:235px;display:flex;flex-direction:column;justify-content:flex-end;padding:28px;border:1px solid rgba(17,43,28,.1);border-radius:24px;background:#fffdf7;box-shadow:0 10px 30px rgba(17,43,28,.055);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.dtf-learning-mode:hover{transform:translateY(-4px);box-shadow:0 20px 40px rgba(17,43,28,.1);border-color:rgba(38,120,74,.24)}
.dtf-learning-mode:first-child{background:linear-gradient(135deg,#0a2316,#163c27);color:#fff;border-color:transparent}
.dtf-learning-mode:nth-child(3){background:linear-gradient(145deg,#f2e7c7,#e1c97f);color:#182718}
.dtf-learning-mode .dtf-mode-number{display:grid;place-items:center;width:38px;height:38px;margin-bottom:auto;border-radius:11px;background:#edf3ec;color:#176d39;font-weight:900;font-size:.82rem}
.dtf-learning-mode:first-child .dtf-mode-number{background:rgba(215,185,101,.14);color:#efd786}
.dtf-learning-mode:nth-child(3) .dtf-mode-number{background:rgba(17,43,28,.09);color:#173420}
.dtf-learning-mode h3{margin:24px 0 7px;font-size:1.32rem;line-height:1.1}
.dtf-learning-mode p{margin:0!important;color:#5f7065!important;line-height:1.6!important}
.dtf-learning-mode:first-child p{color:#c8d9ce!important}
.dtf-learning-mode a{display:inline-flex;margin-top:15px;color:#26784a!important;text-decoration:none!important;font-weight:900}
.dtf-learning-mode:first-child a{color:#edd68d!important}
.dtf-learning-map-section{background:#fffdf7!important}
.dtf-learning-map{position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:8px}
.dtf-learning-map:before{content:"";position:absolute;left:7%;right:7%;top:29px;height:1px;background:linear-gradient(90deg,transparent,rgba(17,43,28,.2) 8%,rgba(17,43,28,.2) 92%,transparent)}
.dtf-learning-step{position:relative;z-index:1;padding:0 8px 16px;text-align:center}
.dtf-learning-step b{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 16px;border-radius:17px;background:linear-gradient(180deg,#123622,#07170f);color:#efd786;box-shadow:0 8px 22px rgba(7,23,15,.15);font-size:.85rem}
.dtf-learning-step h3{margin:0 0 7px;font-size:1.02rem;line-height:1.18}
.dtf-learning-step p{margin:0!important;color:#5f7065!important;font-size:.87rem;line-height:1.55!important}
.dtf-learning-step a{display:inline-flex;margin-top:10px;color:#26784a!important;text-decoration:none!important;font-size:.86rem;font-weight:900}
.dtf-learning-step a:hover{text-decoration:underline!important}
.dtf-learning-cue{margin-top:30px;padding:18px 20px;border-left:4px solid #d7b965;border-radius:0 14px 14px 0;background:#edf3ec;color:#344d3e;line-height:1.65}
@media(max-width:980px){.dtf-learning-modes{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-learning-map{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:28px}.dtf-learning-map:before{display:none}}
@media(max-width:640px){.dtf-learning-modes,.dtf-learning-map{grid-template-columns:1fr}.dtf-learning-mode{min-height:205px}.dtf-learning-step{display:grid;grid-template-columns:58px 1fr;gap:15px;text-align:left;padding:0}.dtf-learning-step b{margin:0}.dtf-learning-step h3{margin-top:4px}.dtf-learning-step p,.dtf-learning-step a{grid-column:2}.dtf-learning-step a{margin-top:0}}
</style>`;

const guidedMarkup = `${startMarker}
<section class="dtf-section dtf-learning-v4" id="choose-learning-mode"><div class="dtf-wrap">
  <div class="dtf-heading"><div><p class="dtf-eyebrow">Choose your learning mode</p><h2>Start with the kind of answer you need.</h2></div><p>You do not need to understand the whole library before you can use it. Pick a learning mode first; the subject catalog stays available below when you are ready to go deeper.</p></div>
  <div class="dtf-learning-modes">
    <article class="dtf-learning-mode"><span class="dtf-mode-number">01</span><h3>Build the foundation</h3><p>New to cultivation science or trying to replace disconnected tips with a working mental model?</p><a href="/learn/start-here/">Start with the fundamentals →</a></article>
    <article class="dtf-learning-mode"><span class="dtf-mode-number">02</span><h3>Solve a plant problem</h3><p>Begin with observations and evidence, then follow the clues into plant health, roots, environment or nutrition.</p><a href="/thc-grow-doc/">Start a structured diagnosis →</a></article>
    <article class="dtf-learning-mode"><span class="dtf-mode-number">03</span><h3>Study a subject deeply</h3><p>Use the encyclopedia when the question needs reference-level detail, connected concepts and deeper context.</p><a href="/learn/encyclopedia/">Open the Encyclopedia →</a></article>
    <article class="dtf-learning-mode"><span class="dtf-mode-number">04</span><h3>Learn visually</h3><p>Use detailed diagrams and full-sheet infographics when anatomy, processes, comparisons or measurements are easier to see.</p><a href="/learn/infographics/">Open the Visual Library →</a></article>
  </div>
</div></section>
<section class="dtf-section dtf-learning-map-section" id="learning-map"><div class="dtf-wrap">
  <div class="dtf-heading"><div><p class="dtf-eyebrow">Learning map</p><h2>Build understanding in connected layers.</h2></div><p>The plant, environment and root zone interact. Crop management, plant health and harvest decisions make more sense when those foundations are already connected.</p></div>
  <div class="dtf-learning-map">
    <article class="dtf-learning-step"><b>01</b><h3>Plant</h3><p>Biology, anatomy and lifecycle.</p><a href="/learn/plant-biology/">Plant biology →</a></article>
    <article class="dtf-learning-step"><b>02</b><h3>Environment</h3><p>Temperature, RH, VPD, airflow and light.</p><a href="/learn/environment-vpd/">Environment →</a></article>
    <article class="dtf-learning-step"><b>03</b><h3>Root zone</h3><p>Water, media, oxygen, pH and EC.</p><a href="/learn/water-ph-ec/">Root-zone science →</a></article>
    <article class="dtf-learning-step"><b>04</b><h3>Manage</h3><p>Propagation, training, canopy and records.</p><a href="/learn/training-canopy/">Crop management →</a></article>
    <article class="dtf-learning-step"><b>05</b><h3>Protect</h3><p>Prevention, scouting, diagnosis and IPM.</p><a href="/learn/ipm/">Plant health & IPM →</a></article>
    <article class="dtf-learning-step"><b>06</b><h3>Finish & improve</h3><p>Harvest, post-harvest, genetics and evidence.</p><a href="/learn/harvest-postharvest/">Harvest & quality →</a></article>
  </div>
  <div class="dtf-learning-cue"><strong>Use the subject library as a map, not a checklist.</strong> You can enter at the problem you actually have, then move backward to the underlying system or forward to the next decision.</div>
</div></section>
${endMarker}`;

const pages = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(pages) || pages.length !== 1) throw new Error(`Expected exactly one Learn page, found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
const page = pages[0];
await writeFile(join(backupDir, `learn-page-${page.id}-before.json`), `${JSON.stringify(page, null, 2)}\n`);

let content = raw(page.content);
content = stripStyle(content, styleId);
content = stripMarked(content, startMarker, endMarker);

content = content
  .replace('<p class="dtf-eyebrow">Explore by subject</p><h2>Go directly to the correct subject library.</h2>', '<p class="dtf-eyebrow">Subject library</p><h2>Explore the plant by connected systems.</h2>')
  .replace('Every card below opens its own companion literature. Infographics support the subject pages; they are no longer the only destination.', 'Once you know the kind of answer you need, use these subject libraries to follow the system involved. Each subject connects plant science, measurement and practical cultivation context.');

const quickbarStart = content.indexOf('<div class="dtf-wrap dtf-quickbar">');
if (quickbarStart < 0) throw new Error('Learn quickbar was not found; refusing to guess an insertion point.');
const quickbarEnd = content.indexOf('</nav></div>', quickbarStart);
if (quickbarEnd < 0) throw new Error('Learn quickbar closing markup was not found; refusing to guess an insertion point.');
const insertAt = quickbarEnd + '</nav></div>'.length;
content = `${styles}\n${content.slice(0, insertAt)}\n${guidedMarkup}\n${content.slice(insertAt)}`;

for (const required of ['dtf-learning-v4', 'Choose your learning mode', '/learn/start-here/', '/thc-grow-doc/', '/learn/encyclopedia/', '/learn/infographics/', '/learn/plant-biology/', '/learn/environment-vpd/', '/learn/water-ph-ec/', '/learn/ipm/']) {
  if (!content.includes(required)) throw new Error(`Learning V4 build is missing required marker: ${required}`);
}

if (apply) {
  await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    body: JSON.stringify({ content, status: 'publish' })
  });

  let verified = false;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await fetch(`${siteUrl}/learn/?dtf_learning_v4=${Date.now()}-${attempt}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000)
    });
    const html = await response.text();
    if (response.ok && html.includes('dtf-learning-v4') && html.includes('Choose how you want to learn.') === false && html.includes('Start with the kind of answer you need.') && html.includes('/learn/water-ph-ec/')) {
      verified = true;
      break;
    }
    await sleep(3500);
  }
  if (!verified) throw new Error('Live Learn page did not expose the Learning V4 hierarchy after publication.');
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  backupDir,
  pageId: page.id,
  sourceBytes: raw(page.content).length,
  outputBytes: content.length,
  guidedHierarchy: true,
  learningModes: 4,
  learningMapSteps: 6
};
await writeFile(join(backupDir, 'learning-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'learning-v4-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
