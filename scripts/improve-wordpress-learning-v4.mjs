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
  'User-Agent': 'DTFSeeds-Learning-Hierarchy/4.1'
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
const goalHeading = 'Start with the question you are trying to answer.';
const mapHeading = 'See how the subjects connect before you go deep.';

const styles = `<style id="${styleId}">
.v3 .learning-map-v4{position:relative;overflow:hidden;background:linear-gradient(180deg,#f6f2e8 0%,#edf3ec 100%)}
.v3 .learning-map-v4:after{content:"";position:absolute;width:360px;height:360px;right:-190px;bottom:-220px;border:1px solid rgba(194,157,59,.18);border-radius:50%;box-shadow:0 0 0 48px rgba(194,157,59,.035),0 0 0 96px rgba(194,157,59,.02);pointer-events:none}
.v3 .learning-map-grid{position:relative;z-index:1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:12px}
.v3 .learning-map-grid:before{content:"";position:absolute;left:7%;right:7%;top:29px;height:1px;background:linear-gradient(90deg,transparent,rgba(17,43,28,.2) 8%,rgba(17,43,28,.2) 92%,transparent)}
.v3 .learning-map-step{position:relative;z-index:1;padding:0 8px 12px;text-align:center}
.v3 .learning-map-step b{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 16px;border-radius:17px;background:linear-gradient(180deg,#173b27,#07170f);color:#efd786;box-shadow:0 8px 22px rgba(7,23,15,.15);font-size:.82rem;letter-spacing:.04em}
.v3 .learning-map-step h3{margin:0 0 7px;font-size:1.02rem;line-height:1.18;letter-spacing:-.02em}
.v3 .learning-map-step p{margin:0;color:#5f7065;font-size:.87rem;line-height:1.55}
.v3 .learning-map-step .v3-text-link{display:inline-flex;margin-top:10px;font-size:.86rem}
.v3 .learning-map-cue{position:relative;z-index:1;margin-top:30px;padding:18px 20px;border-left:4px solid #c29d3b;border-radius:0 14px 14px 0;background:#fffdf7;color:#344d3e;line-height:1.65;box-shadow:0 8px 24px rgba(17,43,28,.05)}
@media(max-width:1020px){.v3 .learning-map-grid{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:28px}.v3 .learning-map-grid:before{display:none}}
@media(max-width:640px){.v3 .learning-map-grid{grid-template-columns:1fr;gap:20px}.v3 .learning-map-step{display:grid;grid-template-columns:58px 1fr;gap:0 15px;text-align:left;padding:0}.v3 .learning-map-step b{grid-row:1 / span 3;margin:0}.v3 .learning-map-step h3{margin:4px 0 5px}.v3 .learning-map-step p,.v3 .learning-map-step .v3-text-link{grid-column:2}.v3 .learning-map-step .v3-text-link{margin-top:7px}}
</style>`;

