import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_LEARN_V4 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learn-v4';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Learn-Visual-V4/1.0'
};

const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `learn-v4-${stamp}`);
await mkdir(backupDir, { recursive: true });

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const rendered = value => typeof value === 'string' ? value : (value?.rendered || value?.raw || '');
const plain = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        await sleep(1400 * attempt);
        continue;
      }
      if (!response.ok) {
        throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(1400 * attempt);
    }
  }
  throw lastError;
}

async function getPage(slug) {
  const body = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  return Array.isArray(body) ? body[0] || null : null;
}

async function fetchMedia() {
  const rows = [];
  for (let page = 1; page <= 6; page += 1) {
    try {
      const body = await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if (!Array.isArray(body) || !body.length) break;
      rows.push(...body);
      if (body.length < 100) break;
    } catch (error) {
      if (/invalid_page_number|400/i.test(error.message)) break;
      throw error;
    }
  }
  return rows;
}

function mediaText(item) {
  return [item?.slug, rendered(item?.title), item?.alt_text, rendered(item?.caption), rendered(item?.description), item?.source_url]
    .join(' ')
    .toLowerCase();
}

function selectMedia(media, groups, used = new Set()) {
  for (const group of groups) {
    const terms = Array.isArray(group) ? group : [group];
    const match = media.find(item => {
      if (!item?.source_url || used.has(item.id)) return false;
      const haystack = mediaText(item);
      return terms.every(term => haystack.includes(String(term).toLowerCase()));
    });
    if (match) {
      used.add(match.id);
      return match;
    }
  }
  const fallback = media.find(item => item?.source_url && !used.has(item.id) && /image\//i.test(item?.mime_type || '')) || null;
  if (fallback) used.add(fallback.id);
  return fallback;
}

function image(item, fallbackAlt, className = '') {
  if (!item) return `<div class="v4-media-placeholder ${esc(className)}" aria-hidden="true"></div>`;
  const src = item.source_url || item?.guid?.rendered || '';
  const alt = plain(item.alt_text || rendered(item.title) || fallbackAlt);
  return `<img class="${esc(className)}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

const routes = [
  { href: '/learn/start-here/', icon: '01', title: 'Start Here', copy: 'Follow the ordered foundation path before jumping into advanced cultivation topics.', tone: 'Foundation' },
  { href: '/atlas/', icon: '02', title: 'Living Plant Atlas', copy: 'Explore plant structures visually and connect anatomy to function and cultivation decisions.', tone: 'Interactive' },
  { href: '/learn/academy/', icon: '03', title: 'Academy', copy: 'Work through structured lessons that turn plant science into repeatable understanding.', tone: 'Courses' },
  { href: '/learn/encyclopedia/', icon: '04', title: 'Encyclopedia', copy: 'Use the reference library when you need depth on a specific plant-science subject.', tone: 'Reference' },
  { href: '/learn/infographics/', icon: '05', title: 'Visual Library', copy: 'Browse full-sheet educational graphics by subject instead of digging through long text pages.', tone: 'Visual' },
  { href: '/learn/beginner-guides/', icon: '06', title: 'Beginner Guides', copy: 'Get direct explanations for the questions that matter most when you are still building fundamentals.', tone: 'Beginner' },
  { href: '/learn/sops/', icon: '07', title: 'SOPs & Measurement', copy: 'Turn observations into consistent records, measurements, and repeatable cultivation practices.', tone: 'Practical' },
  { href: '/learn/glossary/', icon: '08', title: 'Glossary', copy: 'Look up terminology quickly without leaving the learning system.', tone: 'Reference' },
  { href: '/learn/records/', icon: '09', title: 'Printables & Records', copy: 'Use printable records and tracking tools to document what happened and why.', tone: 'Downloads' }
];

const subjects = [
  { href: '/learn/plant-biology/', title: 'Plant Biology', copy: 'Anatomy, tissues, transport, signaling, photosynthesis, respiration, and growth.' },
  { href: '/learn/environment-vpd/', title: 'Environment & VPD', copy: 'Temperature, humidity, vapor pressure deficit, airflow, and plant response.' },
  { href: '/learn/lighting/', title: 'Lighting', copy: 'PPFD, DLI, spectrum, photoperiod, intensity, and canopy-level light decisions.' },
  { href: '/learn/water-root-zone/', title: 'Water & Root Zone', copy: 'Root function, irrigation, oxygen, dryback, substrate behavior, pH, and EC.' },
  { href: '/learn/nutrition/', title: 'Nutrition', copy: 'Macro- and micronutrients, availability, mobility, antagonism, and plant response.' },
  { href: '/learn/ipm/', title: 'IPM & Plant Health', copy: 'Prevention, observation, pest pressure, disease reasoning, and integrated response.' },
  { href: '/learn/genetics/', title: 'Genetics & Propagation', copy: 'Genotype, phenotype, seeds, clones, inheritance, selection, and propagation.' },
  { href: '/learn/harvest-post-harvest/', title: 'Harvest & Post-Harvest', copy: 'Maturity, harvest timing, drying, curing, storage, and quality preservation.' }
];

const css = `<style id="dtf-learn-v4-style">
:root{--l4-deep:#07170f;--l4-forest:#0d2819;--l4-green:#1e6a3d;--l4-moss:#315d42;--l4-gold:#d7b85b;--l4-cream:#f7f3e7;--l4-paper:#fffdf7;--l4-soft:#e9efe8;--l4-line:#d4dfd5;--l4-ink:#14331f;--l4-muted:#587063;--l4-white:#fff}
.dtf-learn-v4{background:var(--l4-cream);color:var(--l4-ink);overflow:hidden}.dtf-learn-v4 *{box-sizing:border-box}.dtf-learn-v4 a{text-underline-offset:3px}.dtf-learn-v4 .wrap{width:min(1220px,calc(100% - 36px));margin:0 auto}.dtf-learn-v4 .hero{position:relative;padding:78px 0 66px;color:#fff;background:radial-gradient(circle at 86% 12%,rgba(215,184,91,.21),transparent 28%),linear-gradient(145deg,var(--l4-deep),var(--l4-forest));overflow:hidden}.dtf-learn-v4 .hero:after{content:"";position:absolute;width:480px;height:480px;border:1px solid rgba(215,184,91,.18);border-radius:50%;right:-180px;bottom:-260px}.dtf-learn-v4 .hero-grid{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(340px,.96fr);gap:52px;align-items:center}.dtf-learn-v4 .kicker,.dtf-learn-v4 .eyebrow{margin:0 0 11px;color:var(--l4-gold);font-size:.76rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.dtf-learn-v4 h1{max-width:820px;margin:0;font-size:clamp(3rem,6.5vw,6rem);line-height:.92;letter-spacing:-.06em}.dtf-learn-v4 .hero .lede{max-width:720px;margin:24px 0 0;color:#d7e4db;font-size:1.1rem;line-height:1.75}.dtf-learn-v4 .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.dtf-learn-v4 .btn{display:inline-flex;align-items:center;justify-content:center;min-height:47px;padding:11px 18px;border-radius:999px;border:1px solid transparent;text-decoration:none!important;font-weight:900}.dtf-learn-v4 .btn.primary{background:var(--l4-gold);border-color:var(--l4-gold);color:var(--l4-deep)!important}.dtf-learn-v4 .btn.secondary{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.28);color:#fff!important}.dtf-learn-v4 .hero-media{position:relative;min-height:470px}.dtf-learn-v4 .hero-media:before{content:"";position:absolute;inset:-14px 18px 18px -14px;border:1px solid rgba(215,184,91,.55);border-radius:31px}.dtf-learn-v4 .hero-media img,.dtf-learn-v4 .hero-media .v4-media-placeholder{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:27px;background:linear-gradient(145deg,#173e27,#315c43);box-shadow:0 28px 70px rgba(0,0,0,.28)}.dtf-learn-v4 .hero-badge{position:absolute;z-index:2;left:20px;bottom:20px;max-width:290px;padding:14px 16px;border:1px solid rgba(255,255,255,.22);border-radius:18px;background:rgba(5,20,12,.78);backdrop-filter:blur(10px)}.dtf-learn-v4 .hero-badge strong{display:block;font-size:1rem}.dtf-learn-v4 .hero-badge span{display:block;margin-top:4px;color:#c9d8ce;font-size:.86rem;line-height:1.45}.dtf-learn-v4 .section{padding:72px 0}.dtf-learn-v4 .soft{background:var(--l4-soft)}.dtf-learn-v4 .dark{background:var(--l4-forest);color:#fff}.dtf-learn-v4 .section-heading{display:grid;grid-template-columns:minmax(0,.95fr) minmax(300px,.65fr);gap:36px;align-items:end;margin-bottom:30px}.dtf-learn-v4 .section-heading h2{margin:0;font-size:clamp(2.15rem,4.4vw,3.8rem);line-height:1;letter-spacing:-.045em}.dtf-learn-v4 .section-heading p{margin:0;color:var(--l4-muted);line-height:1.7}.dtf-learn-v4 .dark .section-heading p{color:#bdd0c3}.dtf-learn-v4 .route-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}.dtf-learn-v4 .route-card{position:relative;display:flex;min-height:250px;flex-direction:column;padding:23px;border:1px solid var(--l4-line);border-radius:23px;background:var(--l4-paper);box-shadow:0 14px 34px rgba(17,50,29,.06);text-decoration:none!important;color:var(--l4-ink)!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.dtf-learn-v4 .route-card:hover{transform:translateY(-3px);border-color:#9fbaa5;box-shadow:0 18px 38px rgba(17,50,29,.11)}.dtf-learn-v4 .route-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.dtf-learn-v4 .route-number{display:grid;width:42px;height:42px;place-items:center;border-radius:50%;background:var(--l4-forest);color:var(--l4-gold);font-weight:950}.dtf-learn-v4 .pill{display:inline-flex;padding:6px 9px;border-radius:999px;background:#e7eee6;color:#396447;font-size:.68rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.dtf-learn-v4 .route-card h3{margin:27px 0 9px;font-size:1.45rem;letter-spacing:-.025em}.dtf-learn-v4 .route-card p{margin:0;color:var(--l4-muted);line-height:1.62}.dtf-learn-v4 .route-arrow{margin-top:auto;padding-top:18px;font-weight:950;color:var(--l4-green)}.dtf-learn-v4 .feature-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:center}.dtf-learn-v4 .feature-media{position:relative;min-height:470px}.dtf-learn-v4 .feature-media img,.dtf-learn-v4 .feature-media .v4-media-placeholder{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:25px;background:linear-gradient(145deg,#183a26,#416b4e)}.dtf-learn-v4 .feature-copy h2{margin:0;font-size:clamp(2.3rem,4.7vw,4rem);line-height:.98;letter-spacing:-.05em}.dtf-learn-v4 .feature-copy>p{max-width:650px;color:#c5d5ca;line-height:1.75}.dtf-learn-v4 .feature-list{display:grid;gap:10px;margin-top:22px}.dtf-learn-v4 .feature-list a{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 15px;border:1px solid #355642;border-radius:15px;background:#12331f;color:#fff!important;text-decoration:none!important;font-weight:850}.dtf-learn-v4 .feature-list a span{color:var(--l4-gold)}.dtf-learn-v4 .subject-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.dtf-learn-v4 .subject-card{min-height:205px;padding:20px;border:1px solid var(--l4-line);border-radius:20px;background:#fff}.dtf-learn-v4 .subject-card h3{margin:0 0 9px;font-size:1.16rem}.dtf-learn-v4 .subject-card p{margin:0;color:var(--l4-muted);line-height:1.6}.dtf-learn-v4 .text-link{display:inline-flex;margin-top:15px;color:var(--l4-green)!important;text-decoration:none!important;font-weight:900}.dtf-learn-v4 .tool-band{display:grid;grid-template-columns:minmax(0,1.05fr) repeat(2,minmax(0,.65fr));gap:17px}.dtf-learn-v4 .tool-intro,.dtf-learn-v4 .tool-card{border:1px solid #365643;border-radius:22px;background:#12331f;padding:24px}.dtf-learn-v4 .tool-intro h2{margin:0;font-size:clamp(2rem,4vw,3.25rem);letter-spacing:-.04em}.dtf-learn-v4 .tool-intro p,.dtf-learn-v4 .tool-card p{color:#c1d1c6;line-height:1.65}.dtf-learn-v4 .tool-card h3{margin:0;font-size:1.35rem}.dtf-learn-v4 .tool-card a{color:#efd579!important;font-weight:900}.dtf-learn-v4 .final-cta{padding:64px 0;background:linear-gradient(135deg,#dfe8dd,#f7f3e7)}.dtf-learn-v4 .final-box{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:center;padding:31px;border:1px solid #cbd9cc;border-radius:25px;background:rgba(255,255,255,.72)}.dtf-learn-v4 .final-box h2{margin:0;font-size:clamp(2rem,4vw,3.2rem);letter-spacing:-.04em}.dtf-learn-v4 .final-box p{max-width:720px;margin:10px 0 0;color:var(--l4-muted);line-height:1.65}.dtf-learn-v4 .final-box .btn.secondary{background:#fff;border-color:#afc3b3;color:var(--l4-ink)!important}
@media(max-width:980px){.dtf-learn-v4 .hero-grid,.dtf-learn-v4 .feature-split,.dtf-learn-v4 .section-heading,.dtf-learn-v4 .final-box{grid-template-columns:1fr}.dtf-learn-v4 .hero-media{min-height:420px}.dtf-learn-v4 .route-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-learn-v4 .subject-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-learn-v4 .tool-band{grid-template-columns:1fr 1fr}.dtf-learn-v4 .tool-intro{grid-column:1/-1}}
@media(max-width:640px){.dtf-learn-v4 .wrap{width:min(100% - 24px,1220px)}.dtf-learn-v4 .hero{padding:54px 0 46px}.dtf-learn-v4 h1{font-size:clamp(2.65rem,14vw,4.2rem)}.dtf-learn-v4 .hero-media{min-height:320px}.dtf-learn-v4 .section{padding:52px 0}.dtf-learn-v4 .route-grid,.dtf-learn-v4 .subject-grid,.dtf-learn-v4 .tool-band{grid-template-columns:1fr}.dtf-learn-v4 .route-card{min-height:220px}.dtf-learn-v4 .feature-media{min-height:330px}.dtf-learn-v4 .actions .btn{width:100%}.dtf-learn-v4 .final-box{padding:23px}}
@media(prefers-reduced-motion:reduce){.dtf-learn-v4 .route-card{transition:none}}
</style>`;

function buildPage(media) {
  const used = new Set();
  const hero = selectMedia(media, [
    ['plant', 'science'],
    ['plant', 'biology'],
    ['seed', 'anatomy'],
    ['cannabis', 'plant']
  ], used);
  const visual = selectMedia(media, [
    ['vpd'],
    ['infographic', 'lighting'],
    ['root', 'zone'],
    ['plant', 'anatomy']
  ], used);

  const routeCards = routes.map(route => `<a class="route-card" href="${esc(route.href)}"><div class="route-top"><span class="route-number">${esc(route.icon)}</span><span class="pill">${esc(route.tone)}</span></div><h3>${esc(route.title)}</h3><p>${esc(route.copy)}</p><span class="route-arrow">Open section →</span></a>`).join('');
  const subjectCards = subjects.map(subject => `<article class="subject-card"><h3>${esc(subject.title)}</h3><p>${esc(subject.copy)}</p><a class="text-link" href="${esc(subject.href)}">Explore subject →</a></article>`).join('');

  return `${css}<main class="dtf-learn-v4" data-dtf-layout="learn-v4">
<section class="hero"><div class="wrap hero-grid"><div><p class="kicker">Teaching Healthy Cultivation</p><h1>Learn the plant. Then learn the grow.</h1><p class="lede">A visual, evidence-minded cultivation library built around plant biology, environment, measurement, observation, and practical decision-making. Start with the foundation path or jump directly to the subject you need.</p><div class="actions"><a class="btn primary" href="/learn/start-here/">Start the foundation path</a><a class="btn secondary" href="/learn/infographics/">Browse visual library</a><a class="btn secondary" href="/atlas/">Open Plant Atlas</a></div></div><div class="hero-media">${image(hero, 'Teaching Healthy Cultivation plant science visual')}<div class="hero-badge"><strong>Built for understanding, not memorizing.</strong><span>Connect what the plant is doing to what you measure, observe, and change.</span></div></div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Choose your route</p><h2>One learning system. Multiple ways in.</h2></div><p>Use the ordered foundation path when you are learning from the beginning. Use the atlas, encyclopedia, visuals, glossary, and records as reference tools when you already know what question you need answered.</p></div><div class="route-grid">${routeCards}</div></div></section>
<section class="section dark"><div class="wrap feature-split"><div class="feature-media">${image(visual, 'Detailed cultivation science infographic')}</div><div class="feature-copy"><p class="eyebrow">Visual learning</p><h2>Use the picture when the concept is easier to see than describe.</h2><p>The visual library is designed to sit beside the long-form lessons, not replace them. Start with a full-sheet visual, then open the connected subject when you need the mechanism, context, or limitations behind it.</p><div class="feature-list"><a href="/learn/infographics/"><strong>Infographic Library</strong><span>Browse →</span></a><a href="/atlas/"><strong>Living Plant Atlas</strong><span>Explore →</span></a><a href="/learn/encyclopedia/"><strong>Plant Science Encyclopedia</strong><span>Research →</span></a></div></div></div></section>
<section class="section soft"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Subject library</p><h2>Go straight to the system you are working on.</h2></div><p>These subject hubs connect the core science to practical cultivation observations. Use them to answer a focused question without losing the larger biological context.</p></div><div class="subject-grid">${subjectCards}</div></div></section>
<section class="section dark"><div class="wrap"><div class="tool-band"><div class="tool-intro"><p class="eyebrow">Learn → measure → diagnose</p><h2>Education should connect to what happens in the grow.</h2><p>Use DTF tools to document observations, measure the environment, and carry better context into plant-health reasoning.</p></div><article class="tool-card"><h3>THC GrowLens</h3><p>Capture and organize plant observations so changes are easier to compare over time.</p><a href="/growlens/">Open GrowLens →</a></article><article class="tool-card"><h3>THC Grow Doc</h3><p>Work through plant-health symptoms with measurements and context instead of guessing from one photo.</p><a href="/thc-grow-doc/">Diagnose a plant →</a></article></div></div></section>
<section class="final-cta"><div class="wrap"><div class="final-box"><div><p class="eyebrow">Best first step</p><h2>New here? Start with the foundation path.</h2><p>The ordered modules establish the vocabulary and plant-science concepts used throughout the rest of Teaching Healthy Cultivation.</p></div><div class="actions"><a class="btn primary" href="/learn/start-here/">Start Here</a><a class="btn secondary" href="/tools/">View Tools</a></div></div></div></section>
</main>`;
}

const page = await getPage('learn');
if (!page?.id) throw new Error('Could not find the WordPress Learn page');
const media = await fetchMedia();
const content = buildPage(media);

await writeFile(join(backupDir, 'learn-before.json'), `${JSON.stringify(page, null, 2)}\n`);
await writeFile(join(backupDir, 'learn-v4-preview.html'), `${content}\n`);

if (apply) {
  await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Learn', content, status: 'publish' })
  });
}

console.log(JSON.stringify({
  ok: true,
  apply,
  pageId: page.id,
  mediaAvailable: media.length,
  marker: 'data-dtf-layout="learn-v4"',
  backupDir
}, null, 2));
