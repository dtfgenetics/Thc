import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_LEARN_TASK_NAV_V5 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learn-task-nav-v5';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Learn-Task-Nav-V5/1.1',
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `learn-task-nav-v5-${stamp}`);
await mkdir(backupDir, { recursive: true });

async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          ...headers,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
      });
      const text = await response.text();
      let body = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 8) {
        await sleep(attempt * 1600);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 8) await sleep(attempt * 1600);
    }
  }
  throw last;
}

function stripExistingTaskNav(html) {
  return html
    .replace(/<!-- DTF-LEARN-TASK-NAV-V5-START -->[\s\S]*?<!-- DTF-LEARN-TASK-NAV-V5-END -->/g, '')
    .trim();
}

function stripLegacyGoalSection(html) {
  const marker = '<p class="eyebrow">Choose your goal</p>';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return html;

  const sectionStart = html.lastIndexOf('<section class="section">', markerIndex);
  const sectionEndStart = html.indexOf('</section>', markerIndex);
  if (sectionStart < 0 || sectionEndStart < 0) return html;

  const sectionEnd = sectionEndStart + '</section>'.length;
  return `${html.slice(0, sectionStart)}${html.slice(sectionEnd)}`.trim();
}

function insertAfterHero(html, block) {
  const heroMarker = '<section class="hero">';
  const heroStart = html.indexOf(heroMarker);
  if (heroStart < 0) return `${block}\n${html}`;

  const heroEndStart = html.indexOf('</section>', heroStart);
  if (heroEndStart < 0) return `${block}\n${html}`;

  const heroEnd = heroEndStart + '</section>'.length;
  return `${html.slice(0, heroEnd)}\n${block}\n${html.slice(heroEnd)}`;
}

const rows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(rows) || rows.length !== 1) {
  throw new Error(`Expected one Learn page, found ${Array.isArray(rows) ? rows.length : 'invalid'}`);
}

const page = rows[0];
const raw = page?.content?.raw || page?.content?.rendered || '';
await writeFile(join(backupDir, `page-${page.id}-learn-before.json`), `${JSON.stringify(page, null, 2)}\n`);

