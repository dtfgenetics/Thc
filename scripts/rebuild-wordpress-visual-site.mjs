import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-visual-rebuild';
const apply = String(process.env.APPLY_VISUAL_REBUILD || '').toLowerCase() === 'true';
const brandPath = process.env.DTF_BRAND_ICON || join(process.cwd(), 'site/wordpress/assets/brand/dtf-potleaf-512.png');
const topicLiteraturePath = join(process.cwd(), 'site/wordpress/education/topic-literature.json');

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Visual-Rebuild/2.0' };
const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `visual-rebuild-${timestamp}`);
await mkdir(backupDir, { recursive: true });

function esc(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function rendered(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.rendered || value.raw || '';
  return '';
}

function plain(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status >= 500 || response.status === 429) && attempt < 5) {
        await sleep(attempt * 1800);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        await sleep(attempt * 1800);
        continue;
      }
    }
  }
  throw lastError;
}

async function fetchAllMedia() {
  const rows = [];
  for (let page = 1; page <= 6; page += 1) {
    try {
      const batch = await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || !batch.length) break;
      rows.push(...batch);
      if (batch.length < 100) break;
    } catch (error) {
      if (/400|rest_post_invalid_page_number/i.test(error.message)) break;
      throw error;
    }
  }
  return rows;
}

function mediaText(item) {
  return [item.slug, rendered(item.title), rendered(item.caption), rendered(item.description), item.source_url].join(' ').toLowerCase();
}

function choose(media, groups, used = new Set()) {
  for (const group of groups) {
    const needles = Array.isArray(group) ? group : [group];
    const found = media.find((item) => item?.source_url && !used.has(item.id) && needles.every((needle) => mediaText(item).includes(String(needle).toLowerCase())));
    if (found) {
      used.add(found.id);
      return found;
    }
  }
  return null;
}

function imageUrl(item) { return item?.source_url || item?.guid?.rendered || ''; }
function imageAlt(item, fallback) { return plain(rendered(item?.alt_text) || rendered(item?.title) || fallback); }

function img(item, alt, { ratio = '4/3', eager = false, className = 'dtf-img' } = {}) {
  if (!item) return '';
  return `<img class="${esc(className)}" src="${esc(imageUrl(item))}" alt="${esc(imageAlt(item, alt))}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="aspect-ratio:${esc(ratio)}">`;
}

function button(href, label, primary = true) {
  return `<a class="dtf-btn ${primary ? 'dtf-btn-primary' : 'dtf-btn-secondary'}" href="${esc(href)}">${esc(label)}</a>`;
}

function textLink(href, label) {
  return `<a class="dtf-text-link" href="${esc(href)}">${esc(label)} <span aria-hidden="true">→</span></a>`;
}

function imageCard({ title, text, href, image, label = 'Explore', eyebrow = '' }) {
  return `<article class="dtf-card dtf-image-card">${image ? img(image, title, { ratio: '16/10' }) : ''}<div class="dtf-card-copy">${eyebrow ? `<p class="dtf-eyebrow">${esc(eyebrow)}</p>` : ''}<h3>${esc(title)}</h3><p>${esc(text)}</p>${textLink(href, label)}</div></article>`;
}

function compactCard({ title, text, href, label = 'Open', eyebrow = '' }) {
  return `<article class="dtf-card dtf-compact-card">${eyebrow ? `<p class="dtf-eyebrow">${esc(eyebrow)}</p>` : ''}<h3>${esc(title)}</h3><p>${esc(text)}</p>${textLink(href, label)}</article>`;
}

function stat(value, label) {
  return `<div class="dtf-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
}

async function getPage(slug) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected exactly one page for slug ${slug}, found ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

async function updatePage(page, content, title = null) {
  await writeFile(join(backupDir, `page-${page.id}-${page.slug}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
  if (!apply) return page;
  return request(`/wp-json/wp/v2/pages/${page.id}`, { method: 'POST', body: JSON.stringify({ content, status: 'publish', ...(title ? { title } : {}) }) });
}

async function ensureBrandMedia() {
  const existing = await request('/wp-json/wp/v2/media?slug=dtf-potleaf-site-icon&context=edit&per_page=10');
  if (Array.isArray(existing) && existing[0]?.source_url) return existing[0];
  if (!apply) return null;
  const bytes = await readFile(brandPath);
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${basename(brandPath)}"` },
    body: bytes,
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000)
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  if (!response.ok || !body?.id) throw new Error(`Brand media upload failed (${response.status})`);
  return request(`/wp-json/wp/v2/media/${body.id}`, { method: 'POST', body: JSON.stringify({ slug: 'dtf-potleaf-site-icon', title: 'DTF Genetics Cannabis Leaf', alt_text: 'DTF Genetics cannabis leaf logo', caption: 'DTF Genetics cannabis leaf brand mark' }) });
}

