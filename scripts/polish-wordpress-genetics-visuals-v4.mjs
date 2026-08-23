import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_GENETICS_VISUALS || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-genetics-visual-v4';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Genetics-Visuals/4.0'
};
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `genetics-visual-v4-${stamp}`);
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
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
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

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function getPage(slug) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected one page for ${slug}; found ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

async function getBrand() {
  const rows = await request('/wp-json/wp/v2/media?search=DTF%20Genetics%20Cannabis%20Leaf&context=edit&per_page=100');
  const brand = Array.isArray(rows)
    ? rows.find((item) => item?.source_url && /dtf-potleaf-site-icon|dtf-potleaf-512/i.test(`${item.slug || ''} ${item.source_url || ''}`))
    : null;
  if (!brand?.id || !brand?.source_url) throw new Error('DTF cannabis-leaf brand media was not found');
  return brand;
}

function leaf(url, alt, className = 'dtf-gv4-leaf') {
  return `<img class="${esc(className)}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

function badge(text, tone = '') {
  return `<span class="dtf-gv4-badge ${tone ? `dtf-gv4-badge-${esc(tone)}` : ''}">${esc(text)}</span>`;
}

function releaseCard({ id, name, generation, seedType, lineage, summary, shopUrl, contextUrl = '#lineage-map', brandUrl, featured = false }) {
  return `<article class="dtf-gv4-release ${featured ? 'dtf-gv4-release-featured' : ''}" data-strain="${esc(id)}">
    <div class="dtf-gv4-release-art">
      <div class="dtf-gv4-orbit" aria-hidden="true"></div>
      ${leaf(brandUrl, '', 'dtf-gv4-release-leaf')}
      <span class="dtf-gv4-monogram" aria-hidden="true">${esc(name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2))}</span>
    </div>
    <div class="dtf-gv4-release-copy">
      <div class="dtf-gv4-badges">${badge(generation, 'gold')}${badge(seedType, 'green')}</div>
      <h3>${esc(name)}</h3>
      <p class="dtf-gv4-lineage">${esc(lineage)}</p>
      <p>${esc(summary)}</p>
      <div class="dtf-gv4-card-actions">
        <a class="dtf-gv4-btn dtf-gv4-btn-primary" href="${esc(shopUrl)}">View current listing</a>
        <a class="dtf-gv4-text-link" href="${esc(contextUrl)}">Breeding context <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </article>`;
}

const css = `<style id="dtf-genetics-visual-v4">
:root{--gv4-deep:#06170e;--gv4-forest:#0c2a19;--gv4-green:#1f7543;--gv4-green2:#2c8d52;--gv4-gold:#d7b961;--gv4-gold2:#ead58c;--gv4-paper:#fffdf7;--gv4-cream:#f5f1e7;--gv4-ink:#122c1c;--gv4-muted:#5b6e61;--gv4-line:#d8e3da;--gv4-blue:#244f73;--gv4-blue2:#78aeca;--gv4-purple:#5f436f;--gv4-purple2:#b08ec0}
.dtf-gv4{background:linear-gradient(180deg,#f8f5ed,var(--gv4-cream));color:var(--gv4-ink);overflow:hidden}
.dtf-gv4 *{box-sizing:border-box}.dtf-gv4-wrap{width:min(1260px,calc(100% - 42px));margin:0 auto}
.dtf-gv4-hero{position:relative;padding:clamp(76px,10vw,132px) 0 80px;background:radial-gradient(circle at 82% 16%,rgba(215,185,97,.25),transparent 28%),radial-gradient(circle at 12% 90%,rgba(44,141,82,.22),transparent 34%),linear-gradient(135deg,#05120b,#0b2718 58%,#123d25);color:#fff;overflow:hidden}
.dtf-gv4-hero:after{content:"";position:absolute;right:-130px;top:-150px;width:470px;height:470px;border-radius:50%;border:1px solid rgba(234,213,140,.26);box-shadow:0 0 0 70px rgba(234,213,140,.04),0 0 0 140px rgba(234,213,140,.018)}
.dtf-gv4-hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(330px,.95fr);gap:clamp(38px,7vw,88px);align-items:center;position:relative;z-index:1}
.dtf-gv4-kicker{margin:0 0 12px;color:var(--gv4-gold2);font-size:.74rem;font-weight:950;letter-spacing:.17em;text-transform:uppercase}
.dtf-gv4 h1{margin:0;font-size:clamp(3.15rem,7vw,6.7rem);line-height:.89;letter-spacing:-.058em;text-wrap:balance}.dtf-gv4-hero p:not(.dtf-gv4-kicker){max-width:760px;font-size:clamp(1.05rem,1.5vw,1.22rem);line-height:1.78;color:#d7e5dc}
.dtf-gv4-hero-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:28px}.dtf-gv4-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 19px;border-radius:13px;text-decoration:none!important;font-weight:900;border:1px solid transparent;transition:transform .18s ease,box-shadow .18s ease}.dtf-gv4-btn:hover{transform:translateY(-2px)}.dtf-gv4-btn-primary{background:linear-gradient(180deg,#e3c979,var(--gv4-gold));color:#102316!important;border-color:#e3c979}.dtf-gv4-btn-secondary{background:rgba(255,255,255,.07);color:#fff!important;border-color:rgba(255,255,255,.26)}
.dtf-gv4-hero-emblem{min-height:420px;position:relative;display:grid;place-items:center}.dtf-gv4-hero-emblem:before,.dtf-gv4-hero-emblem:after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(234,213,140,.33)}.dtf-gv4-hero-emblem:before{width:360px;height:360px}.dtf-gv4-hero-emblem:after{width:270px;height:270px;border-style:dashed;animation:dtf-gv4-spin 28s linear infinite}.dtf-gv4-hero-leaf{position:relative;z-index:2;width:min(220px,55%);height:auto;filter:drop-shadow(0 26px 28px rgba(0,0,0,.28))}.dtf-gv4-hero-tag{position:absolute;bottom:38px;z-index:3;padding:9px 13px;border:1px solid rgba(234,213,140,.35);border-radius:999px;background:rgba(5,18,11,.7);backdrop-filter:blur(9px);color:#eedc9e;font-size:.68rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.dtf-gv4-section{padding:clamp(64px,8vw,96px) 0}.dtf-gv4-section-dark{background:radial-gradient(circle at 15% 15%,rgba(215,185,97,.11),transparent 28%),linear-gradient(145deg,var(--gv4-deep),var(--gv4-forest));color:#fff}.dtf-gv4-heading{display:flex;align-items:end;justify-content:space-between;gap:34px;margin-bottom:30px}.dtf-gv4-heading>div{max-width:760px}.dtf-gv4-heading h2{margin:0;font-size:clamp(2.35rem,4.6vw,4.2rem);line-height:.97;letter-spacing:-.05em}.dtf-gv4-heading>p{max-width:520px;margin:0;color:var(--gv4-muted);line-height:1.72}.dtf-gv4-section-dark .dtf-gv4-heading>p{color:#c7d9cd}
.dtf-gv4-release-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.dtf-gv4-release{background:rgba(255,253,247,.97);border:1px solid rgba(18,44,28,.11);border-radius:26px;overflow:hidden;box-shadow:0 14px 38px rgba(14,52,29,.07);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.dtf-gv4-release:hover{transform:translateY(-5px);box-shadow:0 26px 54px rgba(14,52,29,.13);border-color:rgba(31,117,67,.28)}
.dtf-gv4-release-art{height:240px;position:relative;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 68% 30%,rgba(255,255,255,.24),transparent 22%),linear-gradient(135deg,#183c57,var(--gv4-blue),#6f9eb7)}.dtf-gv4-release[data-strain="blue-bubblegum"] .dtf-gv4-release-art{background:radial-gradient(circle at 70% 28%,rgba(255,255,255,.23),transparent 22%),linear-gradient(135deg,#342a45,var(--gv4-purple),#9976a8)}.dtf-gv4-release[data-strain="blue-mango-fem"] .dtf-gv4-release-art{background:radial-gradient(circle at 72% 30%,rgba(255,255,255,.25),transparent 22%),linear-gradient(135deg,#22485b,#3f7288,#c39b45)}
.dtf-gv4-release-art:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:34px 34px}.dtf-gv4-orbit{position:absolute;width:190px;height:190px;border-radius:50%;border:1px solid rgba(255,255,255,.36);box-shadow:0 0 0 36px rgba(255,255,255,.045)}.dtf-gv4-release-leaf{position:relative;z-index:2;width:105px;height:105px;object-fit:contain;filter:brightness(0) invert(1) drop-shadow(0 14px 16px rgba(0,0,0,.18));opacity:.92}.dtf-gv4-monogram{position:absolute;right:18px;bottom:9px;z-index:2;font-size:4.5rem;font-weight:950;line-height:1;color:rgba(255,255,255,.15);letter-spacing:-.07em}.dtf-gv4-release-copy{padding:25px}.dtf-gv4-badges{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:13px}.dtf-gv4-badge{display:inline-flex;align-items:center;min-height:27px;padding:5px 9px;border-radius:999px;font-size:.67rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.dtf-gv4-badge-gold{background:#f0e3b3;color:#4b3a08;border:1px solid #e0ca78}.dtf-gv4-badge-green{background:#e4f0e7;color:#174e2b;border:1px solid #bdd5c3}.dtf-gv4-release h3{margin:0 0 7px;font-size:1.55rem;line-height:1.1;letter-spacing:-.035em}.dtf-gv4-release-copy>p:not(.dtf-gv4-lineage){margin:0;color:var(--gv4-muted);line-height:1.67}.dtf-gv4-lineage{margin:0 0 13px;color:#27583a;font-weight:850;line-height:1.5}.dtf-gv4-card-actions{display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-top:20px}.dtf-gv4-text-link{color:var(--gv4-green)!important;font-weight:900;text-decoration:none!important}.dtf-gv4-text-link:hover{text-decoration:underline!important}
.dtf-gv4-lineage-map{display:grid;grid-template-columns:1fr auto 1fr auto 1.15fr;gap:14px;align-items:center}.dtf-gv4-node{min-height:150px;padding:22px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);display:flex;flex-direction:column;justify-content:center}.dtf-gv4-node small{color:#d9c77e;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.dtf-gv4-node strong{display:block;margin-top:8px;font-size:1.35rem}.dtf-gv4-node span{margin-top:7px;color:#bfd3c5;line-height:1.55}.dtf-gv4-arrow{color:#e6ce7d;font-size:2rem;font-weight:900}.dtf-gv4-node-result{background:linear-gradient(145deg,rgba(41,119,72,.5),rgba(255,255,255,.065));border-color:rgba(215,185,97,.35)}
.dtf-gv4-project-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.dtf-gv4-project{padding:24px;border:1px solid var(--gv4-line);border-radius:22px;background:var(--gv4-paper);box-shadow:0 10px 30px rgba(17,43,28,.055)}.dtf-gv4-project small{color:var(--gv4-green);font-weight:950;letter-spacing:.1em;text-transform:uppercase}.dtf-gv4-project h3{margin:9px 0 7px;font-size:1.35rem}.dtf-gv4-project p{margin:0;color:var(--gv4-muted);line-height:1.68}.dtf-gv4-standard{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:center}.dtf-gv4-standard-card{padding:30px;border-radius:26px;background:linear-gradient(145deg,#e8f0e8,#f7f3e9);border:1px solid #cedbcf}.dtf-gv4-standard-card h2{margin:0 0 12px;font-size:clamp(2.1rem,4vw,3.5rem);letter-spacing:-.045em}.dtf-gv4-standard-card p{color:var(--gv4-muted);line-height:1.75}.dtf-gv4-standard-list{margin:0;padding:0;list-style:none;display:grid;gap:10px}.dtf-gv4-standard-list li{padding:16px 17px;border-radius:16px;background:#fff;border:1px solid var(--gv4-line);font-weight:800;color:#294b34}
@keyframes dtf-gv4-spin{to{transform:rotate(360deg)}}
@media(max-width:980px){.dtf-gv4-hero-grid,.dtf-gv4-standard{grid-template-columns:1fr}.dtf-gv4-hero-emblem{min-height:330px}.dtf-gv4-release-grid,.dtf-gv4-project-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-gv4-lineage-map{grid-template-columns:1fr}.dtf-gv4-arrow{transform:rotate(90deg);justify-self:center}.dtf-gv4-heading{align-items:start;flex-direction:column}}
@media(max-width:660px){.dtf-gv4-wrap{width:min(100% - 28px,1260px)}.dtf-gv4 h1{font-size:clamp(2.8rem,15vw,4.4rem)}.dtf-gv4-release-grid,.dtf-gv4-project-grid{grid-template-columns:1fr}.dtf-gv4-release-art{height:210px}.dtf-gv4-hero-emblem{min-height:275px}.dtf-gv4-hero-emblem:before{width:270px;height:270px}.dtf-gv4-hero-emblem:after{width:205px;height:205px}.dtf-gv4-hero-leaf{width:145px}.dtf-gv4-hero-tag{bottom:15px}.dtf-gv4-section{padding:58px 0}.dtf-gv4-heading h2{font-size:2.55rem}}
@media(prefers-reduced-motion:reduce){.dtf-gv4 *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
</style>`;

const [seeds, brand] = await Promise.all([getPage('seeds'), getBrand()]);
await writeFile(join(backupDir, `page-${seeds.id}-seeds-before.json`), `${JSON.stringify(seeds, null, 2)}\n`);

const releases = [
  {
    id: 'blue-mango-regular',
    name: 'Blue Mango',
    generation: 'F2',
    seedType: 'Regular',
    lineage: 'Somango XXL × Blueberry Butcher',
    summary: 'DTF flagship breeding project selected around vigor, branching, resin production, substantial flower structure, and a blueberry-meets-ripe-mango aromatic direction.',
    shopUrl: '/product/10-regular-f2-blue-mango-seeds/',
    brandUrl: brand.source_url,
    featured: true
  },
  {
    id: 'blue-mango-fem',
    name: 'Blue Mango',
    generation: 'F2',
    seedType: 'Feminized',
    lineage: 'Somango XXL × Blueberry Butcher',
    summary: 'The feminized F2 release belongs to the same Blue Mango breeding project. Exact pack, price, inventory, and transaction details stay on the live product route.',
    shopUrl: '/product/10-feminized-f2-blue-mango-x/',
    brandUrl: brand.source_url
  },
  {
    id: 'blue-bubblegum',
    name: 'Blue Bubblegum',
    generation: 'F1',
    seedType: 'Regular',
    lineage: 'Bubblegum Kush × Blueberry Butcher',
    summary: 'A sweet fruit-and-bubblegum breeding direction and a documented parent line used in the Mango Bubbles project.',
    shopUrl: '/product/10-reg-f1-blueberry-bubblegum/',
    brandUrl: brand.source_url
  }
];

const html = `${css}<main class="dtf-gv4" data-dtf-visual="dtf-genetics-visual-v4">
<section class="dtf-gv4-hero">
  <div class="dtf-gv4-wrap dtf-gv4-hero-grid">
    <div>
      <p class="dtf-gv4-kicker">DTF Genetics · Dream the Future</p>
      <h1>Genetics with a documented story.</h1>
      <p>Explore current releases, parentage, generation context, and the breeding projects connecting DTF lines. The genetics catalog explains the project; the live product listing controls current transaction details.</p>
      <div class="dtf-gv4-hero-actions">
        <a class="dtf-gv4-btn dtf-gv4-btn-primary" href="#current-releases">Current releases</a>
        <a class="dtf-gv4-btn dtf-gv4-btn-secondary" href="#lineage-map">View lineage map</a>
        <a class="dtf-gv4-btn dtf-gv4-btn-secondary" href="/learn/genetics-breeding/">Learn genetics</a>
      </div>
    </div>
    <div class="dtf-gv4-hero-emblem">
      ${leaf(brand.source_url, 'DTF Genetics cannabis leaf', 'dtf-gv4-hero-leaf')}
      <span class="dtf-gv4-hero-tag">Documented breeding · current releases</span>
    </div>
  </div>
</section>

<section id="current-releases" class="dtf-gv4-section">
  <div class="dtf-gv4-wrap">
    <div class="dtf-gv4-heading">
      <div><p class="dtf-gv4-kicker">Available routes</p><h2>Current DTF releases</h2></div>
      <p>Each card separates project identity from transaction data. Use the linked WooCommerce page for current price, stock, pack quantity, shipping eligibility, and checkout terms.</p>
    </div>
    <div class="dtf-gv4-release-grid">${releases.map(releaseCard).join('\n')}</div>
  </div>
</section>

<section id="lineage-map" class="dtf-gv4-section dtf-gv4-section-dark">
  <div class="dtf-gv4-wrap">
    <div class="dtf-gv4-heading">
      <div><p class="dtf-gv4-kicker">Breeding relationships</p><h2>See how the lines connect.</h2></div>
      <p>Parentage and project relationships are shown as documented breeding context, not as a guarantee of phenotype, potency, yield, aroma, or finish time.</p>
    </div>
    <div class="dtf-gv4-lineage-map">
      <article class="dtf-gv4-node"><small>Parent</small><strong>Somango XXL</strong><span>Blue Mango parent.</span></article>
      <div class="dtf-gv4-arrow" aria-hidden="true">+</div>
      <article class="dtf-gv4-node"><small>Parent</small><strong>Blueberry Butcher</strong><span>Blueberry Muffin × Jack Herer.</span></article>
      <div class="dtf-gv4-arrow" aria-hidden="true">→</div>
      <article class="dtf-gv4-node dtf-gv4-node-result"><small>DTF line</small><strong>Blue Mango</strong><span>Somango XXL × Blueberry Butcher.</span></article>
    </div>
    <div class="dtf-gv4-lineage-map" style="margin-top:16px">
      <article class="dtf-gv4-node"><small>DTF line</small><strong>Blue Mango</strong><span>Flagship fruit-forward breeding project.</span></article>
      <div class="dtf-gv4-arrow" aria-hidden="true">+</div>
      <article class="dtf-gv4-node"><small>DTF line</small><strong>Blue Bubblegum</strong><span>Bubblegum Kush × Blueberry Butcher.</span></article>
      <div class="dtf-gv4-arrow" aria-hidden="true">→</div>
      <article class="dtf-gv4-node dtf-gv4-node-result"><small>Active breeding project</small><strong>Mango Bubbles</strong><span>Blue Mango × Blue Bubblegum.</span></article>
    </div>
  </div>
</section>

<section class="dtf-gv4-section">
  <div class="dtf-gv4-wrap">
    <div class="dtf-gv4-heading">
      <div><p class="dtf-gv4-kicker">Breeding library</p><h2>Projects beyond the shelf.</h2></div>
      <p>A breeding profile can exist without a current retail listing. This keeps the genetics library useful without implying that every documented project is for sale.</p>
    </div>
    <div class="dtf-gv4-project-grid">
      <article class="dtf-gv4-project"><small>Flagship line</small><h3>Blue Mango</h3><p><strong>Somango XXL × Blueberry Butcher.</strong> Multi-generation DTF project with an 8–10 week planning window commonly used in project documentation; individual plants and environments can vary.</p></article>
      <article class="dtf-gv4-project"><small>Active breeding project</small><h3>Mango Bubbles</h3><p><strong>Blue Mango × Blue Bubblegum.</strong> Combines the fruit-forward Blue Mango direction with the sweet bubblegum influence of Blue Bubblegum.</p></article>
      <article class="dtf-gv4-project"><small>Parent line</small><h3>Blueberry Butcher</h3><p><strong>Blueberry Muffin × Jack Herer.</strong> A documented parent contributing to both Blue Mango and Blue Bubblegum.</p></article>
    </div>
  </div>
</section>

<section class="dtf-gv4-section">
  <div class="dtf-gv4-wrap dtf-gv4-standard">
    <div class="dtf-gv4-standard-card">
      <p class="dtf-gv4-kicker">DTF catalog standard</p>
      <h2>Observation over hype.</h2>
      <p>DTF genetics pages distinguish lineage, generation, seed type, breeding direction, and transaction facts. Traits are described as project observations or selection direction rather than guaranteed outcomes.</p>
      <div class="dtf-gv4-hero-actions">
        <a class="dtf-gv4-btn dtf-gv4-btn-primary" href="/shop/">Open the shop</a>
        <a class="dtf-gv4-btn" style="background:#fff;color:#173c25!important;border-color:#bfd0c3" href="/tools/">Document your grow</a>
      </div>
    </div>
    <ul class="dtf-gv4-standard-list">
      <li>Lineage and generation shown clearly.</li>
      <li>Regular vs. feminized identified at a glance.</li>
      <li>Current transaction details stay on WooCommerce.</li>
      <li>Breeding profiles do not imply current retail availability.</li>
      <li>Phenotype, yield, potency, aroma, and finish time are not presented as guarantees.</li>
    </ul>
  </div>
</section>
</main>`;

if (!html.includes('dtf-genetics-visual-v4')) throw new Error('Genetics visual marker missing');
if (!html.includes('/product/10-regular-f2-blue-mango-seeds/')) throw new Error('Blue Mango regular route missing');
if (!html.includes('/product/10-feminized-f2-blue-mango-x/')) throw new Error('Blue Mango feminized route missing');
if (!html.includes('/product/10-reg-f1-blueberry-bubblegum/')) throw new Error('Blue Bubblegum route missing');

if (apply) {
  await request(`/wp-json/wp/v2/pages/${seeds.id}`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'DTF Genetics | Seeds & Breeding Projects',
      content: html,
      featured_media: Number(brand.id),
      status: 'publish'
    })
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  backupDir,
  pageId: seeds.id,
  brandMediaId: Number(brand.id),
  releaseCount: releases.length,
  marker: 'dtf-genetics-visual-v4'
};
await writeFile(join(backupDir, 'genetics-visual-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'genetics-visual-v4-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
