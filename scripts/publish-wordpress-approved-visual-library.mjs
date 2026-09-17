import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_APPROVED_VISUAL_LIBRARY || '').toLowerCase() === 'true';
const literaturePath = process.env.TOPIC_LITERATURE_CONFIG || join(process.cwd(), 'site/wordpress/education/topic-literature.json');
const policyPath = process.env.DTF_VISUAL_QUALITY_POLICY || join(process.cwd(), 'site/wordpress/visual-quality-policy.json');
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-approved-visual-library';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const [literature, policy] = await Promise.all([
  readFile(literaturePath, 'utf8').then(JSON.parse),
  readFile(policyPath, 'utf8').then(JSON.parse),
]);
if (!Array.isArray(literature?.topics) || literature.topics.length < 10) throw new Error('Canonical topic literature is incomplete');
if (Number(policy?.schemaVersion || 0) < 3 || policy?.mode !== 'quarantine') throw new Error('Visual quality quarantine policy v3+ is required');
if (policy?.replacementPolicy?.legacyInfographicReuseAllowed !== false) throw new Error('Legacy infographic reuse must remain disabled');
if (policy?.replacementPolicy?.automaticKeywordMediaSelectionAllowed !== false) throw new Error('Automatic keyword media selection must remain disabled');
if (policy?.replacementPolicy?.imageLessFallbackPreferred !== true) throw new Error('Image-less fallback must remain enabled');

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `approved-visual-library-${stamp}`);
await mkdir(backupDir, { recursive: true });

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTFSeeds-Approved-Visual-Library/1.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 7) {
        await sleep(attempt * 1600);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 7) await sleep(attempt * 1600);
    }
  }
  throw lastError;
}