async function applySiteIcon(brand) {
  const settings = await request('/wp-json/wp/v2/settings?context=edit');
  await writeFile(join(backupDir, 'settings-before.json'), `${JSON.stringify(settings, null, 2)}\n`);
  if (!apply || !brand?.id) return { siteIconSupported: Object.prototype.hasOwnProperty.call(settings, 'site_icon'), siteLogoSupported: Object.prototype.hasOwnProperty.call(settings, 'site_logo') };
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(settings, 'site_icon')) payload.site_icon = brand.id;
  if (Object.prototype.hasOwnProperty.call(settings, 'site_logo')) payload.site_logo = brand.id;
  if (Object.keys(payload).length) await request('/wp-json/wp/v2/settings', { method: 'POST', body: JSON.stringify(payload) });
  return { siteIconSupported: Object.prototype.hasOwnProperty.call(settings, 'site_icon'), siteLogoSupported: Object.prototype.hasOwnProperty.call(settings, 'site_logo'), payload };
}

const palette = {
  ink: '#102b1a',
  green: '#1d7040',
  greenDark: '#0d2a19',
  greenDeep: '#081b11',
  gold: '#d6b75c',
  cream: '#f7f4ea',
  white: '#ffffff',
  text: '#173420',
  muted: '#526557',
  line: '#d7e2d9'
};