const guidedMarkup = `${startMarker}
<section class="section learning-map-v4" id="learning-map" data-dtf-learning-map="v4"><div class="wrap">
  <div class="heading"><div><p class="eyebrow">Learning map</p><h2>${mapHeading}</h2></div><p>Most cultivation questions move through the same connected chain: plant → environment → root zone → management → plant health → finish and improvement.</p></div>
  <div class="learning-map-grid" aria-label="Teaching Healthy Cultivation learning sequence">
    <article class="learning-map-step"><b>01</b><h3>Plant</h3><p>Biology, anatomy and lifecycle.</p><a class="v3-text-link" href="/learn/plant-biology/">Plant biology <span aria-hidden="true">→</span></a></article>
    <article class="learning-map-step"><b>02</b><h3>Environment</h3><p>Temperature, RH, VPD, airflow and light.</p><a class="v3-text-link" href="/learn/environment-vpd/">Environment <span aria-hidden="true">→</span></a></article>
    <article class="learning-map-step"><b>03</b><h3>Root zone</h3><p>Water, media, oxygen, pH and EC.</p><a class="v3-text-link" href="/learn/water-ph-ec/">Root-zone science <span aria-hidden="true">→</span></a></article>
    <article class="learning-map-step"><b>04</b><h3>Manage</h3><p>Propagation, training, canopy and records.</p><a class="v3-text-link" href="/learn/training-canopy/">Crop management <span aria-hidden="true">→</span></a></article>
    <article class="learning-map-step"><b>05</b><h3>Protect</h3><p>Prevention, scouting, diagnosis and IPM.</p><a class="v3-text-link" href="/learn/ipm/">Plant health &amp; IPM <span aria-hidden="true">→</span></a></article>
    <article class="learning-map-step"><b>06</b><h3>Finish &amp; improve</h3><p>Harvest, post-harvest, genetics and evidence.</p><a class="v3-text-link" href="/learn/harvest-postharvest/">Harvest &amp; quality <span aria-hidden="true">→</span></a></article>
  </div>
  <div class="learning-map-cue"><strong>Use the map as a loop, not a one-way course.</strong> Enter where the problem is, then move backward to the underlying system or forward to the next decision.</div>
</div></section>
${endMarker}`;

const pages = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(pages) || pages.length !== 1) throw new Error(`Expected exactly one Learn page, found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
const page = pages[0];
await writeFile(join(backupDir, `learn-page-${page.id}-before.json`), `${JSON.stringify(page, null, 2)}\n`);

let content = raw(page.content);
content = stripStyle(content, styleId);
content = stripMarked(content, startMarker, endMarker);

if (!content.includes('data-dtf-layout="learn-v3"') && !content.includes('dtf-learning-v3-style')) {
  throw new Error('Current Learn V3 layout marker was not found; refusing to modify an unknown page structure.');
}

const goalHeadingAt = content.indexOf(goalHeading);
if (goalHeadingAt < 0) throw new Error(`Learn goal heading was not found: ${goalHeading}`);
const goalSectionStart = content.lastIndexOf('<section', goalHeadingAt);
const goalSectionEnd = content.indexOf('</section>', goalHeadingAt);
if (goalSectionStart < 0 || goalSectionEnd < 0 || goalSectionEnd <= goalSectionStart) {
  throw new Error('Could not resolve the current Learn goal section boundaries.');
}
const goalSection = content.slice(goalSectionStart, goalSectionEnd + '</section>'.length);
for (const anchor of ['class="section"', 'Choose your goal', 'class="path-grid"', '/learn/start-here/', '/thc-grow-doc/']) {
  if (!goalSection.includes(anchor)) throw new Error(`Learn goal section is missing expected anchor: ${anchor}`);
}

const insertAt = goalSectionEnd + '</section>'.length;
content = `${styles}\n${content.slice(0, insertAt)}\n${guidedMarkup}\n${content.slice(insertAt)}`;

for (const required of [styleId, 'data-dtf-learning-map="v4"', mapHeading, '/learn/plant-biology/', '/learn/environment-vpd/', '/learn/water-ph-ec/', '/learn/training-canopy/', '/learn/ipm/', '/learn/harvest-postharvest/']) {
  if (!content.includes(required)) throw new Error(`Learning V4 build is missing required marker: ${required}`);
}

if (content.indexOf(mapHeading) < content.indexOf(goalHeading)) {
  throw new Error('Learning map was inserted before the goal chooser instead of after it.');
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
    if (response.ok && html.includes(styleId) && html.includes('data-dtf-learning-map="v4"') && html.includes(mapHeading) && html.includes('/learn/water-ph-ec/')) {
      verified = true;
      break;
    }
    await sleep(3500);
  }
  if (!verified) throw new Error('Live Learn page did not expose the Learning V4 map after publication.');
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
  insertionAnchor: goalHeading,
  learningMapSteps: 6
};
await writeFile(join(backupDir, 'learning-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'learning-v4-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
