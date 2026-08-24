import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_SHOP_STOREFRONT_V5 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-shop-storefront-v5';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `shop-storefront-v5-${stamp}`);
await mkdir(backupDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const raw = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');

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
          'User-Agent': 'DTFSeeds-Shop-Storefront-V5/1.0',
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

const storefront = `<!-- wp:html -->
<section class="dtf-shop-storefront-v5" data-dtf-shop-storefront-v5="true" aria-labelledby="dtf-shop-v5-title">
<style id="dtf-shop-storefront-v5-style">
.dtf-shop-storefront-v5{width:min(1180px,calc(100% - 36px));margin:30px auto 38px;padding:30px;border:1px solid #d8e2d9;border-radius:28px;background:radial-gradient(circle at 92% 4%,rgba(215,185,97,.2),transparent 29%),linear-gradient(145deg,#071a10,#10321f);color:#fff;box-shadow:0 22px 58px rgba(8,32,18,.16)}
.dtf-shop-storefront-v5 *{box-sizing:border-box}.dtf-shop-v5-kicker{margin:0 0 10px;color:#e6ca78;font-size:.75rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.dtf-shop-storefront-v5 h2{max-width:820px;margin:0;font-size:clamp(2rem,4.5vw,4rem);line-height:.98;letter-spacing:-.045em;color:#fff}.dtf-shop-v5-lede{max-width:800px;margin:17px 0 0;color:#d3e0d7;font-size:1.04rem;line-height:1.72}.dtf-shop-v5-trust{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.dtf-shop-v5-trust span{display:inline-flex;padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.06);color:#edf4ef;font-size:.78rem;font-weight:850}.dtf-shop-v5-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.dtf-shop-v5-actions a{display:inline-flex;align-items:center;min-height:43px;padding:9px 15px;border-radius:999px;border:1px solid rgba(255,255,255,.25);color:#fff!important;text-decoration:none!important;font-weight:900}.dtf-shop-v5-actions a:first-child{background:#d7b961;border-color:#d7b961;color:#071a10!important}.dtf-shop-v5-guide{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:26px}.dtf-shop-v5-release{padding:17px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(255,255,255,.06)}.dtf-shop-v5-release small{display:block;margin-bottom:7px;color:#e6ca78;font-size:.68rem;font-weight:950;letter-spacing:.09em;text-transform:uppercase}.dtf-shop-v5-release h3{margin:0 0 7px;color:#fff;font-size:1.08rem;line-height:1.18}.dtf-shop-v5-release p{margin:0;color:#cbdad0;font-size:.9rem;line-height:1.5}.dtf-shop-v5-release a{display:inline-flex;margin-top:12px;color:#f0d788!important;text-decoration:none!important;font-weight:900}.dtf-shop-v5-note{margin:20px 0 0;color:#afc2b5;font-size:.84rem;line-height:1.55}
@media(max-width:820px){.dtf-shop-v5-guide{grid-template-columns:1fr}.dtf-shop-storefront-v5{padding:24px}}
@media(max-width:560px){.dtf-shop-storefront-v5{width:min(100% - 24px,1180px);margin-top:18px;padding:20px;border-radius:22px}.dtf-shop-v5-actions a{width:100%;justify-content:center}}
</style>
<p class="dtf-shop-v5-kicker">DTF Genetics · Current releases</p>
<h2 id="dtf-shop-v5-title">Shop the release. Read the breeding story.</h2>
<p class="dtf-shop-v5-lede">Current DTF Genetics seed listings connect directly to documented lineage and generation context. Use the storefront for current price and availability, then open the genetics library for the breeding project behind each pack.</p>
<div class="dtf-shop-v5-trust" aria-label="Storefront standards"><span>3 reviewed seed releases</span><span>Reviewed strain-card artwork</span><span>Documented lineage & generation</span><span>Individual expression can vary</span></div>
<nav class="dtf-shop-v5-actions" aria-label="Genetics storefront navigation"><a href="/seeds/">Explore the genetics library</a><a href="/seeds/blue-mango/">Blue Mango project</a><a href="/seeds/blue-bubblegum/">Blue Bubblegum project</a></nav>
<div class="dtf-shop-v5-guide" aria-label="Current release guide">
<article class="dtf-shop-v5-release"><small>F2 · Regular</small><h3>Blue Mango</h3><p>Somango XXL × Blueberry Butcher</p><a href="/product/10-regular-f2-blue-mango-seeds/">Open current release →</a></article>
<article class="dtf-shop-v5-release"><small>F2 · Feminized</small><h3>Blue Mango</h3><p>Somango XXL × Blueberry Butcher</p><a href="/product/10-feminized-f2-blue-mango-x/">Open current release →</a></article>
<article class="dtf-shop-v5-release"><small>F1 · Regular</small><h3>Blue Bubblegum</h3><p>Bubblegum Kush × Blueberry Butcher</p><a href="/product/10-reg-f1-blueberry-bubblegum/">Open current release →</a></article>
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
  if (!saved.includes('Shop the release. Read the breeding story.')) throw new Error('Shop V5 customer-facing storefront copy did not persist.');
  if ((saved.match(/data-dtf-shop-storefront-v5=/g) || []).length !== 1) throw new Error('Shop V5 storefront was duplicated after update.');
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
  marker: 'data-dtf-shop-storefront-v5="true"'
};
await writeFile(join(backupDir, 'shop-storefront-v5-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'shop-storefront-v5-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