function pageStyles() {
  return `<style id="dtf-visual-system-v2">
  .dtf-page{background:${palette.cream};color:${palette.text};font-family:inherit;overflow:hidden}
  .dtf-wrap{width:min(1220px,calc(100% - 36px));margin:0 auto}
  .dtf-section{padding:72px 0}
  .dtf-section-tight{padding:46px 0}
  .dtf-section-dark{background:${palette.greenDark};color:#fff}
  .dtf-section-soft{background:#eef3ea}
  .dtf-hero{position:relative;background:radial-gradient(circle at 80% 12%,rgba(214,183,92,.22),transparent 30%),linear-gradient(145deg,${palette.greenDeep},${palette.greenDark});color:#fff;padding:76px 0 64px}
  .dtf-hero-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);gap:52px;align-items:center}
  .dtf-kicker,.dtf-eyebrow{margin:0 0 10px;color:${palette.gold};font-size:.76rem;line-height:1.3;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
  .dtf-hero h1{margin:0;font-size:clamp(2.8rem,6vw,5.5rem);line-height:.96;letter-spacing:-.05em;max-width:820px}
  .dtf-hero .dtf-lede{max-width:760px;margin:24px 0 0;color:#d7e5dc;font-size:1.13rem;line-height:1.75}
  .dtf-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}
  .dtf-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 18px;border-radius:999px;text-decoration:none!important;font-weight:850;border:1px solid transparent;transition:transform .16s ease,box-shadow .16s ease,background .16s ease}
  .dtf-btn:hover{transform:translateY(-1px)}
  .dtf-btn-primary{background:${palette.gold};color:${palette.greenDeep}!important;border-color:${palette.gold};box-shadow:0 10px 30px rgba(0,0,0,.16)}
  .dtf-btn-secondary{background:rgba(255,255,255,.07);color:#fff!important;border-color:rgba(255,255,255,.28)}
  .dtf-page>.dtf-section:not(.dtf-section-dark) .dtf-btn-secondary{background:#fff;color:${palette.text}!important;border-color:#bed0c2}
  .dtf-img{display:block;width:100%;height:auto;object-fit:cover;border-radius:26px;box-shadow:0 24px 60px rgba(3,28,14,.22);background:#e8efe9}
  .dtf-hero-media{position:relative}.dtf-hero-media:before{content:"";position:absolute;inset:-18px 22px 22px -18px;border:1px solid rgba(214,183,92,.55);border-radius:30px;pointer-events:none}
  .dtf-hero-media .dtf-img{position:relative;z-index:1}
  .dtf-quickbar{margin-top:-26px;position:relative;z-index:4}
  .dtf-quickgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;background:#fff;padding:12px;border-radius:22px;box-shadow:0 20px 48px rgba(18,49,29,.14);border:1px solid ${palette.line}}
  .dtf-quickgrid a{display:block;padding:14px;border-radius:14px;color:${palette.text}!important;text-decoration:none!important;font-weight:850;text-align:center;background:#f4f7f2}
  .dtf-quickgrid a:hover{background:#e8f1e9;color:${palette.green}!important}
  .dtf-heading{display:flex;gap:28px;align-items:end;justify-content:space-between;margin-bottom:28px}
  .dtf-heading>div{max-width:760px}.dtf-heading h2{margin:0;font-size:clamp(2.1rem,4vw,3.5rem);line-height:1.03;letter-spacing:-.04em}.dtf-heading>p{max-width:520px;margin:0;color:${palette.muted};line-height:1.65}
  .dtf-section-dark .dtf-heading>p{color:#c7d7cc}
  .dtf-grid-2,.dtf-grid-3,.dtf-grid-4,.dtf-grid-5{display:grid;gap:18px}
  .dtf-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.dtf-grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}.dtf-grid-5{grid-template-columns:repeat(5,minmax(0,1fr))}
  .dtf-card{background:#fff;border:1px solid ${palette.line};border-radius:22px;overflow:hidden;box-shadow:0 12px 32px rgba(18,49,29,.07)}
  .dtf-card-copy,.dtf-compact-card{padding:22px}.dtf-card h3{margin:0 0 9px;font-size:1.25rem;line-height:1.2}.dtf-card p:not(.dtf-eyebrow){margin:0;color:${palette.muted};line-height:1.65}
  .dtf-text-link{display:inline-flex;margin-top:16px;color:${palette.green}!important;text-decoration:none!important;font-weight:900}.dtf-text-link:hover{text-decoration:underline!important}
  .dtf-section-dark .dtf-card{background:#12351f;border-color:#31543d;box-shadow:none}.dtf-section-dark .dtf-card p:not(.dtf-eyebrow){color:#bfd2c4}.dtf-section-dark .dtf-text-link{color:#e8ce7d!important}
  .dtf-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:28px}.dtf-stat{padding:18px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(255,255,255,.05)}.dtf-stat strong{display:block;color:${palette.gold};font-size:1.8rem;line-height:1}.dtf-stat span{display:block;margin-top:6px;color:#cadbd0;font-size:.88rem}
  .dtf-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;counter-reset:dtfstep}.dtf-flow article{position:relative;background:#fff;border:1px solid ${palette.line};border-radius:20px;padding:24px}.dtf-flow article:before{counter-increment:dtfstep;content:counter(dtfstep);display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:${palette.greenDark};color:${palette.gold};font-weight:900;margin-bottom:18px}.dtf-flow h3{margin:0 0 8px}.dtf-flow p{margin:0;color:${palette.muted};line-height:1.6}
  .dtf-path-card{background:#fff;border:1px solid ${palette.line};border-radius:20px;padding:24px}.dtf-path-card h3{margin:0 0 8px}.dtf-path-card p{margin:0;color:${palette.muted};line-height:1.65}.dtf-path-card .dtf-actions{margin-top:16px}
  .dtf-callout{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:32px;align-items:center}
  .dtf-callout h2{margin:0 0 14px;font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.04em}.dtf-callout p{color:#c8d9ce;line-height:1.75}
  .dtf-link-cluster{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.dtf-link-cluster a{padding:8px 12px;border-radius:999px;background:#eef3ea;color:${palette.greenDark}!important;text-decoration:none!important;font-weight:800;font-size:.9rem}
  @media(max-width:980px){.dtf-hero-grid,.dtf-callout{grid-template-columns:1fr}.dtf-hero-media{max-width:680px}.dtf-quickgrid{grid-template-columns:repeat(3,minmax(0,1fr))}.dtf-grid-4,.dtf-grid-5{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-heading{align-items:flex-start;flex-direction:column}}
  @media(max-width:640px){.dtf-wrap{width:min(100% - 28px,1220px)}.dtf-section{padding:54px 0}.dtf-hero{padding:56px 0 48px}.dtf-hero h1{font-size:clamp(2.45rem,14vw,4rem)}.dtf-quickbar{margin-top:0;padding-top:14px}.dtf-quickgrid,.dtf-grid-2,.dtf-grid-3,.dtf-grid-4,.dtf-grid-5,.dtf-flow,.dtf-stats{grid-template-columns:1fr}.dtf-actions .dtf-btn{width:100%}.dtf-hero-media:before{display:none}}
  </style>`;
}