async function findSinglePage(slug, parent = null) {
  const parentQuery = parent === null ? '' : `&parent=${Number(parent)}`;
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}${parentQuery}&context=edit&status=publish&per_page=100`);
  const candidates = Array.isArray(rows) ? rows : [];
  const exact = parent === null ? candidates.filter((page) => Number(page.parent || 0) === 0) : candidates.filter((page) => Number(page.parent || 0) === Number(parent));
  if (exact.length !== 1) throw new Error(`Expected exactly one published ${slug} page${parent === null ? ' at root' : ` under parent ${parent}`}; found ${exact.length}`);
  return exact[0];
}

const learn = await findSinglePage('learn');
let libraryRows = await request(`/wp-json/wp/v2/pages?slug=infographics&parent=${learn.id}&context=edit&status=publish&per_page=100`);
let library = Array.isArray(libraryRows) ? libraryRows[0] || null : null;
if (Array.isArray(libraryRows) && libraryRows.length > 1) throw new Error(`Multiple published infographics pages exist under Learn: ${libraryRows.map((page) => page.id).join(', ')}`);

const topicCards = literature.topics.map((topic, index) => {
  const route = String(topic.route || '').startsWith('/learn/') ? topic.route : '/learn/';
  return `<article class="avl-topic"><span>${String(index + 1).padStart(2, '0')}</span><h2><a href="${esc(route)}">${esc(topic.title)}</a></h2><p>${esc(topic.summary || 'Open the subject literature and current approved references.')}</p><a class="avl-link" href="${esc(route)}">Open subject →</a></article>`;
}).join('');

const content = `<main class="dtf-approved-visual-library" data-dtf-approved-visual-library="v1">
<style id="dtf-approved-visual-library-v1">
.dtf-approved-visual-library{--deep:#07170f;--deep2:#123622;--leaf:#26784a;--gold:#d5b15a;--paper:#fffdf7;--cream:#f5f1e7;--ink:#112b1c;--muted:#607066;--line:rgba(17,43,28,.12);color:var(--ink);background:linear-gradient(180deg,#f9f6ef,#f2efe7);padding:0 0 72px}.dtf-approved-visual-library *{box-sizing:border-box}.avl-wrap{width:min(1180px,calc(100% - 36px));margin:auto}.avl-hero{padding:clamp(64px,9vw,118px) 0;background:radial-gradient(circle at 78% 16%,rgba(213,177,90,.24),transparent 28%),linear-gradient(135deg,var(--deep),#0c2819 58%,var(--deep2));color:#fff}.avl-kicker{margin:0 0 14px;color:#e4c976;font-size:.75rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.avl-hero h1{max-width:900px;margin:0;font-size:clamp(2.8rem,7vw,6.2rem);line-height:.92;letter-spacing:-.055em}.avl-hero .lede{max-width:820px;margin:24px 0 0;color:#d5e3d9;font-size:clamp(1rem,1.6vw,1.2rem);line-height:1.75}.avl-status{margin-top:30px;max-width:900px;padding:20px 22px;border:1px solid rgba(229,203,122,.34);border-radius:16px;background:rgba(255,255,255,.065);color:#eef5f0}.avl-status strong{color:#efd988}.avl-section{padding:clamp(48px,7vw,82px) 0}.avl-heading{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.72fr);gap:30px;align-items:end;margin-bottom:30px}.avl-heading h2{margin:0;font-size:clamp(2rem,4vw,3.8rem);line-height:.98;letter-spacing:-.045em}.avl-heading p{margin:0;color:var(--muted);line-height:1.7}.avl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.avl-topic{min-height:230px;padding:24px;border:1px solid var(--line);border-radius:18px;background:rgba(255,253,247,.95);box-shadow:0 10px 28px rgba(17,43,28,.055);display:flex;flex-direction:column}.avl-topic>span{color:#9b771c;font-size:.72rem;font-weight:900;letter-spacing:.12em}.avl-topic h2{margin:12px 0 10px;font-size:1.35rem;line-height:1.15}.avl-topic h2 a{color:var(--ink);text-decoration:none}.avl-topic p{margin:0;color:var(--muted);line-height:1.62}.avl-link{margin-top:auto;padding-top:20px;color:var(--leaf);font-weight:850;text-decoration:none}.avl-standard{padding:28px;border-radius:20px;background:linear-gradient(145deg,#0b2517,#173d28);color:#fff}.avl-standard h2{margin-top:0}.avl-standard p{color:#cfe0d4;line-height:1.7}.avl-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.avl-actions a{display:inline-flex;min-height:44px;align-items:center;padding:10px 14px;border-radius:10px;background:#fff;color:#153421;font-weight:850;text-decoration:none}.avl-actions a:first-child{background:linear-gradient(180deg,#e2c676,#d5b15a)}
@media(max-width:900px){.avl-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.avl-heading{grid-template-columns:1fr}}
@media(max-width:620px){.avl-wrap{width:min(100% - 28px,1180px)}.avl-grid{grid-template-columns:1fr}.avl-topic{min-height:0}.avl-actions a{width:100%;justify-content:center}}
</style>
<section class="avl-hero"><div class="avl-wrap"><p class="avl-kicker">Teaching Healthy Cultivation</p><h1>Approved Visual Library</h1><p class="lede">Plant-science visuals belong here only after they pass subject-accuracy, typography, crop, placement, and responsive review. The written Learning system remains fully available while replacement visuals are rebuilt and approved.</p><div class="avl-status"><strong>Visual review in progress.</strong> The previous legacy infographic collection has been retired from public display. No image is used as filler, and no automatic keyword match can promote an unrelated graphic into a public teaching slot.</div></div></section>
<section class="avl-section"><div class="avl-wrap"><div class="avl-heading"><div><p class="avl-kicker" style="color:#8a6818">Subject directory</p><h2>Learn from the source material now.</h2></div><p>Use the subject pages for current literature, study questions, measurements, and connected concepts. Approved replacement visuals will be added back to the exact subject where they belong.</p></div><div class="avl-grid">${topicCards}</div></div></section>
<section class="avl-section" style="padding-top:0"><div class="avl-wrap"><div class="avl-standard"><p class="avl-kicker">Production standard</p><h2>Accuracy before image count.</h2><p>A missing visual is temporary. A wrong visual teaches the wrong thing. Replacement assets are published only after they are accurate for the subject, legible at the rendered size, correctly cropped, and reviewed on phone, tablet, laptop, and desktop.</p><div class="avl-actions"><a href="/learn/">Learning home</a><a href="/learn/start-here/">Start here</a><a href="/learn/research-methods/">Evidence & measurement</a></div></div></div></section>
</main>`;

if (/<img\b/i.test(content)) throw new Error('Approved Visual Library must remain image-less until role-specific visuals are approved');
for (const forbidden of ['dtf-edu-', 'THC-C0', 'THC-ENC-', 'Outdoor-0', 'Searchable Infographic Library']) {
  if (content.includes(forbidden)) throw new Error(`Approved Visual Library accidentally contains retired marker: ${forbidden}`);
}

if (library) await writeFile(join(backupDir, `page-${library.id}-infographics-before.json`), `${JSON.stringify(library, null, 2)}\n`);
const payload = {
  slug: 'infographics',
  parent: learn.id,
  title: 'THC Approved Visual Library',
  content,
  status: 'publish',
  featured_media: 0,
};

if (apply) {
  library = library
    ? await request(`/wp-json/wp/v2/pages/${library.id}`, { method: 'POST', body: JSON.stringify(payload) })
    : await request('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify(payload) });
}

if (apply) {
  const stored = await findSinglePage('infographics', learn.id);
  const storedContent = rendered(stored.content);
  if (!storedContent.includes('data-dtf-approved-visual-library="v1"')) throw new Error('Stored Approved Visual Library marker is missing');
  if (/<img\b/i.test(storedContent)) throw new Error('Stored Approved Visual Library unexpectedly contains image markup');
  if (/dtf-edu-|THC[-_ ]?(?:C\d{3}|ENC[-_ ]?\d{3})|Outdoor[-_ ]?\d{2}/i.test(storedContent)) throw new Error('Stored Approved Visual Library contains a retired visual identity');
  if (Number(stored.featured_media || 0) !== 0) throw new Error('Approved Visual Library still has featured media');
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  backupDir,
  learnPageId: Number(learn.id),
  libraryPageId: Number(library?.id || 0),
  topicCount: literature.topics.length,
  imagePolicy: 'role-specific-approved-only',
  imageCount: 0,
  featuredMedia: 0,
  marker: 'data-dtf-approved-visual-library="v1"',
  storageVerification: apply ? 'success' : 'not-applied',
};
await writeFile(join(backupDir, 'approved-visual-library-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'approved-visual-library-latest.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