const block = `<!-- DTF-LEARN-TASK-NAV-V5-START -->
<style id="dtf-learn-task-nav-v5-style">
.taskv5{padding:58px 0 62px;background:#0d2a19;color:#fff}
.taskv5 *{box-sizing:border-box}
.taskv5 .wrap{width:min(1180px,calc(100% - 34px));margin:auto}
.taskv5 .head{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:24px}
.taskv5 .head>div{max-width:720px}
.taskv5 .eyebrow{margin:0 0 8px;color:#d7b95f;font-size:.75rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.taskv5 h2{margin:0;font-size:clamp(2rem,4vw,3.35rem);line-height:1.02;letter-spacing:-.04em}
.taskv5 .head>p{max-width:510px;margin:0;color:#bfd0c4;line-height:1.62}
.taskv5 .primary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.taskv5 .primary-card{display:flex;flex-direction:column;min-height:250px;padding:24px;border:1px solid #3a6046;border-radius:22px;background:#12351f}
.taskv5 .primary-card .tag{color:#efd577;font-size:.72rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase}
.taskv5 .primary-card h3{margin:10px 0 9px;font-size:clamp(1.35rem,2vw,1.75rem);line-height:1.16}
.taskv5 .primary-card p{margin:0;color:#c6d7ca;line-height:1.62}
.taskv5 .primary-card a{margin-top:auto;padding-top:18px;color:#efd577!important;text-decoration:none!important;font-weight:900}
.taskv5 .primary-card a:hover,.taskv5 .primary-card a:focus{text-decoration:underline!important}
.taskv5 .tools-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:34px 0 14px}
.taskv5 .tools-head h3{margin:0;font-size:1.35rem}
.taskv5 .tools-head p{margin:0;color:#9fb6a5}
.taskv5 .tool-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
.taskv5 .tool{display:flex;min-height:92px;align-items:flex-end;padding:15px;border:1px solid #31543d;border-radius:14px;background:#102f1c;color:#fff!important;text-decoration:none!important;font-weight:800;line-height:1.25}
.taskv5 .tool:hover,.taskv5 .tool:focus{border-color:#d7b95f;text-decoration:none!important}
@media(max-width:980px){.taskv5 .tool-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:820px){.taskv5 .primary-grid{grid-template-columns:1fr}.taskv5 .primary-card{min-height:210px}.taskv5 .head{align-items:flex-start;flex-direction:column}}
@media(max-width:620px){.taskv5{padding:46px 0 50px}.taskv5 .wrap{width:min(100% - 26px,1180px)}.taskv5 .tool-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.taskv5 .tools-head{align-items:flex-start;flex-direction:column}}
</style>
<section class="taskv5" data-dtf-learn-task-nav-v5="true">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="eyebrow">Choose your path</p>
        <h2>Learn, identify, or explore.</h2>
      </div>
      <p>Go straight to what you need. Start with a guided sequence, work from evidence when a plant looks wrong, or search the deeper learning library.</p>
    </div>

    <div class="primary-grid">
      <article class="primary-card">
        <span class="tag">Learn</span>
        <h3>Teach me cannabis plant science</h3>
        <p>Build the foundations in sequence: plant biology, environment, water, light, nutrition, lifecycle, health, genetics, harvest, and outdoor growing.</p>
        <a href="/learn/start-here/">Start learning →</a>
      </article>

      <article class="primary-card">
        <span class="tag">Identify</span>
        <h3>Help me understand a plant problem</h3>
        <p>Start from symptoms and measurements, compare plausible causes, and verify the evidence before choosing an action.</p>
        <a href="/learn/diagnostics/">Open diagnostic guidance →</a>
      </article>

      <article class="primary-card">
        <span class="tag">Explore</span>
        <h3>Search the learning library</h3>
        <p>Jump directly to a subject, encyclopedia lesson, visual reference, or definition when you already know what you want to investigate.</p>
        <a href="/learn/search/">Search education →</a>
      </article>
    </div>

    <div class="tools-head">
      <h3>Reference tools</h3>
      <p>Deeper resources for identification, records, visuals, and research.</p>
    </div>
    <div class="tool-grid" aria-label="Learning reference tools">
      <a class="tool" href="/learn/pests-diseases/">Pests &amp; diseases</a>
      <a class="tool" href="/learn/encyclopedia/">Encyclopedia</a>
      <a class="tool" href="/learn/infographics/">Infographics</a>
      <a class="tool" href="/growlens/">GrowLens</a>
      <a class="tool" href="/thc-grow-doc/">Grow Doc</a>
      <a class="tool" href="/learn/glossary/">Glossary</a>
    </div>
  </div>
</section>
<!-- DTF-LEARN-TASK-NAV-V5-END -->`;

const cleaned = stripExistingTaskNav(raw);
const withoutLegacyGoal = stripLegacyGoalSection(cleaned);
const content = insertAfterHero(withoutLegacyGoal, block);

if (apply) {
  await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    body: JSON.stringify({ content, status: 'publish' }),
  });
}

if (apply) {
  let ok = false;
  let html = '';
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const response = await fetch(`${siteUrl}/learn/?dtf_task_v5=${Date.now()}-${attempt}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
        },
      });
      html = await response.text();
      if (
        response.ok &&
        html.includes('data-dtf-learn-task-nav-v5="true"') &&
        html.includes('Learn, identify, or explore.') &&
        !html.includes('Choose your goal')
      ) {
        ok = true;
        break;
      }
    } catch {}
    await sleep(attempt * 2200);
  }

  if (!ok) throw new Error('Learn task-navigation marker or simplified front door did not appear');

  for (const href of [
    '/learn/start-here/',
    '/learn/diagnostics/',
    '/learn/search/',
    '/learn/pests-diseases/',
    '/learn/encyclopedia/',
    '/learn/infographics/',
    '/growlens/',
    '/thc-grow-doc/',
    '/learn/glossary/',
  ]) {
    if (!html.includes(href)) throw new Error(`Learn task navigation missing ${href}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  apply,
  pageId: page.id,
  url: `${siteUrl}/learn/`,
  primaryPaths: ['learn', 'identify', 'explore'],
  legacyGoalRemoved: true,
};
await writeFile(join(backupDir, 'learn-task-nav-v5-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
