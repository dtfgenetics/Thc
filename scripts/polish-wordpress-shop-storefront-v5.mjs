import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_SHOP_STOREFRONT_V5 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-shop-storefront-v5';
const cardRegistryPath = process.env.DTF_STRAIN_CARD_REGISTRY || 'site/wordpress/products/strain-card-images.json';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `shop-storefront-v5-${stamp}`);
await mkdir(backupDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const raw = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTFSeeds-Shop-Storefront-V5/1.1',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status === 429 || response.status >= 500) && attempt < 6) {
        await sleep(attempt * 1500);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 6) {
        await sleep(attempt * 1500);
        continue;
      }
    }
  }
  throw lastError;
}

const registry = JSON.parse(await readFile(cardRegistryPath, 'utf8'));
if (registry?.schemaVersion !== 1 || !Array.isArray(registry.cards)) {
  throw new Error(`Invalid reviewed strain-card registry: ${cardRegistryPath}`);
}

const releaseSpecs = [
  {
    productSlug: '10-regular-f2-blue-mango-seeds',
    productRoute: '/product/10-regular-f2-blue-mango-seeds/',
    lineRoute: '/seeds/blue-mango/',
    label: 'F2 · Regular',
    name: 'Blue Mango',
    lineage: 'Somango XXL × Blueberry Butcher',
    note: 'Regular F2 release from the documented Blue Mango project.'
  },
  {
    productSlug: '10-feminized-f2-blue-mango-x',
    productRoute: '/product/10-feminized-f2-blue-mango-x/',
    lineRoute: '/seeds/blue-mango/',
    label: 'F2 · Feminized',
    name: 'Blue Mango',
    lineage: 'Somango XXL × Blueberry Butcher',
    note: 'Feminized F2 release with the same reviewed project lineage.'
  },
  {
    productSlug: '10-reg-f1-blueberry-bubblegum',
    productRoute: '/product/10-reg-f1-blueberry-bubblegum/',
    lineRoute: '/seeds/blue-bubblegum/',
    label: 'F1 · Regular',
    name: 'Blue Bubblegum',
    lineage: 'Bubblegum Kush × Blueberry Butcher',
    note: 'Regular F1 release connected to the Blue Bubblegum project page.'
  }
];

const releaseCards = releaseSpecs.map((spec) => {
  const card = registry.cards.find((item) => item?.productSlug === spec.productSlug);
  if (!card?.sourceUrl || !card?.fileName || !card?.altText || !/^[a-f0-9]{64}$/.test(card?.sourceSha256 || '')) {
    throw new Error(`Reviewed artwork registry is incomplete for ${spec.productSlug}`);
  }
  return { ...spec, card };
});

const releaseMarkup = releaseCards.map(({ productRoute, lineRoute, label, name, lineage, note, card }) => `
<article class="dtf-shop-v5-release" data-review-file="${esc(card.fileName)}">
  <a class="dtf-shop-v5-art" href="${esc(productRoute)}" aria-label="Open ${esc(name)} ${esc(label)} current release">
    <img src="${esc(card.sourceUrl)}" alt="${esc(card.altText)}" loading="lazy" decoding="async" width="${Number(card.expectedWidth) || 1024}" height="${Number(card.expectedHeight) || 1536}">
  </a>
  <div class="dtf-shop-v5-release-copy">
    <small>${esc(label)}</small>
    <h3>${esc(name)}</h3>
    <p class="dtf-shop-v5-lineage">${esc(lineage)}</p>
    <p>${esc(note)}</p>
    <div class="dtf-shop-v5-release-actions"><a href="${esc(productRoute)}">Shop release</a><a href="${esc(lineRoute)}">Breeding notes</a></div>
  </div>
</article>`).join('');