async function rebuildHeaderFooter(brand) {
  const parts = await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
  await writeFile(join(backupDir, 'template-parts-before.json'), `${JSON.stringify(parts, null, 2)}\n`);
  const brandLink = brand?.source_url
    ? `<a href="/" aria-label="DTF Genetics home" style="display:flex;align-items:center;gap:11px;color:#fff;text-decoration:none"><img src="${esc(brand.source_url)}" alt="DTF Genetics cannabis leaf" width="42" height="42" style="width:42px;height:42px;object-fit:contain"><span><strong style="display:block;font-size:1.02rem;line-height:1">DTF Genetics</strong><small style="display:block;color:${palette.gold};margin-top:4px;font-size:.62rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase">Dream the Future</small></span></a>`
    : '<a href="/" style="font-weight:900;color:#fff;text-decoration:none">DTF Genetics</a>';
  const nav = `<nav aria-label="Primary navigation" style="display:flex;gap:3px;flex-wrap:wrap;align-items:center"><a href="/seeds/" style="color:#e4eee7;text-decoration:none;padding:9px 10px;font-weight:750">Genetics</a><a href="/learn/" style="color:#e4eee7;text-decoration:none;padding:9px 10px;font-weight:750">Learn</a><a href="/tools/" style="color:#e4eee7;text-decoration:none;padding:9px 10px;font-weight:750">Tools</a><a href="/games/" style="color:#e4eee7;text-decoration:none;padding:9px 10px;font-weight:750">Games</a><a href="/community/" style="color:#e4eee7;text-decoration:none;padding:9px 10px;font-weight:750">Community</a><a href="/shop/" style="color:${palette.greenDeep};background:${palette.gold};text-decoration:none;padding:9px 15px;border-radius:999px;font-weight:900">Shop</a></nav>`;
  const header = `<!-- wp:html --><header style="position:relative;z-index:50;background:${palette.greenDeep};color:#fff;border-bottom:1px solid rgba(255,255,255,.12)"><div style="max-width:1240px;margin:auto;padding:12px 22px;display:flex;gap:20px;align-items:center;justify-content:space-between;flex-wrap:wrap">${brandLink}${nav}</div></header><!-- /wp:html -->`;
  const footer = `<!-- wp:html --><footer style="margin-top:0;background:${palette.greenDeep};color:#dfe9e2"><div style="max-width:1240px;margin:auto;padding:48px 22px"><div style="display:grid;grid-template-columns:1.25fr repeat(2,minmax(180px,.75fr));gap:30px"><div>${brandLink}<p style="max-width:480px;line-height:1.7;color:#b9ccbf">Documented genetics, Teaching Healthy Cultivation, practical grow tools, original games, and the community connecting them.</p></div><div><strong style="color:#fff">Explore</strong><p style="line-height:2"><a href="/seeds/" style="color:#dfe9e2">Genetics</a><br><a href="/learn/" style="color:#dfe9e2">Learn</a><br><a href="/tools/" style="color:#dfe9e2">Tools</a><br><a href="/games/" style="color:#dfe9e2">Games</a><br><a href="/shop/" style="color:#dfe9e2">Shop</a></p></div><div><strong style="color:#fff">Learn & connect</strong><p style="line-height:2"><a href="/learn/start-here/" style="color:#dfe9e2">Start Here</a><br><a href="/learn/encyclopedia/" style="color:#dfe9e2">Encyclopedia</a><br><a href="/learn/infographics/" style="color:#dfe9e2">Visual Library</a><br><a href="/community/" style="color:#dfe9e2">Community</a><br><a href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer" style="color:${palette.gold};font-weight:850">Discord</a></p></div></div><hr style="border:0;border-top:1px solid rgba(255,255,255,.12);margin:30px 0 22px"><p style="margin:0;color:#91aa9a;font-size:.88rem">© 2026 DTF Genetics · Dream the Future · Adults only. Follow applicable local laws.</p></div></footer><!-- /wp:html -->`;
  const targets = (parts || []).filter((part) => part.theme === 'hostinger-ai-theme' && (part.slug === 'header' || String(part.slug).startsWith('footer')));
  if (apply) {
    for (const part of targets) {
      const content = part.slug === 'header' ? header : footer;
      await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(part.id)}`, { method: 'POST', body: JSON.stringify({ content, status: 'publish' }) });
    }
  }
  return targets.map((item) => item.id);
}

const topicLiterature = JSON.parse(await readFile(topicLiteraturePath, 'utf8'));
const topics = Array.isArray(topicLiterature?.topics) ? topicLiterature.topics : [];
function topicRoute(needle, fallback = '/learn/encyclopedia/') {
  const q = String(needle).toLowerCase();
  const found = topics.find((topic) => `${topic.id || ''} ${topic.title || ''}`.toLowerCase().includes(q));
  return found?.route || fallback;
}

const routes = {
  biology: topicRoute('plant biology', '/learn/plant-biology/'),
  lifecycle: topicRoute('lifecycle', '/learn/lifecycle-propagation/'),
  environment: topicRoute('environment', '/learn/environment-vpd/'),
  lighting: topicRoute('lighting', '/learn/lighting/'),
  water: topicRoute('water', '/learn/water-root-zone/'),
  nutrition: topicRoute('nutrition', '/learn/nutrition-media/'),
  training: topicRoute('training', '/learn/training-canopy/'),
  ipm: topicRoute('plant health', '/learn/ipm/'),
  harvest: topicRoute('harvest', '/learn/harvest-postharvest/'),
  genetics: topicRoute('genetics', '/learn/genetics-breeding/'),
  outdoor: topicRoute('outdoor', '/learn/outdoor/'),
  research: topicRoute('evidence', '/learn/research-methods/')
};

const media = await fetchAllMedia();
await writeFile(join(backupDir, 'media-index.json'), `${JSON.stringify(media.map((item) => ({ id: item.id, slug: item.slug, title: plain(rendered(item.title)), source_url: item.source_url })), null, 2)}\n`);
const used = new Set();
const picks = {
  hero: choose(media, [['whole', 'plant', 'atlas'], ['plant', 'anatomy'], ['cell', 'canopy']], used),
  anatomy: choose(media, [['plant', 'anatomy'], ['cell', 'canopy']], used),
  roots: choose(media, [['root', 'anatomy'], ['root', 'zone', 'chemistry']], used),
  leaf: choose(media, [['leaf', 'anatomy'], ['gas', 'exchange']], used),
  trichome: choose(media, [['trichome', 'secretory'], ['trichome']], used),
  lifecycle: choose(media, [['life', 'cycle', 'seed', 'harvest'], ['seedling', 'establishment']], used),
  nutrition: choose(media, [['nutrition', 'science'], ['nutrient', 'uptake'], ['primary', 'macronutrients']], used),
  diagnose: choose(media, [['diagnosing', 'deficiency', 'toxicity'], ['deficiency', 'toxicity']], used),
  ipm: choose(media, [['beneficial', 'insects'], ['spider', 'mite']], used),
  training: choose(media, [['plant', 'training', 'basics'], ['stem', 'training', 'risk']], used),
  cloning: choose(media, [['cloning', 'guide'], ['germination']], used),
  genetics: choose(media, [['sex', 'expression'], ['breeding', 'projects']], used),
  flower: choose(media, [['flower', 'anatomy'], ['reproductive', 'structures']], used),
  evidence: choose(media, [['evidence', 'claim', 'specific'], ['observation', 'bounded', 'conclusion']], used),
  environment: choose(media, [['vpd'], ['temperature', 'humidity'], ['environment']], used),
  light: choose(media, [['ppfd'], ['dli'], ['lighting'], ['light']], used),
  harvest: choose(media, [['harvest'], ['drying'], ['curing']], used)
};
const missing = Object.entries(picks).filter(([, value]) => !value).map(([key]) => key);

const home = await getPage('home');
const learn = await getPage('learn');
const styles = pageStyles();

const homeTopics = [
  { image: picks.anatomy, title: 'Plant biology', text: 'Anatomy, transport, photosynthesis, respiration, signaling, flowers, and trichomes.', href: routes.biology },
  { image: picks.environment, title: 'Environment & VPD', text: 'Temperature, humidity, leaf temperature, VPD, airflow, and measurement.', href: routes.environment },
  { image: picks.nutrition, title: 'Nutrition & root zone', text: 'Water, pH, EC, media, nutrients, uptake, oxygen, and root-zone chemistry.', href: routes.nutrition },
  { image: picks.ipm, title: 'Plant health & IPM', text: 'Prevention, scouting, identification, differential reasoning, and compatible controls.', href: routes.ipm },
  { image: picks.training, title: 'Training & canopy', text: 'Architecture, topping, LST, pruning, support, airflow, and canopy distribution.', href: routes.training },
  { image: picks.genetics, title: 'Genetics & breeding', text: 'Genotype, phenotype, filial generations, selection, sex expression, and records.', href: routes.genetics }
];

const homeHtml = `${styles}<div class="dtf-page">
<section class="dtf-hero"><div class="dtf-wrap dtf-hero-grid"><div><p class="dtf-kicker">DTF Genetics · Dream the Future</p><h1>Genetics first. Cultivation science behind it.</h1><p class="dtf-lede">Explore documented DTF breeding projects, learn the plant through Teaching Healthy Cultivation, and use practical tools that connect observations to better decisions.</p><div class="dtf-actions">${button('/seeds/', 'Explore genetics', true)}${button('/learn/', 'Start learning', false)}${button('/shop/', 'Shop current releases', false)}</div><div class="dtf-stats">${stat('3', 'current genetics listings')}${stat('73+', 'finished teaching infographics')}${stat('2', 'core cultivation tools')}</div></div><div class="dtf-hero-media">${img(picks.hero, 'Teaching Healthy Cultivation whole-plant science', { ratio: '1/1', eager: true })}</div></div></section>

<div class="dtf-wrap dtf-quickbar"><nav class="dtf-quickgrid" aria-label="DTF quick destinations"><a href="/seeds/">Genetics</a><a href="/learn/">Learn</a><a href="/thc-grow-doc/">Diagnose</a><a href="/growlens/">Track a Grow</a><a href="/games/">Games</a></nav></div>

<section class="dtf-section"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Current releases</p><h2>Shop the pack. Read the breeding context.</h2></div><p>The store handles price and availability; the genetics catalog explains lineage, generation, selection direction, and what has actually been observed.</p></div><div class="dtf-grid-3">${imageCard({ title: 'Blue Mango F2 · Regular', text: 'Somango XXL × Blueberry Butcher. Regular F2 release with documented breeding context.', href: '/product/10-regular-f2-blue-mango-seeds/', image: picks.genetics, label: 'Open release', eyebrow: 'F2 · Regular' })}${imageCard({ title: 'Blue Mango F2 · Feminized', text: 'The feminized F2 route for the same Blue Mango breeding project.', href: '/product/10-feminized-f2-blue-mango-x/', image: picks.flower, label: 'Open release', eyebrow: 'F2 · Feminized' })}${imageCard({ title: 'Blue Bubblegum F1 · Regular', text: 'Bubblegum Kush × Blueberry Butcher and a parent line used in Mango Bubbles.', href: '/product/10-reg-f1-blueberry-bubblegum/', image: picks.trichome, label: 'Open release', eyebrow: 'F1 · Regular' })}</div><div class="dtf-actions">${button('/seeds/', 'Open genetics catalog', true)}${button('/shop/', 'View all current products', false)}</div></div></section>

<section class="dtf-section dtf-section-dark"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Teaching Healthy Cultivation</p><h2>Choose the subject you actually need.</h2></div><p>Topic cards now lead to their own literature instead of sending every subject to one general image library.</p></div><div class="dtf-grid-3">${homeTopics.map((item) => imageCard({ ...item, label: 'Open subject' })).join('')}</div><div class="dtf-actions">${button('/learn/', 'Open the full learning system', true)}${button('/learn/infographics/', 'Browse visual library', false)}</div></div></section>

<section class="dtf-section"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Plant-health workflow</p><h2>From symptom to evidence.</h2></div><p>The site should guide a grower into a process, not dump them into a pile of pages.</p></div><div class="dtf-flow"><article><h3>Observe</h3><p>Record location, pattern, plant stage, recent changes, and progression.</p></article><article><h3>Measure</h3><p>Add environment, root-zone conditions, irrigation, pH/EC where relevant, and pest evidence.</p></article><article><h3>Compare</h3><p>Use Grow Doc and subject literature to compare plausible causes instead of naming one from color alone.</p></article><article><h3>Track</h3><p>Document the correction and watch new growth so the diagnosis can be tested.</p></article></div><div class="dtf-actions">${button('/thc-grow-doc/', 'Open THC Grow Doc', true)}${button('/yellow-leaves/', 'Yellow-leaves guide', false)}${button('/growlens/', 'Track observations in GrowLens', false)}</div></div></section>

<section class="dtf-section dtf-section-soft"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Tools</p><h2>Two tools. Two clear jobs.</h2></div><p>GrowLens manages the grow; Grow Doc helps reason through plant-health evidence. The education system explains the science behind both.</p></div><div class="dtf-grid-2">${imageCard({ title: 'THC GrowLens', text: 'Plants, grow spaces, journals, tasks, environmental readings, VPD and DLI, feeding, irrigation, photos, harvest records, reports, and exports.', href: '/growlens/', image: picks.environment, label: 'Open GrowLens', eyebrow: 'Grow management' })}${imageCard({ title: 'THC Grow Doc', text: 'Structured plant-health intake, multi-view media, ranked differentials, evidence for and against, missing-evidence prompts, and references.', href: '/thc-grow-doc/', image: picks.diagnose, label: 'Start a diagnosis', eyebrow: 'Plant-health evidence' })}</div><div class="dtf-actions">${button('/tools/', 'View cultivation tools', true)}</div></div></section>

<section class="dtf-section"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Community & play</p><h2>Keep the secondary experiences easy to find—without letting them bury the core site.</h2></div><p>Games and community support retention, testing, learning, and participation after visitors can clearly find genetics, education, and tools.</p></div><div class="dtf-grid-2">${compactCard({ title: 'DTF Game Hub', text: 'Original browser games, puzzles, strategy, trivia, and multiplayer projects organized by release status.', href: '/games/', label: 'Open Game Hub' })}${compactCard({ title: 'Teaching Healthy Cultivation Community', text: 'Grow discussion, education, grow-offs, project feedback, game testing, and community participation.', href: '/community/', label: 'Open community page' })}</div><div class="dtf-actions">${button('https://discord.gg/xJbUeHFPMt', 'Join Discord', true)}</div></div></section>
</div>`;

const subjectCards = [
  { image: picks.anatomy, title: 'Plant Biology & Anatomy', text: 'Cells, tissues, roots, stems, leaves, flowers, transport, photosynthesis, respiration, and signaling.', href: routes.biology },
  { image: picks.lifecycle, title: 'Lifecycle & Propagation', text: 'Germination, seedlings, cloning, vegetative growth, flowering, maturation, and transitions.', href: routes.lifecycle },
  { image: picks.environment, title: 'Environment & VPD', text: 'Temperature, RH, leaf temperature, VPD, airflow, carbon dioxide, stability, and measurement.', href: routes.environment },
  { image: picks.light, title: 'Lighting', text: 'PPFD, DLI, photoperiod, spectrum, fixture distance, uniformity, measurement, and plant response.', href: routes.lighting },
  { image: picks.roots, title: 'Water & Root Zone', text: 'Water quality, irrigation, oxygen, media, pH, EC, dryback, salinity, and root health.', href: routes.water },
  { image: picks.nutrition, title: 'Nutrition & Media', text: 'Macro- and micronutrients, uptake, interactions, availability, deficiencies, toxicities, and media.', href: routes.nutrition },
  { image: picks.training, title: 'Training & Canopy', text: 'LST, topping, pruning, HST, SCROG, mainlining, support, airflow, and canopy distribution.', href: routes.training },
  { image: picks.ipm, title: 'Plant Health & IPM', text: 'Prevention, sanitation, scouting, pest identification, pathogens, biological controls, and decisions.', href: routes.ipm },
  { image: picks.harvest || picks.trichome, title: 'Harvest & Post-Harvest', text: 'Maturity assessment, harvest handling, drying, curing, storage, moisture control, and quality preservation.', href: routes.harvest },
  { image: picks.genetics, title: 'Genetics & Breeding', text: 'Genotype and phenotype, filial generations, inheritance, sex expression, selection, variation, and records.', href: routes.genetics },
  { image: picks.lifecycle, title: 'Outdoor Cultivation', text: 'Site, sun, season, soil, water, wind, rain, wildlife, pests, pollen drift, and microclimates.', href: routes.outdoor },
  { image: picks.evidence, title: 'Evidence & Measurement', text: 'Observation, sampling, measurements, replication, uncertainty, claim auditing, and comparable records.', href: routes.research }
];

const learnHtml = `${styles}<div class="dtf-page">
<section class="dtf-hero"><div class="dtf-wrap dtf-hero-grid"><div><p class="dtf-kicker">Teaching Healthy Cultivation</p><h1>Learn the plant as a connected system.</h1><p class="dtf-lede">Start with a pathway, move into the right subject, use the visual library when a diagram helps, and go deeper in the encyclopedia when you need reference-level detail.</p><div class="dtf-actions">${button('/learn/start-here/', 'Start here', true)}${button('/learn/academy/', 'Open Academy', false)}${button('/learn/encyclopedia/', 'Browse Encyclopedia', false)}</div></div><div class="dtf-hero-media">${img(picks.anatomy, 'Cannabis plant anatomy educational visual', { ratio: '1/1', eager: true })}</div></div></section>

<div class="dtf-wrap dtf-quickbar"><nav class="dtf-quickgrid" aria-label="THC learning destinations"><a href="/learn/start-here/">Start Here</a><a href="/learn/academy/">Academy</a><a href="/learn/encyclopedia/">Encyclopedia</a><a href="/learn/infographics/">Visual Library</a><a href="/learn/search/">Search</a></nav></div>

<section class="dtf-section"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Explore by subject</p><h2>Go directly to the correct subject library.</h2></div><p>Every card below opens its own companion literature. Infographics support the subject pages; they are no longer the only destination.</p></div><div class="dtf-grid-3">${subjectCards.map((item) => imageCard({ ...item, label: 'Open subject' })).join('')}</div></div></section>

<section class="dtf-section dtf-section-dark"><div class="dtf-wrap"><div class="dtf-callout"><div>${img(picks.diagnose, 'Deficiency versus toxicity diagnostic visual', { ratio: '4/3' })}</div><div><p class="dtf-eyebrow">Plant-health reasoning</p><h2>A symptom is a starting point, not a diagnosis.</h2><p>Use symptom location and pattern, plant stage, environment, irrigation, root-zone conditions, recent changes, pest evidence, and measurements together. Compare plausible causes and track the response after correction.</p><div class="dtf-actions">${button('/thc-grow-doc/', 'Use THC Grow Doc', true)}${button('/yellow-leaves/', 'Yellow-leaves guide', false)}${button(routes.ipm, 'Plant Health & IPM', false)}</div></div></div></div></section>

<section class="dtf-section dtf-section-soft"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Choose a path</p><h2>Different goals need different starting points.</h2></div><p>These paths connect the major libraries instead of forcing every visitor to figure out the information architecture themselves.</p></div><div class="dtf-grid-4"><article class="dtf-path-card"><h3>New grower</h3><p>Build fundamentals in plant biology, environment, lighting, water, crop stages, sanitation, and observation.</p><div class="dtf-actions">${button('/learn/start-here/', 'Start pathway', true)}</div></article><article class="dtf-path-card"><h3>Plant problem</h3><p>Start with evidence intake, then move into plant health, roots, environment, and nutrition as the clues require.</p><div class="dtf-actions">${button('/thc-grow-doc/', 'Diagnose', true)}${button(routes.ipm, 'IPM reference', false)}</div></article><article class="dtf-path-card"><h3>Environment & lighting</h3><p>Build from temperature, RH, leaf temperature, VPD, airflow, PPFD, DLI, photoperiod, and repeatable measurement.</p><div class="dtf-actions">${button(routes.environment, 'Environment', true)}${button(routes.lighting, 'Lighting', false)}</div></article><article class="dtf-path-card"><h3>Breeding & documentation</h3><p>Study genetics, phenotype, selection, generations, identity control, records, and claim-specific evidence.</p><div class="dtf-actions">${button(routes.genetics, 'Genetics', true)}${button(routes.research, 'Evidence', false)}</div></article></div></div></section>

<section class="dtf-section"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Reference system</p><h2>Use the right depth for the question.</h2></div><p>Short visual explanations, structured courses, deeper encyclopedia entries, and searchable reference pages should work together rather than duplicate each other.</p></div><div class="dtf-grid-4">${compactCard({ title: 'Academy', text: 'Structured learning paths for people who want progression instead of random articles.', href: '/learn/academy/', label: 'Open Academy' })}${compactCard({ title: 'Encyclopedia', text: 'Reference-level plant science and cultivation concepts organized for deeper lookup.', href: '/learn/encyclopedia/', label: 'Browse Encyclopedia' })}${compactCard({ title: 'Visual Library', text: 'Finished teaching infographics organized by subject, with companion literature attached.', href: '/learn/infographics/', label: 'Browse visuals' })}${compactCard({ title: 'Search', text: 'Find a topic across the public learning system and jump directly to the relevant section.', href: '/learn/search/', label: 'Search THC' })}</div></div></section>

<section class="dtf-section dtf-section-dark"><div class="dtf-wrap"><div class="dtf-heading"><div><p class="dtf-eyebrow">Put the knowledge to work</p><h2>Learn, measure, diagnose, document.</h2></div><p>The learning system connects directly to the tools and community so visitors can move from reading into observation and records.</p></div><div class="dtf-grid-3">${compactCard({ title: 'THC GrowLens', text: 'Record plants, tasks, environment, irrigation, feeding, photos, harvests, reports, and exports.', href: '/growlens/', label: 'Open GrowLens', eyebrow: 'Document' })}${compactCard({ title: 'THC Grow Doc', text: 'Structure plant-health evidence and compare likely causes without pretending a single photo proves the answer.', href: '/thc-grow-doc/', label: 'Open Grow Doc', eyebrow: 'Diagnose' })}${compactCard({ title: 'THC Community', text: 'Discuss observations, education, grow-offs, project ideas, and testing with the community.', href: '/community/', label: 'Open Community', eyebrow: 'Connect' })}</div></div></section>
</div>`;

const brand = await ensureBrandMedia();
const settingsResult = await applySiteIcon(brand);
const presentationTargets = await rebuildHeaderFooter(brand);
await updatePage(home, homeHtml, 'DTF Genetics | Dream the Future');
await updatePage(learn, learnHtml, 'Teaching Healthy Cultivation');

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  backupDir,
  mediaCount: media.length,
  brandMediaId: brand?.id || null,
  brandMediaUrl: brand?.source_url || null,
  settingsResult,
  presentationTargets,
  topicRoutes: routes,
  selectedMedia: Object.fromEntries(Object.entries(picks).map(([key, value]) => [key, value ? { id: value.id, title: plain(rendered(value.title)), url: value.source_url } : null])),
  missingSelections: missing,
  updatedPages: [{ id: home.id, slug: home.slug }, { id: learn.id, slug: learn.slug }]
};
await writeFile(join(backupDir, 'visual-rebuild-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'visual-rebuild-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
