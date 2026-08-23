import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_LEARNING_V3 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-v3';
const topicPath = process.env.TOPIC_LITERATURE_PATH || join(process.cwd(), 'site/wordpress/education/topic-literature.json');
if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-V3/1.0' };
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `learning-v3-${stamp}`);
await mkdir(backupDir, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const rendered = value => typeof value === 'string' ? value : (value?.rendered || value?.raw || '');
const plain = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status >= 500 || response.status === 429) && attempt < 5) {
        await sleep(1400 * attempt);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
      return { body, response };
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(1400 * attempt);
    }
  }
  throw lastError;
}

async function fetchAllMedia() {
  const rows = [];
  for (let page = 1; page <= 8; page += 1) {
    try {
      const { body } = await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
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

async function getPage(slug) {
  const { body } = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  return Array.isArray(body) ? body[0] || null : null;
}

async function ensurePage(slug, title, parent = 0) {
  const existing = await getPage(slug);
  if (existing) return existing;
  if (!apply) return { id: null, slug, title: { rendered: title }, content: { rendered: '' }, parent };
  const { body } = await request('/wp-json/wp/v2/pages', {
    method: 'POST',
    body: JSON.stringify({ slug, title, parent, status: 'publish', content: '' })
  });
  if (!body?.id) throw new Error(`Could not create page ${slug}`);
  return body;
}

async function updatePage(page, content, title) {
  if (!page?.id) return;
  await writeFile(join(backupDir, `page-${page.id}-${page.slug}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
  if (!apply) return;
  await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    body: JSON.stringify({ content, title, status: 'publish' })
  });
}

function mediaText(item) {
  return [item?.slug, rendered(item?.title), item?.alt_text, rendered(item?.caption), rendered(item?.description), item?.source_url].join(' ').toLowerCase();
}

function chooseMedia(media, groups, used = new Set()) {
  for (const group of groups) {
    const terms = Array.isArray(group) ? group : [group];
    const match = media.find(item => item?.source_url && !used.has(item.id) && terms.every(term => mediaText(item).includes(String(term).toLowerCase())));
    if (match) {
      used.add(match.id);
      return match;
    }
  }
  return null;
}

function imageUrl(item) { return item?.source_url || item?.guid?.rendered || ''; }
function imageAlt(item, fallback) { return plain(item?.alt_text || rendered(item?.title) || fallback); }
function img(item, alt, { ratio = '4/3', eager = false } = {}) {
  if (!item) return '<div class="v3-image-placeholder" aria-hidden="true"></div>';
  return `<img src="${esc(imageUrl(item))}" alt="${esc(imageAlt(item, alt))}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="aspect-ratio:${esc(ratio)}">`;
}
function btn(href, label, primary = true) { return `<a class="v3-btn ${primary ? 'primary' : 'secondary'}" href="${esc(href)}">${esc(label)}</a>`; }
function textLink(href, label) { return `<a class="v3-text-link" href="${esc(href)}">${esc(label)} <span aria-hidden="true">→</span></a>`; }

const css = `<style id="dtf-learning-v3-style">
:root{--v3-ink:#102b1a;--v3-deep:#081b11;--v3-green:#1d7040;--v3-green2:#0d2a19;--v3-gold:#d6b75c;--v3-cream:#f7f4ea;--v3-soft:#edf2e9;--v3-line:#d6e1d8;--v3-muted:#526557;--v3-white:#fff}
.v3{background:var(--v3-cream);color:#173420;overflow:hidden}.v3 *{box-sizing:border-box}.v3 .wrap{width:min(1200px,calc(100% - 36px));margin:auto}.v3 .hero{padding:72px 0 62px;background:radial-gradient(circle at 82% 8%,rgba(214,183,92,.22),transparent 31%),linear-gradient(145deg,var(--v3-deep),var(--v3-green2));color:#fff}.v3 .hero-grid{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(330px,.94fr);gap:52px;align-items:center}.v3 .kicker,.v3 .eyebrow{margin:0 0 10px;color:var(--v3-gold);font-size:.76rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.v3 h1{margin:0;font-size:clamp(2.8rem,6.3vw,5.6rem);line-height:.94;letter-spacing:-.055em}.v3 .lede{max-width:760px;margin:22px 0 0;color:#d4e1d8;font-size:1.1rem;line-height:1.75}.v3 .actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:26px}.v3-btn{display:inline-flex;align-items:center;justify-content:center;min-height:45px;padding:10px 17px;border-radius:999px;text-decoration:none!important;font-weight:900;border:1px solid transparent}.v3-btn.primary{background:var(--v3-gold);color:var(--v3-deep)!important;border-color:var(--v3-gold)}.v3-btn.secondary{background:rgba(255,255,255,.06);color:#fff!important;border-color:rgba(255,255,255,.27)}.v3 .light-actions .v3-btn.secondary,.v3 section:not(.hero):not(.dark) .v3-btn.secondary{background:#fff;color:var(--v3-ink)!important;border-color:#bdd0c1}.v3 .hero-media{position:relative}.v3 .hero-media:before{content:"";position:absolute;inset:-15px 20px 20px -15px;border:1px solid rgba(214,183,92,.5);border-radius:30px}.v3 .hero-media img,.v3 .feature img,.v3 .visual img,.v3 .topic-hero img{position:relative;z-index:1;display:block;width:100%;height:100%;object-fit:cover;border-radius:24px;background:#e7eee8}.v3 .section{padding:68px 0}.v3 .soft{background:var(--v3-soft)}.v3 .dark{background:var(--v3-green2);color:#fff}.v3 .heading{display:flex;justify-content:space-between;align-items:end;gap:28px;margin-bottom:27px}.v3 .heading>div{max-width:760px}.v3 .heading h2{margin:0;font-size:clamp(2.05rem,4vw,3.45rem);line-height:1.02;letter-spacing:-.04em}.v3 .heading>p{max-width:510px;margin:0;color:var(--v3-muted);line-height:1.65}.v3 .dark .heading>p{color:#bfd0c4}.v3 .primary-grid{display:grid;grid-template-columns:1.18fr .82fr;gap:20px}.v3 .feature{position:relative;overflow:hidden;min-height:430px;border-radius:25px;background:#173420;border:1px solid var(--v3-line)}.v3 .feature img{position:absolute;inset:0;border-radius:0;opacity:.72}.v3 .feature:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,22,12,.05),rgba(5,22,12,.9))}.v3 .feature-copy{position:absolute;z-index:2;left:0;right:0;bottom:0;padding:28px;color:#fff}.v3 .feature-copy h3{margin:9px 0 8px;font-size:clamp(1.65rem,3vw,2.45rem);line-height:1}.v3 .feature-copy p{max-width:620px;margin:0;color:#d4e1d8;line-height:1.62}.v3 .feature-copy .v3-text-link{color:#f1d67b!important}.v3 .stack{display:grid;gap:18px}.v3 .compact,.v3 .path,.v3 .subject-mini,.v3 .ref-card,.v3 .lesson{background:#fff;border:1px solid var(--v3-line);border-radius:21px;padding:22px;box-shadow:0 12px 30px rgba(18,49,29,.06)}.v3 .compact h3,.v3 .path h3,.v3 .subject-mini h3,.v3 .ref-card h3,.v3 .lesson h2{margin:0 0 8px}.v3 .compact p,.v3 .path p,.v3 .subject-mini p,.v3 .ref-card p,.v3 .lesson p{margin:0;color:var(--v3-muted);line-height:1.65}.v3 .dark .compact,.v3 .dark .ref-card{background:#12351f;border-color:#31543d;box-shadow:none}.v3 .dark .compact p,.v3 .dark .ref-card p{color:#bed0c3}.v3-text-link{display:inline-flex;margin-top:14px;color:var(--v3-green)!important;text-decoration:none!important;font-weight:900}.v3 .dark .v3-text-link{color:#e9cd73!important}.v3 .release-grid,.v3 .path-grid,.v3 .all-subjects,.v3 .ref-grid,.v3 .visual-grid{display:grid;gap:17px}.v3 .release-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v3 .path-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.v3 .all-subjects{grid-template-columns:repeat(3,minmax(0,1fr))}.v3 .ref-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.v3 .visual-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v3 .release{overflow:hidden;background:#fff;border:1px solid var(--v3-line);border-radius:22px;box-shadow:0 12px 30px rgba(18,49,29,.06)}.v3 .release img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}.v3 .release-copy{padding:20px}.v3 .release-copy h3{margin:6px 0 7px;font-size:1.28rem}.v3 .release-copy p{margin:0;color:var(--v3-muted);line-height:1.6}.v3 .pill{display:inline-flex;padding:5px 9px;border-radius:999px;background:#e8efe8;color:#29623c;font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.v3 .dark .pill{background:#1f4930;color:#f0d477}.v3 .split{display:grid;grid-template-columns:minmax(0,.88fr) minmax(0,1.12fr);gap:34px;align-items:center}.v3 .split h2{margin:0 0 14px;font-size:clamp(2rem,4vw,3.35rem);letter-spacing:-.04em}.v3 .split p{color:#c3d3c8;line-height:1.72}.v3 .split img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:24px}.v3 .route-strip{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.v3 .route-strip a{padding:8px 12px;border-radius:999px;background:#fff;border:1px solid var(--v3-line);color:var(--v3-ink)!important;text-decoration:none!important;font-weight:850}.v3 .topic-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:40px;align-items:center}.v3 .topic-hero h1{font-size:clamp(2.7rem,6vw,5rem)}.v3 .topic-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.v3 .topic-meta span{padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.06);color:#d6e3da;font-size:.82rem;font-weight:800}.v3 .lesson-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}.v3 .lesson h2{font-size:1.4rem;line-height:1.15}.v3 .lesson p+p{margin-top:12px}.v3 .checks{margin:17px 0 0;padding:0;list-style:none;display:grid;gap:8px}.v3 .checks li{position:relative;padding:10px 12px 10px 38px;border-radius:13px;background:#f1f5ef;color:#3f5647;line-height:1.5}.v3 .checks li:before{content:'✓';position:absolute;left:13px;top:10px;color:var(--v3-green);font-weight:950}.v3 .visual{overflow:hidden;border:1px solid var(--v3-line);border-radius:20px;background:#fff}.v3 .visual a{display:block;aspect-ratio:4/3;overflow:hidden}.v3 .visual img{border-radius:0}.v3 .visual figcaption{padding:13px 15px;color:var(--v3-muted);line-height:1.5}.v3 .breadcrumb{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;color:#b8cabd;font-size:.88rem}.v3 .breadcrumb a{color:#e9cd73!important;text-decoration:none}.v3-image-placeholder{width:100%;aspect-ratio:4/3;border-radius:24px;background:linear-gradient(135deg,#dbe7dc,#edf2e9)}
@media(max-width:980px){.v3 .hero-grid,.v3 .topic-hero,.v3 .primary-grid,.v3 .split{grid-template-columns:1fr}.v3 .path-grid,.v3 .ref-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v3 .release-grid,.v3 .all-subjects,.v3 .visual-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v3 .lesson-grid{grid-template-columns:1fr}.v3 .heading{align-items:flex-start;flex-direction:column}.v3 .feature{min-height:360px}}
@media(max-width:620px){.v3 .wrap{width:min(100% - 28px,1200px)}.v3 .hero{padding:52px 0 45px}.v3 h1{font-size:clamp(2.5rem,14vw,4rem)}.v3 .section{padding:52px 0}.v3 .path-grid,.v3 .ref-grid,.v3 .release-grid,.v3 .all-subjects,.v3 .visual-grid{grid-template-columns:1fr}.v3 .actions .v3-btn{width:100%}.v3 .hero-media:before{display:none}.v3 .feature{min-height:330px}}
</style>`;

const literature = JSON.parse(await readFile(topicPath, 'utf8'));
if (!Array.isArray(literature?.topics) || !literature.topics.length) throw new Error('topic-literature.json contains no topics');
const topics = literature.topics;
const topicById = Object.fromEntries(topics.map(topic => [topic.id, topic]));
const media = await fetchAllMedia();
const used = new Set();

const imageGroups = {
  'plant-biology': [['plant', 'anatomy'], ['root', 'anatomy'], ['leaf', 'anatomy']],
  'lifecycle-propagation': [['life', 'cycle'], ['cloning', 'guide'], ['germination']],
  'environment-vpd': [['vpd'], ['temperature', 'humidity'], ['environment']],
  'lighting': [['ppfd'], ['dli'], ['lighting']],
  'water-root-zone': [['root', 'zone'], ['root', 'anatomy'], ['water']],
  'nutrition-media': [['nutrition', 'science'], ['nutrient', 'uptake'], ['deficiency', 'toxicity']],
  'training-canopy': [['training'], ['canopy'], ['stem', 'training']],
  'plant-health-ipm': [['beneficial', 'insects'], ['spider', 'mite'], ['ipm']],
  'harvest-postharvest': [['harvest'], ['drying'], ['curing'], ['trichome']],
  'genetics-breeding': [['sex', 'expression'], ['genetics'], ['breeding']],
  'outdoor-cultivation': [['outdoor'], ['life', 'cycle'], ['plant', 'anatomy']],
  'evidence-measurement': [['evidence'], ['observation'], ['measurement']]
};

function topicImage(topic, reserve = true) {
  const groups = imageGroups[topic.id] || [topic.keywords?.slice(0, 2) || [], [topic.id.replaceAll('-', ' ')]];
  return chooseMedia(media, groups, reserve ? used : new Set());
}

const topicImages = Object.fromEntries(topics.map(topic => [topic.id, topicImage(topic)]));
const fallbackHero = chooseMedia(media, [['plant', 'anatomy'], ['whole', 'plant'], ['flower', 'anatomy']], used) || Object.values(topicImages).find(Boolean) || null;
const releaseImages = {
  mangoRegular: chooseMedia(media, [['flower', 'anatomy'], ['trichome']], used) || fallbackHero,
  mangoFem: chooseMedia(media, [['trichome'], ['flower']], used) || fallbackHero,
  bubblegum: chooseMedia(media, [['sex', 'expression'], ['genetics']], used) || fallbackHero
};

const route = id => topicById[id]?.route || '/learn/';
const title = id => topicById[id]?.title || id;
const summary = id => topicById[id]?.summary || '';

function releaseCard({ tag, name, lineage, href, image }) {
  return `<article class="release">${img(image, `${name} genetics reference`, { ratio: '16/10' })}<div class="release-copy"><span class="pill">${esc(tag)}</span><h3>${esc(name)}</h3><p><strong>${esc(lineage)}</strong></p>${textLink(href, 'Open release')}</div></article>`;
}

function subjectMini(topic) {
  return `<article class="subject-mini"><span class="pill">THC subject</span><h3>${esc(topic.title)}</h3><p>${esc(topic.summary)}</p>${textLink(topic.route, 'Open subject')}</article>`;
}

function buildHome() {
  const biology = topicById['plant-biology'];
  const environment = topicById['environment-vpd'];
  const nutrition = topicById['nutrition-media'];
  const ipm = topicById['plant-health-ipm'];
  return `${css}<div class="v3" data-dtf-layout="home-v3">
  <section class="hero"><div class="wrap hero-grid"><div><p class="kicker">DTF Genetics · Dream the Future</p><h1>Genetics first. Learn the plant behind the pack.</h1><p class="lede">DTFSeeds brings documented genetics, Teaching Healthy Cultivation, grow-management tools, plant-health reasoning, games, and community into one clear path. Start with what you came here to do.</p><div class="actions">${btn('/seeds/', 'Explore genetics', true)}${btn('/learn/start-here/', 'Start learning', false)}${btn('/shop/', 'Shop releases', false)}</div></div><div class="hero-media">${img(fallbackHero, 'DTF Genetics and Teaching Healthy Cultivation plant science', { ratio: '1/1', eager: true })}</div></div></section>

  <section class="section"><div class="wrap"><div class="heading"><div><p class="eyebrow">Start with the core</p><h2>Three jobs define the site.</h2></div><p>Genetics is the product identity. Teaching Healthy Cultivation explains the plant. The tools turn observations into records and decisions. Everything else supports those three jobs.</p></div><div class="primary-grid"><article class="feature">${img(topicImages['genetics-breeding'] || fallbackHero, 'Cannabis genetics and breeding reference', { ratio: '16/10' })}<div class="feature-copy"><span class="pill">DTF Genetics</span><h3>Know the breeding project before you buy the pack.</h3><p>Read lineage, generation context, breeding direction, and current release routes without turning observations into guarantees.</p>${textLink('/seeds/', 'Explore genetics')}</div></article><div class="stack"><article class="compact"><span class="pill">Teaching Healthy Cultivation</span><h3>Learn by subject, not by scattered tips.</h3><p>Plant biology, environment, light, roots, nutrition, IPM, harvest, outdoor cultivation, genetics, and measurement live in a connected learning system.</p>${textLink('/learn/', 'Open learning system')}</article><article class="compact"><span class="pill">Cultivation tools</span><h3>Track the grow. Diagnose with evidence.</h3><p>GrowLens handles records and measurements. Grow Doc structures plant-health evidence and missing-information checks.</p>${textLink('/tools/', 'Open tools')}</article></div></div></div></section>

  <section class="section soft"><div class="wrap"><div class="heading"><div><p class="eyebrow">Current releases</p><h2>Current genetics stay simple and direct.</h2></div><p>Three reviewed listings are public. Product pages control current price and availability while the genetics catalog carries the breeding context.</p></div><div class="release-grid">${releaseCard({ tag: 'F2 · Regular', name: 'Blue Mango', lineage: 'Somango XXL × Blueberry Butcher', href: '/product/10-regular-f2-blue-mango-seeds/', image: releaseImages.mangoRegular })}${releaseCard({ tag: 'F2 · Feminized', name: 'Blue Mango', lineage: 'Somango XXL × Blueberry Butcher', href: '/product/10-feminized-f2-blue-mango-x/', image: releaseImages.mangoFem })}${releaseCard({ tag: 'F1 · Regular', name: 'Blue Bubblegum', lineage: 'Bubblegum Kush × Blueberry Butcher', href: '/product/10-reg-f1-blueberry-bubblegum/', image: releaseImages.bubblegum })}</div><div class="actions light-actions">${btn('/seeds/', 'Read genetics context', true)}${btn('/shop/', 'Open shop', false)}</div></div></section>

  <section class="section dark"><div class="wrap"><div class="heading"><div><p class="eyebrow">Teaching Healthy Cultivation</p><h2>Learn the systems that control the plant.</h2></div><p>The homepage highlights the foundations first. Specialized subjects stay one click away without competing for the same visual weight.</p></div><div class="primary-grid"><article class="feature">${img(topicImages[biology.id] || fallbackHero, biology.title, { ratio: '16/10' })}<div class="feature-copy"><span class="pill">Foundation 01</span><h3>${esc(biology.title)}</h3><p>${esc(biology.summary)}</p>${textLink(biology.route, 'Open plant biology')}</div></article><div class="stack"><article class="compact"><span class="pill">Foundation 02</span><h3>${esc(environment.title)}</h3><p>${esc(environment.summary)}</p>${textLink(environment.route, 'Open environment')}</article><article class="compact"><span class="pill">Foundation 03</span><h3>${esc(nutrition.title)}</h3><p>${esc(nutrition.summary)}</p>${textLink(nutrition.route, 'Open nutrition & media')}</article></div></div><div class="route-strip"><a href="${esc(route('lighting'))}">Lighting</a><a href="${esc(route('water-root-zone'))}">Water & Root Zone</a><a href="${esc(ipm.route)}">Plant Health & IPM</a><a href="${esc(route('harvest-postharvest'))}">Harvest & Post-Harvest</a><a href="${esc(route('genetics-breeding'))}">Genetics & Breeding</a><a href="${esc(route('outdoor-cultivation'))}">Outdoor</a><a href="/learn/">All subjects</a></div></div></section>

  <section class="section"><div class="wrap"><div class="heading"><div><p class="eyebrow">Use the knowledge</p><h2>Observe → measure → compare → track.</h2></div><p>A useful education system should lead into action. The tools and diagnostic guides follow the same evidence-first workflow as the literature.</p></div><div class="path-grid"><article class="path"><h3>Observe</h3><p>Record symptom location, pattern, plant stage, recent changes, and progression.</p></article><article class="path"><h3>Measure</h3><p>Add environment, irrigation, root-zone conditions, pH/EC where relevant, and pest evidence.</p></article><article class="path"><h3>Compare</h3><p>Use Grow Doc and subject literature to compare plausible causes rather than naming one from color alone.</p></article><article class="path"><h3>Track</h3><p>Document the correction and watch new growth so the interpretation can be tested.</p></article></div><div class="actions light-actions">${btn('/thc-grow-doc/', 'Open Grow Doc', true)}${btn('/growlens/', 'Open GrowLens', false)}${btn('/yellow-leaves/', 'Yellow-leaves guide', false)}</div></div></section>

  <section class="section soft"><div class="wrap"><div class="heading"><div><p class="eyebrow">Community & play</p><h2>Secondary experiences stay easy to find.</h2></div><p>Games and community belong after visitors can clearly find genetics, education, and tools.</p></div><div class="all-subjects"><article class="subject-mini"><h3>DTF Game Hub</h3><p>Playable browser games, strategy, trivia, puzzles, multiplayer work, and projects organized by release status.</p>${textLink('/games/', 'Open games')}</article><article class="subject-mini"><h3>DTF Community</h3><p>Grow discussion, education, grow-offs, project feedback, testing, and creative participation.</p>${textLink('/community/', 'Open community')}</article><article class="subject-mini"><h3>Visual Gallery</h3><p>Browse approved plant science, genetics, tools, game development, and community visual work.</p>${textLink('/gallery/', 'Open gallery')}</article></div></div></section>
  </div>`;
}

function buildLearn() {
  const featured = ['plant-biology', 'environment-vpd', 'water-root-zone'].map(id => topicById[id]).filter(Boolean);
  const remaining = topics.filter(topic => !featured.some(item => item.id === topic.id));
  return `${css}<div class="v3" data-dtf-layout="learn-v3">
  <section class="hero"><div class="wrap hero-grid"><div><p class="kicker">Teaching Healthy Cultivation</p><h1>Learn in a sequence that makes the plant easier to understand.</h1><p class="lede">Start with a goal, learn the foundations, move into specialized subjects, then choose the depth you need: pathway, subject literature, visual reference, Academy, or Encyclopedia.</p><div class="actions">${btn('/learn/start-here/', 'Start here', true)}${btn('/learn/search/', 'Search education', false)}${btn('/learn/infographics/', 'Browse visuals', false)}</div></div><div class="hero-media">${img(topicImages['plant-biology'] || fallbackHero, 'Cannabis plant biology educational reference', { ratio: '1/1', eager: true })}</div></div></section>

  <section class="section"><div class="wrap"><div class="heading"><div><p class="eyebrow">Choose your goal</p><h2>Start with the question you are trying to answer.</h2></div><p>This removes the need to understand the full library structure before you can use it.</p></div><div class="path-grid"><article class="path"><span class="pill">Beginner</span><h3>I am learning to grow</h3><p>Build plant biology, environment, lighting, root-zone, stage, sanitation, and observation fundamentals in order.</p>${textLink('/learn/start-here/', 'Start beginner path')}</article><article class="path"><span class="pill">Plant health</span><h3>I am trying to diagnose a problem</h3><p>Start with evidence intake, then follow the clues into roots, environment, nutrition, pests, disease, or crop stage.</p>${textLink('/thc-grow-doc/', 'Start diagnosis')}</article><article class="path"><span class="pill">Control</span><h3>I want better environment & lighting</h3><p>Connect temperature, RH, leaf temperature, VPD, airflow, PPFD, DLI, photoperiod, and measurement.</p>${textLink(route('environment-vpd'), 'Open environment')}</article><article class="path"><span class="pill">Breeding</span><h3>I am documenting genetics or selections</h3><p>Study identity, phenotype, inheritance, filial generations, selection, uncertainty, and repeatable records.</p>${textLink(route('genetics-breeding'), 'Open genetics')}</article></div></div></section>

  <section class="section dark"><div class="wrap"><div class="heading"><div><p class="eyebrow">Foundations first</p><h2>Three systems explain most downstream decisions.</h2></div><p>These subjects receive the strongest visual weight because they support nearly every later cultivation question.</p></div><div class="primary-grid"><article class="feature">${img(topicImages[featured[0].id] || fallbackHero, featured[0].title, { ratio: '16/10' })}<div class="feature-copy"><span class="pill">Foundation 01</span><h3>${esc(featured[0].title)}</h3><p>${esc(featured[0].summary)}</p>${textLink(featured[0].route, 'Open subject')}</div></article><div class="stack"><article class="compact"><span class="pill">Foundation 02</span><h3>${esc(featured[1].title)}</h3><p>${esc(featured[1].summary)}</p>${textLink(featured[1].route, 'Open subject')}</article><article class="compact"><span class="pill">Foundation 03</span><h3>${esc(featured[2].title)}</h3><p>${esc(featured[2].summary)}</p>${textLink(featured[2].route, 'Open subject')}</article></div></div></div></section>

  <section class="section"><div class="wrap"><div class="heading"><div><p class="eyebrow">Specialized subjects</p><h2>Go deeper when the question requires it.</h2></div><p>These subjects remain easy to scan without repeating the same large image-card treatment twelve times.</p></div><div class="all-subjects">${remaining.map(subjectMini).join('')}</div></div></section>

  <section class="section soft"><div class="wrap"><div class="heading"><div><p class="eyebrow">Choose the depth</p><h2>One topic can have several useful formats.</h2></div><p>Use the shortest format that answers the question, then go deeper only when needed.</p></div><div class="ref-grid"><article class="ref-card"><span class="pill">Pathway</span><h3>Start Here</h3><p>Beginner-friendly order of operations and foundational decisions.</p>${textLink('/learn/start-here/', 'Open Start Here')}</article><article class="ref-card"><span class="pill">Course</span><h3>THC Academy</h3><p>Structured learning sequences and course-based progression.</p>${textLink('/learn/academy/', 'Open Academy')}</article><article class="ref-card"><span class="pill">Reference</span><h3>Plant Science Encyclopedia</h3><p>Deeper, reference-level entries for concepts that need more detail.</p>${textLink('/learn/encyclopedia/', 'Open Encyclopedia')}</article><article class="ref-card"><span class="pill">Visual</span><h3>Infographic Library</h3><p>Finished visual references embedded by subject and searchable in one library.</p>${textLink('/learn/infographics/', 'Open visuals')}</article></div></div></section>

  <section class="section dark"><div class="wrap"><div class="split"><div>${img(topicImages['plant-health-ipm'] || topicImages['nutrition-media'] || fallbackHero, 'Cannabis plant health diagnostic reference', { ratio: '4/3' })}</div><div><p class="eyebrow">Plant-health reasoning</p><h2>A symptom is evidence, not a diagnosis.</h2><p>Use symptom location and pattern, plant stage, environment, irrigation, roots, pH/EC when appropriate, recent changes, pest evidence, and progression together. Keep more than one possible cause until the evidence separates them.</p><div class="actions">${btn('/thc-grow-doc/', 'Use Grow Doc', true)}${btn('/yellow-leaves/', 'Yellow-leaves guide', false)}${btn(route('plant-health-ipm'), 'Plant Health & IPM', false)}</div></div></div></div></section>
  </div>`;
}

function findRelatedMedia(topic, count = 3) {
  const terms = [topic.title, ...(topic.keywords || [])].map(v => String(v).toLowerCase());
  const scored = media.filter(item => item?.source_url).map(item => {
    const hay = mediaText(item);
    const score = terms.reduce((sum, term) => sum + (term && hay.includes(term) ? Math.min(4, term.split(/\s+/).length + 1) : 0), 0);
    return { item, score };
  }).filter(row => row.score > 0).sort((a, b) => b.score - a.score);
  const unique = [];
  const seen = new Set();
  for (const row of scored) {
    if (seen.has(row.item.id)) continue;
    seen.add(row.item.id);
    unique.push(row.item);
    if (unique.length >= count) break;
  }
  if (!unique.length && topicImages[topic.id]) unique.push(topicImages[topic.id]);
  return unique;
}

function buildTopic(topic) {
  const visual = topicImages[topic.id] || fallbackHero;
  const related = findRelatedMedia(topic, 3);
  const keywords = (topic.keywords || []).slice(0, 5);
  const lessonCards = (topic.sections || []).map((section, index) => `<article class="lesson"><span class="pill">${String(index + 1).padStart(2, '0')}</span><h2>${esc(section.heading)}</h2>${(section.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('')}${section.checkpoints?.length ? `<ul class="checks">${section.checkpoints.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}</article>`).join('');
  const topicLinks = topics.filter(item => item.id !== topic.id).slice(0, 6).map(item => `<a href="${esc(item.route)}">${esc(item.title)}</a>`).join('');
  return `${css}<div class="v3" data-dtf-topic="${esc(topic.id)}">
  <section class="hero"><div class="wrap topic-hero"><div><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/learn/">Teaching Healthy Cultivation</a><span>›</span><span>${esc(topic.title)}</span></nav><p class="kicker">THC Subject Library</p><h1>${esc(topic.title)}</h1><p class="lede">${esc(topic.summary)}</p><div class="topic-meta"><span>${esc(String((topic.sections || []).length))} core sections</span>${keywords.map(word => `<span>${esc(word)}</span>`).join('')}</div><div class="actions">${btn('/learn/', 'All subjects', true)}${btn('/learn/infographics/', 'Visual library', false)}${btn('/learn/search/', 'Search education', false)}</div></div><div class="topic-hero">${img(visual, `${topic.title} educational visual`, { ratio: '1/1', eager: true })}</div></div></section>

  <section class="section"><div class="wrap"><div class="heading"><div><p class="eyebrow">Core literature</p><h2>Build the model before making the decision.</h2></div><p>The sections below keep plant science, observation, and practical checkpoints together so the page works as a usable reference instead of a text dump.</p></div><div class="lesson-grid">${lessonCards}</div></div></section>

  <section class="section soft"><div class="wrap"><div class="heading"><div><p class="eyebrow">Visual references</p><h2>Use diagrams to support the literature.</h2></div><p>Visuals help with anatomy, comparisons, and measurement concepts, but they do not replace context or diagnosis.</p></div><div class="visual-grid">${related.map(item => `<figure class="visual"><a href="/learn/infographics/">${img(item, `${topic.title} visual reference`, { ratio: '4/3' })}</a><figcaption>${esc(plain(rendered(item.title)) || topic.title)}</figcaption></figure>`).join('')}</div><div class="actions light-actions">${btn('/learn/infographics/', 'Open full visual library', true)}</div></div></section>

  <section class="section dark"><div class="wrap"><div class="heading"><div><p class="eyebrow">Continue learning</p><h2>Move sideways only when the evidence calls for it.</h2></div><p>Related THC subjects remain one click away without overwhelming the page with another full catalog.</p></div><div class="route-strip">${topicLinks}</div><div class="actions">${btn('/thc-grow-doc/', 'Use Grow Doc', true)}${btn('/growlens/', 'Document in GrowLens', false)}${btn('/community/', 'Discuss with community', false)}</div></div></section>
  </div>`;
}

async function flushCacheBestEffort() {
  const endpoint = `${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
  let session = '';
  const rpc = async payload => {
    const h = { Authorization: auth, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
    if (session) h['Mcp-Session-Id'] = session;
    const response = await fetch(endpoint, { method: 'POST', headers: h, body: JSON.stringify(payload), signal: AbortSignal.timeout(45_000) });
    const next = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id');
    if (next) session = next;
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch {
      for (const line of text.split(/\r?\n/)) if (line.startsWith('data:')) { try { body = JSON.parse(line.slice(5).trim()); break; } catch {} }
    }
    if (!response.ok || !body || body.error) throw new Error(`MCP ${response.status}`);
    return body;
  };
  for (const version of ['2025-06-18', '2025-03-26', '2024-11-05']) {
    try {
      session = '';
      await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: version, capabilities: {}, clientInfo: { name: 'DTFLearningV3', version: '1.0.0' } } });
      try { await rpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }); } catch {}
      const result = await rpc({ jsonrpc: '2.0', id: crypto.randomInt(1000, 999999), method: 'tools/call', params: { name: 'hostinger-ai-assistant-litespeed-cache-flush', arguments: {} } });
      if (result?.result?.isError === true) throw new Error('cache tool error');
      return true;
    } catch {}
  }
  return false;
}

async function publicCheck(path, marker) {
  const url = `${siteUrl}${path}${path.includes('?') ? '&' : '?'}dtf_v3=${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const response = await fetch(url, { redirect: 'follow', headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'DTFSeeds-Learning-V3-Verify/1.0' }, signal: AbortSignal.timeout(45_000) });
  const html = await response.text();
  return { path, status: response.status, marker, markerFound: html.includes(marker), bytes: html.length };
}

const home = await ensurePage('home', 'DTF Genetics | Dream the Future');
const learn = await ensurePage('learn', 'Teaching Healthy Cultivation');
await updatePage(home, buildHome(), 'DTF Genetics | Dream the Future');
await updatePage(learn, buildLearn(), 'Teaching Healthy Cultivation');

const topicResults = [];
for (const topic of topics) {
  const slug = String(topic.route || '').split('/').filter(Boolean).pop();
  if (!slug) throw new Error(`Topic ${topic.id} has no usable route`);
  const page = await ensurePage(slug, topic.title, learn.id || 0);
  await updatePage(page, buildTopic(topic), topic.title);
  topicResults.push({ id: topic.id, slug, pageId: page.id || null, route: topic.route });
}

const cacheFlushed = apply ? await flushCacheBestEffort() : false;
const checks = [];
if (apply) {
  checks.push(await publicCheck('/', 'data-dtf-layout="home-v3"'));
  checks.push(await publicCheck('/learn/', 'data-dtf-layout="learn-v3"'));
  for (const topic of topics) checks.push(await publicCheck(topic.route, `data-dtf-topic="${topic.id}"`));
  const failures = checks.filter(check => check.status !== 200 || !check.markerFound);
  if (failures.length) throw new Error(`Visitor verification failed: ${failures.map(item => `${item.path}:${item.status}:${item.markerFound}`).join(', ')}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  backupDir,
  mediaCount: media.length,
  topicCount: topics.length,
  cacheFlushed,
  topicResults,
  checks,
  selectedImages: Object.fromEntries(Object.entries(topicImages).map(([id, item]) => [id, item ? { id: item.id, url: item.source_url, title: plain(rendered(item.title)) } : null]))
};
await writeFile(join(backupDir, 'learning-v3-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'learning-v3-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