const featured = releaseCards[0];
const storefront = `<!-- wp:html -->
<section class="dtf-shop-storefront-v5" data-dtf-shop-storefront-v5="true" data-dtf-shop-visual="premium-v6" aria-labelledby="dtf-shop-v5-title">
<style id="dtf-shop-storefront-v5-style">
.dtf-shop-storefront-v5{position:relative;width:100%;margin:0;padding:clamp(68px,8vw,116px) max(18px,calc((100vw - 1180px)/2)) clamp(64px,7vw,92px);overflow:hidden;border:0;border-bottom:1px solid rgba(213,177,90,.22);background:radial-gradient(circle at 88% 10%,rgba(213,177,90,.22),transparent 24%),radial-gradient(circle at 8% 92%,rgba(91,126,64,.24),transparent 31%),linear-gradient(145deg,#04110a 0%,#081c12 54%,#10311f 100%);color:#fff;box-shadow:0 26px 70px rgba(0,0,0,.16);isolation:isolate}
.dtf-shop-storefront-v5:before{content:"";position:absolute;inset:0;z-index:-2;opacity:.19;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to right,#000,transparent 78%)}
.dtf-shop-storefront-v5:after{content:"SHOP";position:absolute;right:-.03em;top:.03em;z-index:-1;color:rgba(255,255,255,.025);font:950 clamp(8rem,23vw,22rem)/.8 "Arial Narrow","Roboto Condensed",Inter,sans-serif;letter-spacing:-.08em;pointer-events:none}
.dtf-shop-storefront-v5 *{box-sizing:border-box}.dtf-shop-v5-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:clamp(34px,6vw,82px);align-items:center;max-width:1180px;margin:0 auto}.dtf-shop-v5-kicker{display:inline-flex;align-items:center;gap:10px;margin:0 0 16px;color:#efd47f;font-size:.7rem;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.dtf-shop-v5-kicker:before{content:"";width:28px;height:1px;background:#d5b15a}.dtf-shop-storefront-v5 h2{max-width:790px;margin:0;font-family:"Arial Narrow","Roboto Condensed",Inter,sans-serif;font-size:clamp(3rem,6.4vw,6.2rem);line-height:.88;letter-spacing:-.045em;text-transform:uppercase;color:#fff;text-wrap:balance}.dtf-shop-v5-lede{max-width:720px;margin:20px 0 0;color:#c9d7ce;font-size:clamp(1rem,1.35vw,1.13rem);line-height:1.7}.dtf-shop-v5-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.dtf-shop-v5-actions a,.dtf-shop-v5-release-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 16px;border:1px solid rgba(213,177,90,.42);border-radius:9px;background:rgba(255,255,255,.035);color:#fff!important;text-decoration:none!important;text-transform:uppercase;font-size:.69rem;font-weight:950;letter-spacing:.065em;transition:transform .18s ease,border-color .18s ease,background .18s ease}.dtf-shop-v5-actions a:hover,.dtf-shop-v5-release-actions a:hover{transform:translateY(-2px);border-color:#dfc16e;background:rgba(213,177,90,.09)}.dtf-shop-v5-actions a:first-child,.dtf-shop-v5-release-actions a:first-child{border-color:#dfc16e;background:linear-gradient(180deg,#d9ba68,#b89238);color:#07170f!important}.dtf-shop-v5-featured{position:relative;width:min(390px,100%);justify-self:end;padding:13px;border:1px solid rgba(213,177,90,.35);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.015));box-shadow:0 34px 78px rgba(0,0,0,.34);transform:rotate(1deg)}.dtf-shop-v5-featured:before{content:"CURRENT RELEASE";position:absolute;left:-18px;top:28px;z-index:2;padding:7px 10px;border:1px solid rgba(213,177,90,.52);border-radius:7px;background:#07170f;color:#efd47f;font-size:.58rem;font-weight:950;letter-spacing:.13em}.dtf-shop-v5-featured img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:17px;background:#081a11}.dtf-shop-v5-trust{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));max-width:1180px;margin:clamp(40px,6vw,70px) auto 0;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12)}.dtf-shop-v5-trust div{padding:17px 16px;border-right:1px solid rgba(255,255,255,.1)}.dtf-shop-v5-trust div:last-child{border-right:0}.dtf-shop-v5-trust small{display:block;color:#91a79a;font-size:.61rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.dtf-shop-v5-trust strong{display:block;margin-top:5px;color:#f4f0e5;font-size:.86rem;line-height:1.3}.dtf-shop-v5-section-head{max-width:1180px;margin:clamp(54px,7vw,84px) auto 24px}.dtf-shop-v5-section-head p{margin:0 0 8px;color:#dabb61;font-size:.66rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.dtf-shop-v5-section-head h3{max-width:720px;margin:0;color:#fff;font:900 clamp(2rem,4vw,3.8rem)/.96 "Arial Narrow","Roboto Condensed",Inter,sans-serif;text-transform:uppercase;letter-spacing:-.025em}.dtf-shop-v5-guide{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;max-width:1180px;margin:0 auto}.dtf-shop-v5-release{overflow:hidden;border:1px solid rgba(151,183,158,.2);border-radius:20px;background:linear-gradient(180deg,rgba(18,50,31,.97),rgba(7,26,16,.98));box-shadow:0 18px 46px rgba(0,0,0,.18);transition:transform .2s ease,border-color .2s ease}.dtf-shop-v5-release:hover{transform:translateY(-5px);border-color:rgba(213,177,90,.54)}.dtf-shop-v5-art{display:block;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.08);background:#07170f}.dtf-shop-v5-art img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;object-position:center top;transition:transform .32s ease}.dtf-shop-v5-release:hover .dtf-shop-v5-art img{transform:scale(1.018)}.dtf-shop-v5-release-copy{padding:19px}.dtf-shop-v5-release small{display:block;margin-bottom:8px;color:#efd47f;font-size:.64rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.dtf-shop-v5-release h3{margin:0 0 8px;color:#fff;font:900 clamp(1.55rem,2.5vw,2rem)/1 "Arial Narrow","Roboto Condensed",Inter,sans-serif;text-transform:uppercase}.dtf-shop-v5-release p{margin:0 0 9px;color:#b9c9bf;font-size:.88rem;line-height:1.55}.dtf-shop-v5-release .dtf-shop-v5-lineage{color:#e1e8e3;font-weight:800}.dtf-shop-v5-release-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.dtf-shop-v5-release-actions a{min-height:40px;padding:8px 11px;font-size:.62rem}.dtf-shop-v5-note{max-width:920px;margin:24px auto 0;color:#91a79a;font-size:.8rem;line-height:1.58}.dtf-shop-storefront-v5 a:focus-visible{outline:3px solid #efd47f;outline-offset:4px}
@media(max-width:880px){.dtf-shop-v5-hero{grid-template-columns:1fr}.dtf-shop-v5-featured{justify-self:start;width:min(350px,82vw);transform:none}.dtf-shop-v5-trust{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-shop-v5-trust div:nth-child(2){border-right:0}.dtf-shop-v5-trust div:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.1)}.dtf-shop-v5-guide{grid-template-columns:1fr}.dtf-shop-v5-art img{aspect-ratio:16/10;object-fit:contain;padding:10px}.dtf-shop-v5-release{display:grid;grid-template-columns:minmax(190px,.42fr) minmax(0,.58fr)}.dtf-shop-v5-art{border-bottom:0;border-right:1px solid rgba(255,255,255,.08)}}
@media(max-width:600px){.dtf-shop-storefront-v5{padding:54px 16px 62px}.dtf-shop-storefront-v5 h2{font-size:clamp(2.8rem,15vw,4.5rem)}.dtf-shop-v5-actions a{width:100%}.dtf-shop-v5-featured{width:min(330px,88vw)}.dtf-shop-v5-featured:before{left:12px;top:12px}.dtf-shop-v5-trust{grid-template-columns:1fr}.dtf-shop-v5-trust div,.dtf-shop-v5-trust div:nth-child(2){border-right:0;border-bottom:1px solid rgba(255,255,255,.1)}.dtf-shop-v5-trust div:last-child{border-bottom:0}.dtf-shop-v5-release{display:block}.dtf-shop-v5-art{border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}.dtf-shop-v5-art img{aspect-ratio:4/5;object-fit:cover;padding:0}.dtf-shop-v5-release-actions a{flex:1 1 100%}}
@media(prefers-reduced-motion:reduce){.dtf-shop-storefront-v5 *{transition:none!important}.dtf-shop-v5-release:hover,.dtf-shop-v5-actions a:hover,.dtf-shop-v5-release-actions a:hover{transform:none!important}}
</style>
<div class="dtf-shop-v5-hero">
  <div>
    <p class="dtf-shop-v5-kicker">DTF Genetics · Current releases</p>
    <h2 id="dtf-shop-v5-title">Shop the release. Read the breeding story.</h2>
    <p class="dtf-shop-v5-lede">Current DTF Genetics seed listings connect directly to documented lineage and generation context. Use the storefront for current price and availability, then open the genetics library for the breeding project behind each pack.</p>
    <nav class="dtf-shop-v5-actions" aria-label="Genetics storefront navigation"><a href="/seeds/">Explore genetics</a><a href="/seeds/blue-mango/">Blue Mango project</a><a href="/seeds/blue-bubblegum/">Blue Bubblegum project</a></nav>
  </div>
  <a class="dtf-shop-v5-featured" href="${esc(featured.productRoute)}" data-review-file="${esc(featured.card.fileName)}" aria-label="Open featured Blue Mango F2 Regular release"><img src="${esc(featured.card.sourceUrl)}" alt="${esc(featured.card.altText)}" loading="eager" fetchpriority="high" decoding="async" width="${Number(featured.card.expectedWidth) || 1024}" height="${Number(featured.card.expectedHeight) || 1536}"></a>
</div>
<div class="dtf-shop-v5-trust" aria-label="Storefront standards"><div><small>Current catalog</small><strong>3 reviewed seed releases</strong></div><div><small>Visual provenance</small><strong>Reviewed strain-card artwork</strong></div><div><small>Breeding context</small><strong>Documented lineage & generation</strong></div><div><small>Plant reality</small><strong>Individual expression can vary</strong></div></div>
<div class="dtf-shop-v5-section-head"><p>Current genetics</p><h3>Choose the release. Keep the project context.</h3></div>
<div class="dtf-shop-v5-guide" aria-label="Current release guide">${releaseMarkup}
</div>
<p class="dtf-shop-v5-note">Product pages control current pricing, availability, quantity, and checkout terms. Breeding observations describe project direction and are not guarantees of phenotype, yield, potency, aroma, flavor, structure, or finish date.</p>
</section>
<!-- /wp:html -->`;

