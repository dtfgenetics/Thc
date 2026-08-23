import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_VISUAL_POLISH || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-visual-polish-v3';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Visual-Polish/3.0'
};
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `visual-polish-v3-${stamp}`);
await mkdir(backupDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rendered(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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
      if (!response.ok) {
        throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      }
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

async function getPage(slug) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected one page for ${slug}; found ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

function stripStyle(content, id) {
  const pattern = new RegExp(`<style\\s+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/style>`, 'gi');
  return String(content || '').replace(pattern, '').trimStart();
}

const palette = {
  forest: '#07170f',
  forest2: '#0b2417',
  forest3: '#123622',
  leaf: '#26784a',
  mint: '#dceee2',
  brass: '#d7b965',
  brassSoft: '#eadcaa',
  cream: '#f6f2e8',
  paper: '#fffdf7',
  ink: '#112b1c',
  muted: '#5f7065',
  line: '#d8e1d8'
};

const polishCss = `<style id="dtf-visual-polish-v3">
:root{--dtf-v3-forest:${palette.forest};--dtf-v3-forest2:${palette.forest2};--dtf-v3-forest3:${palette.forest3};--dtf-v3-leaf:${palette.leaf};--dtf-v3-brass:${palette.brass};--dtf-v3-cream:${palette.cream};--dtf-v3-paper:${palette.paper};--dtf-v3-ink:${palette.ink};--dtf-v3-muted:${palette.muted};--dtf-v3-line:${palette.line}}
html{scroll-behavior:smooth}
body{background:var(--dtf-v3-cream)}
.dtf-page{background:linear-gradient(180deg,#f8f5ed 0%,#f3f0e8 100%)!important;color:var(--dtf-v3-ink)!important}
.dtf-wrap{width:min(1260px,calc(100% - 42px))!important}
.dtf-section{padding:clamp(62px,8vw,104px) 0!important;position:relative}
.dtf-section+.dtf-section{border-top:1px solid rgba(17,43,28,.07)}
.dtf-section-dark{background:radial-gradient(circle at 15% 10%,rgba(215,185,101,.11),transparent 30%),linear-gradient(145deg,var(--dtf-v3-forest),var(--dtf-v3-forest2) 58%,#143a25)!important}
.dtf-section-soft{background:linear-gradient(180deg,#edf3ec 0%,#f6f2e8 100%)!important}
.dtf-hero{isolation:isolate;min-height:min(760px,78vh);display:grid;align-items:center;padding:clamp(72px,9vw,122px) 0 clamp(82px,9vw,112px)!important;background:radial-gradient(circle at 78% 15%,rgba(215,185,101,.27),transparent 27%),radial-gradient(circle at 12% 88%,rgba(62,133,83,.22),transparent 32%),linear-gradient(135deg,#06140d 0%,#0b2517 54%,#103520 100%)!important;overflow:hidden}
.dtf-hero:before{content:"";position:absolute;inset:0;z-index:-1;opacity:.17;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,black,transparent 90%)}
.dtf-hero:after{content:"";position:absolute;width:460px;height:460px;border:1px solid rgba(234,220,170,.23);border-radius:50%;right:-170px;top:-170px;box-shadow:0 0 0 70px rgba(234,220,170,.035),0 0 0 140px rgba(234,220,170,.02);z-index:-1}
.dtf-hero-grid{grid-template-columns:minmax(0,1.1fr) minmax(340px,.9fr)!important;gap:clamp(36px,6vw,78px)!important}
.dtf-kicker,.dtf-eyebrow{color:var(--dtf-v3-brass)!important;letter-spacing:.16em!important;font-size:.73rem!important}
.dtf-hero h1{font-size:clamp(3.15rem,6.7vw,6.65rem)!important;line-height:.89!important;letter-spacing:-.058em!important;text-wrap:balance;text-shadow:0 1px 0 rgba(255,255,255,.04)}
.dtf-hero .dtf-lede{font-size:clamp(1.06rem,1.5vw,1.24rem)!important;line-height:1.78!important;max-width:720px!important;color:#d8e8dd!important}
.dtf-actions{gap:12px!important;margin-top:30px!important}
.dtf-btn{min-height:49px!important;padding:12px 20px!important;border-radius:14px!important;font-weight:900!important;letter-spacing:-.01em!important;box-shadow:none!important;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease!important}
.dtf-btn:hover{transform:translateY(-2px)!important;box-shadow:0 14px 30px rgba(5,30,16,.15)!important}
.dtf-btn-primary{background:linear-gradient(180deg,#e0c575,var(--dtf-v3-brass))!important;border-color:#e4ca7d!important;color:#102415!important}
.dtf-btn-secondary{backdrop-filter:blur(8px);background:rgba(255,255,255,.075)!important;border-color:rgba(255,255,255,.27)!important}
.dtf-hero-media{filter:drop-shadow(0 30px 45px rgba(0,0,0,.25))}
.dtf-hero-media:before{inset:-22px 28px 28px -22px!important;border-color:rgba(234,220,170,.55)!important;border-radius:34px!important}
.dtf-hero-media:after{content:"PLANT SCIENCE • GENETICS • FIELD NOTES";position:absolute;z-index:3;right:-12px;bottom:22px;padding:9px 12px;border-radius:999px;background:rgba(7,23,15,.82);border:1px solid rgba(234,220,170,.36);backdrop-filter:blur(9px);color:#f3e5b5;font-weight:800;font-size:.62rem;letter-spacing:.11em}
.dtf-img{border-radius:24px!important;border:1px solid rgba(255,255,255,.18);box-shadow:0 28px 58px rgba(3,26,13,.19)!important;transition:transform .35s ease,filter .35s ease!important}
.dtf-card:hover .dtf-img{transform:scale(1.025);filter:saturate(1.04) contrast(1.02)}
.dtf-quickbar{margin-top:-34px!important;z-index:8!important}
.dtf-quickgrid{padding:10px!important;gap:7px!important;border-radius:18px!important;background:rgba(255,253,247,.9)!important;backdrop-filter:blur(16px);border-color:rgba(17,43,28,.1)!important;box-shadow:0 22px 52px rgba(17,43,28,.14)!important}
.dtf-quickgrid a{padding:15px 12px!important;border-radius:12px!important;background:transparent!important;position:relative}
.dtf-quickgrid a+a:before{content:"";position:absolute;left:-4px;top:24%;height:52%;width:1px;background:rgba(17,43,28,.1)}
.dtf-quickgrid a:hover{background:#edf3ec!important;transform:translateY(-1px)}
.dtf-heading{margin-bottom:34px!important;gap:38px!important}
.dtf-heading h2{font-size:clamp(2.35rem,4.4vw,4.25rem)!important;line-height:.96!important;letter-spacing:-.052em!important;text-wrap:balance}
.dtf-heading>p{font-size:1.01rem;line-height:1.75!important}
.dtf-grid-2,.dtf-grid-3,.dtf-grid-4,.dtf-grid-5{gap:20px!important}
.dtf-card{border-radius:22px!important;border:1px solid rgba(17,43,28,.11)!important;background:rgba(255,253,247,.94)!important;box-shadow:0 12px 34px rgba(17,43,28,.065)!important;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease!important;transform:translateZ(0)}
.dtf-card:hover{transform:translateY(-5px);box-shadow:0 24px 48px rgba(17,43,28,.12)!important;border-color:rgba(38,120,74,.27)!important}
.dtf-image-card{display:flex;flex-direction:column;height:100%}
.dtf-image-card>.dtf-img{border:0!important;border-bottom:1px solid rgba(17,43,28,.07)!important;border-radius:0!important;box-shadow:none!important}
.dtf-card-copy,.dtf-compact-card{padding:25px!important}
.dtf-card h3{font-size:clamp(1.2rem,1.8vw,1.48rem)!important;letter-spacing:-.025em!important}
.dtf-card p:not(.dtf-eyebrow){color:var(--dtf-v3-muted)!important}
.dtf-text-link{color:var(--dtf-v3-leaf)!important;gap:5px;align-items:center}
.dtf-text-link span{transition:transform .18s ease}.dtf-text-link:hover span{transform:translateX(3px)}
.dtf-section-dark .dtf-card{background:linear-gradient(180deg,rgba(25,63,40,.96),rgba(15,47,29,.96))!important;border-color:rgba(255,255,255,.12)!important}
.dtf-section-dark .dtf-card:hover{border-color:rgba(215,185,101,.38)!important;box-shadow:0 24px 54px rgba(0,0,0,.18)!important}
.dtf-section-dark .dtf-card p:not(.dtf-eyebrow){color:#c6d8cb!important}
.dtf-section-dark .dtf-text-link{color:#edd68d!important}
.dtf-stats{gap:10px!important;margin-top:32px!important}
.dtf-stat{padding:18px 20px!important;border-radius:15px!important;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035))!important}
.dtf-stat strong{font-size:2rem!important;color:#ead17f!important}.dtf-stat span{font-size:.82rem!important;letter-spacing:.02em}
.dtf-flow{gap:16px!important}
.dtf-flow article{border-radius:20px!important;padding:27px!important;box-shadow:0 8px 24px rgba(17,43,28,.05)}
.dtf-flow article:before{width:40px!important;height:40px!important;background:linear-gradient(180deg,var(--dtf-v3-forest3),var(--dtf-v3-forest))!important;color:#efd786!important;box-shadow:0 8px 22px rgba(7,23,15,.14)}
.dtf-callout{gap:clamp(32px,6vw,72px)!important}.dtf-callout h2{font-size:clamp(2.5rem,5vw,4.8rem)!important;line-height:.95!important}
.dtf-path-card{border-radius:20px!important;border-color:rgba(17,43,28,.1)!important;box-shadow:0 10px 28px rgba(17,43,28,.05);transition:transform .2s ease,box-shadow .2s ease}.dtf-path-card:hover{transform:translateY(-4px);box-shadow:0 20px 38px rgba(17,43,28,.1)}
.dtf-link-cluster a{background:#e8f0e8!important;border:1px solid rgba(17,43,28,.07)}
.dtf-v3-spotlight{padding:30px 0 8px}.dtf-v3-spotlight-grid{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:14px}.dtf-v3-spotlight article{min-height:210px;border-radius:24px;padding:28px;background:linear-gradient(135deg,#0a2316,#163c27);color:white;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}.dtf-v3-spotlight article:after{content:"";position:absolute;inset:auto -30px -70px auto;width:180px;height:180px;border-radius:50%;border:1px solid rgba(215,185,101,.3);box-shadow:0 0 0 32px rgba(215,185,101,.05)}.dtf-v3-spotlight article:nth-child(2){background:linear-gradient(145deg,#eff4ed,#dfeade);color:var(--dtf-v3-ink)}.dtf-v3-spotlight article:nth-child(3){background:linear-gradient(145deg,#f2e7c7,#e1c97f);color:#182718}.dtf-v3-spotlight h3{margin:0 0 7px;font-size:1.35rem}.dtf-v3-spotlight p{margin:0;max-width:46ch;line-height:1.6;opacity:.82}.dtf-v3-spotlight a{color:inherit!important;text-decoration:none!important}.dtf-v3-spotlight .dtf-v3-label{font-size:.67rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#e8ce7d;margin-bottom:12px}.dtf-v3-spotlight article:nth-child(n+2) .dtf-v3-label{color:#416c4e}
@media(min-width:981px){.dtf-grid-3>.dtf-card:nth-child(3n+1){transform:translateY(-4px)}.dtf-grid-3>.dtf-card:nth-child(3n+1):hover{transform:translateY(-9px)}.dtf-section:nth-of-type(even):not(.dtf-section-dark):not(.dtf-section-soft){background:rgba(255,253,247,.48)}}
@media(max-width:980px){.dtf-hero{min-height:auto}.dtf-hero-grid{grid-template-columns:1fr!important}.dtf-hero-media{max-width:760px}.dtf-v3-spotlight-grid{grid-template-columns:1fr 1fr}.dtf-v3-spotlight article:first-child{grid-column:1/-1}.dtf-quickgrid a+a:before{display:none}}
@media(max-width:720px){.dtf-wrap{width:min(100% - 28px,1260px)!important}.dtf-section{padding:58px 0!important}.dtf-hero{padding:62px 0 58px!important}.dtf-hero h1{font-size:clamp(2.75rem,14vw,4.55rem)!important}.dtf-hero-media:after{right:8px;bottom:10px;font-size:.52rem}.dtf-quickbar{margin-top:0!important;padding-top:12px}.dtf-quickgrid{grid-template-columns:1fr 1fr!important}.dtf-quickgrid a:last-child:nth-child(odd){grid-column:1/-1}.dtf-v3-spotlight-grid{grid-template-columns:1fr}.dtf-v3-spotlight article:first-child{grid-column:auto}.dtf-btn{width:100%}.dtf-heading h2{font-size:clamp(2.25rem,11vw,3.35rem)!important}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.dtf-btn,.dtf-card,.dtf-img,.dtf-text-link span,.dtf-path-card{transition:none!important}.dtf-btn:hover,.dtf-card:hover,.dtf-card:hover .dtf-img,.dtf-path-card:hover{transform:none!important}}
</style>`;

const shellCss = `<style id="dtf-shell-v3">
.dtf-shell-header{position:sticky;top:0;z-index:1000;background:rgba(7,23,15,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.11);box-shadow:0 10px 34px rgba(0,0,0,.08)}
.dtf-shell-inner{max-width:1260px;margin:auto;padding:11px 22px;display:flex;align-items:center;justify-content:space-between;gap:22px}
.dtf-shell-brand{display:flex;align-items:center;gap:11px;color:white!important;text-decoration:none!important;min-width:max-content}.dtf-shell-brand img{width:42px;height:42px;object-fit:contain;filter:drop-shadow(0 5px 12px rgba(0,0,0,.18))}.dtf-shell-brand strong{display:block;font-size:1rem;line-height:1}.dtf-shell-brand small{display:block;margin-top:4px;color:#d7b965;font-size:.6rem;line-height:1;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
.dtf-shell-nav{display:flex;align-items:center;gap:2px}.dtf-shell-nav a{color:#dfebe2!important;text-decoration:none!important;padding:9px 10px;border-radius:9px;font-size:.92rem;font-weight:790}.dtf-shell-nav a:hover{background:rgba(255,255,255,.07);color:white!important}.dtf-shell-nav .dtf-shell-shop{background:#d7b965!important;color:#112619!important;padding-inline:15px;margin-left:5px;font-weight:950}.dtf-shell-menu{display:none}.dtf-shell-menu summary{list-style:none;cursor:pointer;color:white;border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:9px 12px;font-weight:850}.dtf-shell-menu summary::-webkit-details-marker{display:none}.dtf-shell-mobile{position:absolute;right:16px;top:66px;width:min(330px,calc(100vw - 32px));padding:10px;background:#0b2417;border:1px solid rgba(255,255,255,.13);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3)}.dtf-shell-mobile a{display:block;color:#e5eee8!important;text-decoration:none!important;padding:12px;border-radius:10px;font-weight:800}.dtf-shell-mobile a:hover{background:rgba(255,255,255,.08)}
.dtf-shell-footer{background:#07170f;color:#c7d8cc}.dtf-shell-footer-inner{max-width:1260px;margin:auto;padding:58px 22px 32px}.dtf-shell-footer-grid{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:42px}.dtf-shell-footer h3{margin:0 0 13px;color:white;font-size:1rem}.dtf-shell-footer p{line-height:1.7;color:#aec4b5}.dtf-shell-footer a{color:#dbe8df!important;text-decoration:none!important}.dtf-shell-footer a:hover{color:#eed786!important}.dtf-shell-footer-links{display:grid;gap:8px}.dtf-shell-legal{margin-top:38px;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);display:flex;gap:14px;justify-content:space-between;flex-wrap:wrap;font-size:.82rem;color:#8fa899}
@media(max-width:880px){.dtf-shell-nav{display:none}.dtf-shell-menu{display:block}.dtf-shell-footer-grid{grid-template-columns:1fr 1fr}.dtf-shell-footer-grid>div:first-child{grid-column:1/-1}}
@media(max-width:560px){.dtf-shell-inner{padding:10px 14px}.dtf-shell-brand img{width:38px;height:38px}.dtf-shell-footer-grid{grid-template-columns:1fr}.dtf-shell-footer-grid>div:first-child{grid-column:auto}}
</style>`;

function spotlightMarkup() {
  return `<section class="dtf-v3-spotlight" aria-label="DTF primary experiences"><div class="dtf-wrap"><div class="dtf-v3-spotlight-grid"><article><p class="dtf-v3-label">Genetics</p><h3><a href="/seeds/">Breeding projects with documented lineage</a></h3><p>Start with genetics, then move into the science and records behind the plant.</p></article><article><p class="dtf-v3-label">Tools</p><h3><a href="/tools/">Measure. Diagnose. Document.</a></h3><p>GrowLens and Grow Doc turn observations into usable records.</p></article><article><p class="dtf-v3-label">Play</p><h3><a href="/games/">Original DTF games</a></h3><p>Strategy, trivia, puzzles, and community-built browser experiences.</p></article></div></div></section>`;
}

function polishPage(content, { home = false } = {}) {
  let next = stripStyle(rendered(content), 'dtf-visual-polish-v3');
  if (home) {
    next = next.replace(/<section class="dtf-v3-spotlight"[\s\S]*?<\/section>/i, '');
    const quickbarEnd = next.indexOf('</nav></div>');
    if (quickbarEnd !== -1) {
      const insertAt = quickbarEnd + '</nav></div>'.length;
      next = `${next.slice(0, insertAt)}\n${spotlightMarkup()}${next.slice(insertAt)}`;
    } else {
      const heroEnd = next.indexOf('</section>');
      if (heroEnd !== -1) {
        const insertAt = heroEnd + '</section>'.length;
        next = `${next.slice(0, insertAt)}\n${spotlightMarkup()}${next.slice(insertAt)}`;
      }
    }
  }
  return `${polishCss}\n${next}`;
}

async function updatePage(page, content) {
  await writeFile(join(backupDir, `page-${page.id}-${page.slug}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
  if (!apply) return;
  await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    body: JSON.stringify({ content, status: 'publish' })
  });
}

async function fetchBrand() {
  const rows = await request('/wp-json/wp/v2/media?slug=dtf-potleaf-site-icon&context=edit&per_page=10');
  return Array.isArray(rows) ? rows.find((item) => item?.source_url) || null : null;
}

function shellMarkup(brandUrl) {
  const brandImage = brandUrl
    ? `<img src="${esc(brandUrl)}" alt="DTF Genetics cannabis leaf" width="42" height="42" loading="eager" decoding="async">`
    : '';
  const brand = `<a class="dtf-shell-brand" href="/" aria-label="DTF Genetics home">${brandImage}<span><strong>DTF Genetics</strong><small>Dream the Future</small></span></a>`;
  const links = `<a href="/seeds/">Genetics</a><a href="/learn/">Learn</a><a href="/tools/">Tools</a><a href="/games/">Games</a><a href="/community/">Community</a><a class="dtf-shell-shop" href="/shop/">Shop</a>`;
  const header = `<!-- wp:html -->${shellCss}<header class="dtf-shell-header"><div class="dtf-shell-inner">${brand}<nav class="dtf-shell-nav" aria-label="Primary navigation">${links}</nav><details class="dtf-shell-menu"><summary aria-label="Open site menu">Menu</summary><nav class="dtf-shell-mobile" aria-label="Mobile navigation">${links}</nav></details></div></header><!-- /wp:html -->`;
  const footer = `<!-- wp:html --><footer class="dtf-shell-footer"><div class="dtf-shell-footer-inner"><div class="dtf-shell-footer-grid"><div>${brand}<p>Documented genetics, Teaching Healthy Cultivation, practical grow tools, original games, and community projects in one home.</p></div><div><h3>Explore</h3><div class="dtf-shell-footer-links"><a href="/seeds/">Genetics</a><a href="/learn/">Learn</a><a href="/tools/">Tools</a><a href="/games/">Games</a><a href="/shop/">Shop</a></div></div><div><h3>Community</h3><div class="dtf-shell-footer-links"><a href="/community/">Community standards</a><a href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">Join Teaching Healthy Cultivation on Discord</a><a href="/about/">About DTF Genetics</a><a href="/contact/">Contact</a></div></div></div><div class="dtf-shell-legal"><span>© 2026 DTF Genetics. All rights reserved.</span><span>Dream the Future · Adults only · Follow applicable local laws.</span></div></div></footer><!-- /wp:html -->`;
  return { header, footer };
}

async function updateShell() {
  const [parts, brand] = await Promise.all([
    request('/wp-json/wp/v2/template-parts?context=edit&per_page=100'),
    fetchBrand()
  ]);
  await writeFile(join(backupDir, 'template-parts-before.json'), `${JSON.stringify(parts, null, 2)}\n`);
  const headerPart = (parts || []).find((item) => item.slug === 'header' && item.id);
  const footerPart = (parts || []).find((item) => item.slug === 'footer' && item.id);
  if (!headerPart?.id || !footerPart?.id) throw new Error('Active WordPress header/footer template parts were not found');
  const shell = shellMarkup(brand?.source_url || '');
  if (apply) {
    await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(headerPart.id)}`, { method: 'POST', body: JSON.stringify({ content: shell.header, status: 'publish' }) });
    await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(footerPart.id)}`, { method: 'POST', body: JSON.stringify({ content: shell.footer, status: 'publish' }) });
  }
  return { headerId: headerPart.id, footerId: footerPart.id, brandMediaId: brand?.id || null, brandUrl: brand?.source_url || null };
}

const [home, learn] = await Promise.all([getPage('home'), getPage('learn')]);
const nextHome = polishPage(home.content, { home: true });
const nextLearn = polishPage(learn.content, { home: false });

if (!nextHome.includes('dtf-visual-polish-v3')) throw new Error('Home polish style injection failed');
if (!nextLearn.includes('dtf-visual-polish-v3')) throw new Error('Learn polish style injection failed');
if (!nextHome.includes('dtf-v3-spotlight')) throw new Error('Home spotlight injection failed');

await updatePage(home, nextHome);
await updatePage(learn, nextLearn);
const shell = await updateShell();

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  backupDir,
  updatedPages: [
    { id: home.id, slug: home.slug, bytes: nextHome.length },
    { id: learn.id, slug: learn.slug, bytes: nextLearn.length }
  ],
  spotlightInjected: nextHome.includes('dtf-v3-spotlight'),
  shell
};

await writeFile(join(backupDir, 'visual-polish-v3-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'visual-polish-v3-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
