import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_VISUAL_V4 || '').toLowerCase() === 'true';
const cssPath = process.env.DTF_VISUAL_CSS || join(process.cwd(), 'site/design-system/dtf-visual-v1.css');
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-visual-v4';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const css = await readFile(cssPath, 'utf8');
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `visual-v4-${stamp}`);
await mkdir(backupDir, { recursive: true });

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Visual-V4/1.0' };
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
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        await sleep(1200 * attempt);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(1200 * attempt);
    }
  }
  throw lastError;
}

async function getPage(slug) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || !rows.length) throw new Error(`WordPress page not found for slug ${slug}`);
  return rows[0];
}

async function fetchMedia() {
  const rows = [];
  for (let page = 1; page <= 7; page += 1) {
    try {
      const batch = await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || !batch.length) break;
      rows.push(...batch);
      if (batch.length < 100) break;
    } catch (error) {
      if (/invalid_page_number|400/i.test(error.message)) break;
      throw error;
    }
  }
  return rows;
}

function mediaText(item) {
  return [item?.slug, rendered(item?.title), item?.alt_text, rendered(item?.caption), rendered(item?.description), item?.source_url].join(' ').toLowerCase();
}

function choose(media, groups, used = new Set()) {
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
  return null;
}

function image(item, fallbackAlt, { eager = false } = {}) {
  if (!item) return '<div class="panel" style="min-height:100%;background:linear-gradient(145deg,#143622,#2e5239)" aria-hidden="true"></div>';
  const src = item.source_url || item?.guid?.rendered || '';
  const alt = plain(item.alt_text || rendered(item.title) || fallbackAlt);
  return `<img src="${esc(src)}" alt="${esc(alt)}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

const styleTag = `<style id="dtf-visual-v1">${css}</style>`;
const btn = (href, label, primary = false) => `<a class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" href="${esc(href)}">${esc(label)}</a>`;
const chip = label => `<span class="meta-chip">${esc(label)}</span>`;

function card({ title, copy, href, media, label = 'Open', className = '', meta = [], lineage = '' }) {
  return `<article class="card ${esc(className)}"><div class="card-media">${image(media, title)}</div><div class="card-body">${meta.length ? `<div class="${className.includes('game-card') ? 'game-meta' : 'strain-meta'}">${meta.map(chip).join('')}</div>` : ''}<h3>${esc(title)}</h3>${lineage ? `<div class="lineage">${esc(lineage)}</div>` : ''}<p>${esc(copy)}</p><a class="card-link" href="${esc(href)}">${esc(label)} →</a></div></article>`;
}

function footer() {
  return `<footer class="footer-shell"><div class="wrap"><div class="footer-grid"><div class="footer-brand"><h2 style="font-size:2rem">DTF Genetics</h2><p>Dream the Future through documented genetics, plant-science education, practical tools, original games, and community.</p></div><div><h3>Genetics</h3><a href="/seeds/">All strains</a><a href="/seeds/blue-mango/">Blue Mango</a><a href="/seeds/mango-bubbles/">Mango Bubbles</a><a href="/shop/">Shop releases</a></div><div><h3>Learn</h3><a href="/learn/start-here/">Start Here</a><a href="/learn/encyclopedia/">Encyclopedia</a><a href="/learn/infographics/">Visual Library</a><a href="/learn/glossary/">Glossary</a></div><div><h3>Tools</h3><a href="/tools/">Tools Hub</a><a href="/growlens/">GrowLens</a><a href="/thc-grow-doc/">Grow Doc</a><a href="/atlas/">Plant Atlas</a></div><div><h3>More</h3><a href="/games/">Games</a><a href="/community/">Community</a><a href="/about/">About</a><a href="/contact/">Contact</a></div></div><div class="footer-legal"><span>DTF Genetics · Dream the Future</span><span>Adults only where required by local law.</span></div></div></footer>`;
}

function homePage(p) {
  const genetics = [
    { title: 'Mango Bubbles', href: '/seeds/mango-bubbles/', media: p.mangoBubbles, meta: ['F1', 'Regular'], lineage: 'Blue Mango × Blue Bubblegum', copy: 'A mango-forward, bubblegum-sweet line with release-specific breeding context and documented lineage.' },
    { title: 'Blue Mango', href: '/seeds/blue-mango/', media: p.blueMango, meta: ['F2', 'Regular + Fem'], lineage: 'Somango XXL × Blueberry Butcher', copy: 'Flagship DTF project selected around vigor, branching, resin, structure, and a blueberry-mango aromatic direction.' },
    { title: 'Blue Bubblegum', href: '/seeds/blue-bubblegum/', media: p.blueBubblegum, meta: ['F1', 'Regular'], lineage: 'Bubblegum Kush × Blueberry Butcher', copy: 'A documented parent line used in Mango Bubbles with sweet fruit and bubblegum selection direction.' }
  ];
  return `${styleTag}<main class="dtf-v1" data-dtf-layout="home-visual-v4"><section class="site-hero"><div class="wrap hero-grid"><div class="hero-copy"><h1>Premium genetics. Real education. Powerful tools. Epic games.</h1><p>DTF Seeds brings documented genetics, Teaching Healthy Cultivation, grower tools, original browser games, and community into one premium botanical experience.</p><div class="actions">${btn('/seeds/','Explore genetics',true)}${btn('/learn/','Start learning')}${btn('/games/','Play now')}</div><div class="quick-destinations"><a href="/seeds/"><strong>Genetics</strong><span>Explore documented lines and breeding context.</span></a><a href="/learn/"><strong>Learn</strong><span>Science-backed cultivation education and visual guides.</span></a><a href="/tools/"><strong>Tools</strong><span>Track, measure, diagnose, and improve.</span></a><a href="/games/"><strong>Games</strong><span>Original DTF browser games and multiplayer.</span></a></div></div><div class="hero-media">${image(p.hero,'DTF Genetics premium cannabis plant', { eager: true })}</div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><h2>Latest genetics</h2><p>Every featured line leads to a proper genetics profile instead of stopping at a product listing.</p></div><div class="grid-3">${genetics.map(item => card({ ...item, className:'strain-card', label:'View line' })).join('')}</div></div></section>
<section class="section section-light"><div class="wrap"><div class="education-feature"><div class="large-visual">${image(p.education,'Detailed cannabis cultivation science infographic')}</div><div class="panel feature-copy" style="background:#fffdf7;color:#102b1a;border-color:#d8c895"><h2>Understanding the plant changes the grow.</h2><p style="color:#5d7063">Teaching Healthy Cultivation connects plant biology, lighting, environment, water, nutrition, training, plant health, genetics, harvest, and records into one learning system.</p><div class="actions">${btn('/learn/','Enter learning center',true)}<a class="btn" style="color:#102b1a!important;border-color:#b4a26b" href="/learn/infographics/">Browse visual library</a></div></div></div></div></section>
<section class="section section-mid"><div class="wrap"><div class="section-heading"><h2>Featured tool</h2><p>Use the science on the site inside a practical workflow built around real observations and measurements.</p></div><div class="grid-2"><article class="panel" style="padding:28px"><h2 style="font-size:2.5rem">GrowLens</h2><p class="muted">Track plants, grow spaces, journals, tasks, environment, VPD, DLI, irrigation, photos, harvest records, and reports.</p><div class="actions">${btn('/growlens/','Open GrowLens',true)}</div></article><article class="panel" style="padding:28px"><h2 style="font-size:2.5rem">Grow Doc</h2><p class="muted">Work through plant-health evidence with context, ranked possibilities, missing-evidence prompts, and references instead of guessing from one symptom.</p><div class="actions">${btn('/thc-grow-doc/','Start diagnosis',true)}</div></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><h2>Play DTF</h2><p>Each game keeps its own art direction, but the catalog uses one premium wrapper and browse system.</p></div><div class="game-rail">${card({ title:'High Life',copy:'Build a grower career from bagseed to legacy across three eras.',href:'/games/high-life/',media:p.highLife,label:'Play now',className:'game-card',meta:['Strategy','Single player'] })}${card({ title:'Weedopolis',copy:'A cannabis-themed property strategy experience built for the DTF game hub.',href:'/games/weedopolis/',media:p.weedopolis,label:'Play now',className:'game-card',meta:['Board strategy'] })}${card({ title:'Strain Showdown',copy:'Build a line, make selections, and evolve keepers through card-driven play.',href:'/games/strain-showdown/',media:p.showdown,label:'Play now',className:'game-card',meta:['Card strategy'] })}</div></div></section>
<section class="section section-mid"><div class="wrap"><div class="section-heading"><h2>Built around community</h2><p>Grow-offs, game nights, education, project feedback, and community spotlights belong beside the products—not buried in an empty page.</p></div><div class="actions">${btn('/community/','Open community',true)}${btn('https://discord.gg/xJbUeHFPMt','Join Discord')}</div></div></section>${footer()}</main>`;
}

function learnPage(p) {
  const destinations = [
    ['Start Here','New to growing? Begin with the ordered foundation path.','/learn/start-here/'],
    ['Subject Library','Explore plant biology, environment, lighting, roots, nutrition, health, genetics, and harvest.','/learn/encyclopedia/'],
    ['Encyclopedia','Use deeper reference material when you need a specific mechanism or concept.','/learn/encyclopedia/'],
    ['Visual Library','Browse full-sheet infographics and detailed scientific visual references.','/learn/infographics/'],
    ['Plant Atlas','Explore plant structures and connect anatomy to function.','/atlas/'],
    ['Tools','Carry what you learn into records, measurements, and diagnosis.','/tools/']
  ];
  const paths = [
    ['New Grower Path','Build the vocabulary and foundations first.','/learn/start-here/'],
    ['Science Path','Go deeper into biology, light, environment, roots, and nutrition.','/learn/plant-biology/'],
    ['Plant Health Path','Learn observation, IPM, evidence, and diagnosis.','/learn/ipm/'],
    ['Breeder Path','Connect genetics, inheritance, selection, phenotype, and records.','/learn/genetics-breeding/']
  ];
  return `${styleTag}<main class="dtf-v1" data-dtf-layout="learn-visual-v4"><section class="site-hero"><div class="wrap hero-grid"><div class="hero-copy"><h1>Knowledge grows here.</h1><p>Evidence-based cultivation education for better growers. Learn the plant as a connected biological system, then apply that understanding to what you observe and measure.</p><div class="actions">${btn('/learn/start-here/','Start here',true)}${btn('/learn/infographics/','Browse visual library')}${btn('/atlas/','Open plant atlas')}</div></div><div class="hero-media">${image(p.education,'Teaching Healthy Cultivation scientific plant visual', { eager:true })}</div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><h2>Choose how you want to learn.</h2><p>The learning center exposes the depth already built underneath it instead of reducing everything to a few generic links.</p></div><div class="grid-3">${destinations.map(([title,copy,href]) => `<article class="panel" style="padding:22px"><h3>${esc(title)}</h3><p class="muted">${esc(copy)}</p><a class="card-link" href="${esc(href)}">Open →</a></article>`).join('')}</div></div></section>
<section class="section section-mid"><div class="wrap"><div class="education-feature"><div class="panel feature-copy"><h2>Featured lesson: the science of light.</h2><p>Connect PPFD, DLI, photoperiod, intensity, leaf response, and canopy distribution instead of treating a light setting as a single isolated number.</p><div class="actions">${btn('/learn/lighting/','Read lesson',true)}</div></div><div class="large-visual">${image(p.lighting,'Cannabis lighting science diagram')}</div></div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><h2>Learning paths</h2><p>Different goals need different starting points. Use a guided path instead of guessing which page comes next.</p></div><div class="grid-4">${paths.map(([title,copy,href]) => `<article class="panel" style="padding:20px"><h3>${esc(title)}</h3><p class="muted">${esc(copy)}</p><a class="card-link" href="${esc(href)}">Start path →</a></article>`).join('')}</div></div></section>
<section class="section section-light"><div class="wrap"><div class="section-heading"><h2>Visual plant science</h2><p>Feature the detailed graphics as a core product of the learning system instead of hiding them in a long text index.</p></div><div class="grid-3">${card({title:'Plant anatomy',copy:'See the plant as a connected system of organs, tissues, transport, and growth.',href:'/learn/plant-biology/',media:p.anatomy,label:'Open subject'})}${card({title:'Environment & VPD',copy:'Understand the relationship between temperature, humidity, leaf temperature, VPD, and airflow.',href:'/learn/environment-vpd/',media:p.vpd,label:'Open subject'})}${card({title:'Root zone',copy:'Connect irrigation, oxygen, media, pH, EC, root health, and nutrient availability.',href:'/learn/water-root-zone/',media:p.roots,label:'Open subject'})}</div><div class="actions">${btn('/learn/infographics/','Browse all visuals',true)}</div></div></section>
<section class="section section-mid"><div class="wrap"><div class="section-heading"><h2>Learn. Measure. Diagnose.</h2><p>Education connects directly to GrowLens, Grow Doc, and the Plant Atlas so the site feels like one ecosystem.</p></div><div class="actions">${btn('/tools/','Open tools',true)}${btn('/growlens/','Open GrowLens')}${btn('/thc-grow-doc/','Open Grow Doc')}</div></div></section>${footer()}</main>`;
}

function geneticsPage(p) {
  const strains = [
    { title:'Mango Bubbles',href:'/seeds/mango-bubbles/',media:p.mangoBubbles,meta:['F1','Regular'],lineage:'Blue Mango × Blue Bubblegum',copy:'Reviewed release lineage: Blue Mango F2 × Blue Bubblegum F1, with mango-forward and bubblegum-sweet selection direction.' },
    { title:'Blue Mango',href:'/seeds/blue-mango/',media:p.blueMango,meta:['F2','Regular + Fem'],lineage:'Somango XXL × Blueberry Butcher',copy:'Flagship DTF line developed across filial generations with documented breeding context and selection notes.' },
    { title:'Blue Bubblegum',href:'/seeds/blue-bubblegum/',media:p.blueBubblegum,meta:['F1','Regular'],lineage:'Bubblegum Kush × Blueberry Butcher',copy:'A documented DTF breeding line and parent in the Mango Bubbles project.' }
  ];
  return `${styleTag}<main class="dtf-v1" data-dtf-layout="genetics-visual-v4"><section class="site-hero"><div class="wrap hero-grid"><div class="hero-copy"><h1>Our genetics.</h1><p>Premium documented lines built around lineage, generation, selection direction, and observed grow context—not just strain names and product cards.</p><div class="actions">${btn('/shop/','Shop current releases',true)}${btn('/about/','Breeding philosophy')}</div></div><div class="hero-media">${image(p.blueMango,'DTF Genetics Blue Mango cannabis flower', { eager:true })}</div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><h2>DTF genetics catalog</h2><p>Every card now gives visitors a direct path into the full genetics profile, where lineage and project context can be explained properly.</p></div><div class="grid-3">${strains.map(item => card({ ...item,className:'strain-card',label:'View line' })).join('')}</div></div></section>
<section class="section section-mid"><div class="wrap"><div class="education-feature"><div class="panel feature-copy"><h2>Breeding philosophy</h2><p>Breed for vigor, terpene expression, plant resilience, resin, structure, and repeatable documentation. Separate observed traits from expectations, and keep project history visible.</p><div class="actions">${btn('/about/','Our story',true)}${btn('/learn/genetics-breeding/','Learn genetics')}</div></div><div class="large-visual">${image(p.geneticsDiagram,'Cannabis genetics and breeding educational diagram')}</div></div></div></section>
<section class="section section-light"><div class="wrap"><div class="section-heading"><h2>Read the profile before the pack.</h2><p>Product pages handle price and inventory. Genetics profiles explain what the line is, where it came from, and what has actually been documented.</p></div><div class="actions">${btn('/shop/','Open shop',true)}<a class="btn" style="color:#102b1a!important;border-color:#b4a26b" href="/learn/genetics-breeding/">Genetics education</a></div></div></section>${footer()}</main>`;
}

const media = await fetchMedia();
const used = new Set();
const picks = {
  hero: choose(media,[['cannabis','flower'],['whole','plant'],['plant','atlas']],used),
  mangoBubbles: choose(media,[['mango','bubbles'],['mango','bubble']],used),
  blueMango: choose(media,[['blue','mango'],['mango']],used),
  blueBubblegum: choose(media,[['blue','bubblegum'],['bubblegum']],used),
  education: choose(media,[['plant','anatomy'],['plant','science'],['infographic']],used),
  lighting: choose(media,[['ppfd'],['dli'],['lighting']],used),
  anatomy: choose(media,[['plant','anatomy'],['leaf','anatomy']],used),
  vpd: choose(media,[['vpd'],['temperature','humidity']],used),
  roots: choose(media,[['root','zone'],['root','anatomy']],used),
  geneticsDiagram: choose(media,[['genetics'],['breeding'],['phenotype']],used),
  highLife: choose(media,[['high','life'],['bagseed','legacy']],used),
  weedopolis: choose(media,[['weedopolis']],used),
  showdown: choose(media,[['strain','showdown']],used)
};

const pages = {
  home: await getPage('home'),
  learn: await getPage('learn'),
  seeds: await getPage('seeds')
};

const output = {
  home: homePage(picks),
  learn: learnPage(picks),
  seeds: geneticsPage(picks)
};

for (const [key,page] of Object.entries(pages)) {
  await writeFile(join(backupDir, `${key}-before.json`), `${JSON.stringify(page,null,2)}\n`);
  await writeFile(join(backupDir, `${key}-preview.html`), `${output[key]}\n`);
  if (!apply) continue;
  await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method:'POST',
    body:JSON.stringify({ title:key === 'home' ? 'Home' : key === 'seeds' ? 'Genetics' : 'Learn', content:output[key], status:'publish' })
  });
}

console.log(JSON.stringify({
  ok:true,
  apply,
  pages:Object.fromEntries(Object.entries(pages).map(([key,page]) => [key,page.id])),
  mediaAvailable:media.length,
  selectedMedia:Object.fromEntries(Object.entries(picks).map(([key,item]) => [key,item ? { id:item.id,slug:item.slug,source_url:item.source_url } : null])),
  markers:['data-dtf-layout="home-visual-v4"','data-dtf-layout="learn-visual-v4"','data-dtf-layout="genetics-visual-v4"'],
  backupDir
},null,2));