function stripExisting(content) {
  return String(content)
    .replace(/<!-- wp:html -->\s*<section\s+class=["']dtf-shop-storefront-v5["'][\s\S]*?<\/section>\s*<!-- \/wp:html -->/gi, '')
    .replace(/<section\s+class=["']dtf-shop-storefront-v5["'][\s\S]*?<\/section>/gi, '');
}

function insertStorefront(content) {
  const cleaned = stripExisting(content);
  const header = /<!-- wp:template-part\s+\{[^}]*"slug"\s*:\s*"header"[^}]*\}\s*\/-->/i;
  if (header.test(cleaned)) return cleaned.replace(header, (match) => `${match}\n${storefront}`);

  const archiveMarker = /<!-- wp:(?:woocommerce\/store-notices|query-title|woocommerce\/product-collection)\b/i;
  if (archiveMarker.test(cleaned)) return cleaned.replace(archiveMarker, (match) => `${storefront}\n${match}`);

  throw new Error('Could not find a safe insertion point in the active product archive template; refusing to rewrite the archive.');
}

const [themes, templates] = await Promise.all([
  request('/wp-json/wp/v2/themes?status=active&context=edit'),
  request('/wp-json/wp/v2/templates?context=edit&per_page=100')
]);
const activeTheme = Array.isArray(themes) ? themes[0] : null;
const themeSlug = activeTheme?.stylesheet || activeTheme?.template || '';
if (themeSlug !== 'hostinger-ai-theme') throw new Error(`Expected active hostinger-ai-theme; found ${themeSlug || 'unknown'}`);

const activeTemplates = (Array.isArray(templates) ? templates : []).filter((item) => item?.theme === themeSlug && item?.id);
const exact = activeTemplates.filter((item) => String(item.slug || '').toLowerCase() === 'archive-product');
if (exact.length !== 1) {
  const productLike = activeTemplates.filter((item) => /product/i.test(String(item.slug || ''))).map((item) => `${item.slug}:${item.id}`).join(', ');
  throw new Error(`Expected exactly one active archive-product template; found ${exact.length}. Product-like templates: ${productLike || 'none'}`);
}

const archive = exact[0];
const before = raw(archive.content);
if (!before.includes('woocommerce') && !before.includes('product')) throw new Error('archive-product template does not contain a recognizable WooCommerce/product block; refusing to write.');
await writeFile(join(backupDir, `template-${String(archive.id).replaceAll('/', '_')}-before.json`), `${JSON.stringify(archive, null, 2)}\n`);

const next = insertStorefront(before);
if ((next.match(/data-dtf-shop-storefront-v5=/g) || []).length !== 1) throw new Error('Shop V5 storefront marker must occur exactly once before write.');
if (!next.includes('/product/10-regular-f2-blue-mango-seeds/') || !next.includes('/product/10-feminized-f2-blue-mango-x/') || !next.includes('/product/10-reg-f1-blueberry-bubblegum/')) throw new Error('Shop V5 storefront is missing a canonical current product route.');
for (const { card } of releaseCards) {
  if (!next.includes(card.fileName)) throw new Error(`Shop V5 storefront is missing reviewed artwork marker ${card.fileName}`);
}

let updated = archive;
if (apply) {
  updated = await request(`/wp-json/wp/v2/templates/${encodeURIComponent(archive.id)}`, {
    method: 'POST',
    body: JSON.stringify({ content: next, status: 'publish' })
  });
}

const afterRows = await request('/wp-json/wp/v2/templates?context=edit&per_page=100');
const after = (Array.isArray(afterRows) ? afterRows : []).find((item) => item?.id === archive.id);
const saved = raw(after?.content);
if (apply) {
  if (!after?.id) throw new Error('Shop archive template disappeared after update.');
  if (!saved.includes('data-dtf-shop-storefront-v5="true"')) throw new Error('Shop V5 storefront marker did not persist.');
  if (!saved.includes('data-dtf-shop-visual="premium-v6"')) throw new Error('Premium Shop visual marker did not persist.');
  if (!saved.includes('Shop the release. Read the breeding story.')) throw new Error('Shop V5 customer-facing storefront copy did not persist.');
  if ((saved.match(/data-dtf-shop-storefront-v5=/g) || []).length !== 1) throw new Error('Shop V5 storefront was duplicated after update.');
  for (const { card } of releaseCards) {
    if (!saved.includes(card.fileName)) throw new Error(`Reviewed Shop artwork marker did not persist: ${card.fileName}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  backupDir,
  theme: themeSlug,
  templateId: archive.id,
  templateSlug: archive.slug,
  templateSource: archive.source || null,
  changed: before !== next,
  updatedWpId: updated?.wp_id || null,
  marker: 'data-dtf-shop-storefront-v5="true"',
  visualMarker: 'data-dtf-shop-visual="premium-v6"',
  reviewedArtwork: releaseCards.map(({ card }) => ({ fileName: card.fileName, sourceSha256: card.sourceSha256 }))
};
await writeFile(join(backupDir, 'shop-storefront-v5-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'shop-storefront-v5-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
