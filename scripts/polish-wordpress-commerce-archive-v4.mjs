import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_COMMERCE_ARCHIVE_V4 || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-commerce-archive-v4';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `commerce-archive-v4-${stamp}`);
await mkdir(backupDir, { recursive: true });

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
  return body;
}

const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');

const style = `<style id="dtf-commerce-archive-v4">
:root{--dtf-c4-deep:#06170e;--dtf-c4-forest:#0c2b1a;--dtf-c4-green:#247a48;--dtf-c4-green2:#2d9154;--dtf-c4-gold:#d7b961;--dtf-c4-gold2:#ead58c;--dtf-c4-cream:#f6f2e8;--dtf-c4-paper:#fffdf7;--dtf-c4-ink:#112b1c;--dtf-c4-muted:#5b6e61;--dtf-c4-line:#d8e2d9;--dtf-c4-blue:#315e7a;--dtf-c4-purple:#6b4d79}
body.woocommerce-shop,body.post-type-archive-product{background:linear-gradient(180deg,#f8f5ed,var(--dtf-c4-cream))!important}
body.woocommerce-shop main,body.post-type-archive-product main{position:relative}
body.woocommerce-shop main:before,body.post-type-archive-product main:before{content:"SHOP THE LINE • READ THE STORY";display:inline-flex;align-items:center;margin:0 0 14px;padding:7px 10px;border-radius:999px;background:#e9f1e9;border:1px solid #c9d9cd;color:var(--dtf-c4-green);font-size:.68rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
body.woocommerce-shop .wp-block-query-title,body.post-type-archive-product .wp-block-query-title,.woocommerce-products-header__title.page-title{max-width:900px!important;font-size:clamp(3rem,7vw,6rem)!important;line-height:.9!important;letter-spacing:-.06em!important;text-wrap:balance}
body.woocommerce-shop .wp-block-query-title::after,body.post-type-archive-product .wp-block-query-title::after,.woocommerce-products-header__title.page-title::after{content:"Current releases and DTF products in one storefront. Genetics context lives in the breeding catalog; price, stock, pack details, and checkout terms live here.";display:block;max-width:760px;margin-top:18px;color:var(--dtf-c4-muted);font-size:clamp(1rem,1.5vw,1.16rem);line-height:1.72;letter-spacing:0;font-weight:500}
body.woocommerce-shop ul.products,body.post-type-archive-product ul.products{gap:26px!important}
body.woocommerce-shop ul.products li.product,body.post-type-archive-product ul.products li.product{isolation:isolate;padding:12px 12px 20px!important;border-radius:27px!important;background:rgba(255,253,247,.98)!important;box-shadow:0 14px 38px rgba(13,55,29,.075)!important;overflow:hidden!important}
body.woocommerce-shop ul.products li.product:after,body.post-type-archive-product ul.products li.product:after{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,var(--dtf-c4-green),var(--dtf-c4-gold));z-index:4}
body.woocommerce-shop ul.products li.product:hover,body.post-type-archive-product ul.products li.product:hover{transform:translateY(-6px)!important;box-shadow:0 28px 58px rgba(13,55,29,.14)!important}
body.woocommerce-shop ul.products li.product a.woocommerce-LoopProduct-link,body.post-type-archive-product ul.products li.product a.woocommerce-LoopProduct-link{position:relative}
body.woocommerce-shop ul.products li.product img,body.post-type-archive-product ul.products li.product img{aspect-ratio:1/1!important;object-fit:cover!important;border-radius:20px!important;box-shadow:inset 0 0 0 1px rgba(17,43,28,.06)!important;transition:transform .28s ease,filter .28s ease!important}
body.woocommerce-shop li.product:has(a[href*="10-regular-f2-blue-mango-seeds"]) img,body.post-type-archive-product li.product:has(a[href*="10-regular-f2-blue-mango-seeds"]) img,body.woocommerce-shop li.product:has(a[href*="10-feminized-f2-blue-mango-x"]) img,body.post-type-archive-product li.product:has(a[href*="10-feminized-f2-blue-mango-x"]) img,body.woocommerce-shop li.product:has(a[href*="10-reg-f1-blueberry-bubblegum"]) img,body.post-type-archive-product li.product:has(a[href*="10-reg-f1-blueberry-bubblegum"]) img{aspect-ratio:2/3!important;object-fit:contain!important;background:#f3efe5!important}
body.woocommerce-shop ul.products li.product:hover img,body.post-type-archive-product ul.products li.product:hover img{transform:scale(1.018);filter:saturate(1.035) contrast(1.015)}
body.woocommerce-shop .woocommerce-loop-product__title,body.post-type-archive-product .woocommerce-loop-product__title{min-height:auto!important;margin:5px 6px 8px!important;font-size:1.26rem!important;line-height:1.22!important;letter-spacing:-.025em!important}
body.woocommerce-shop ul.products li.product .price,body.post-type-archive-product ul.products li.product .price{margin-inline:6px!important;font-size:1.1rem!important}
body.woocommerce-shop ul.products li.product .button,body.post-type-archive-product ul.products li.product .button{width:calc(100% - 12px)!important;margin:14px 6px 0!important;border-radius:13px!important;background:linear-gradient(180deg,#123521,var(--dtf-c4-deep))!important;border-color:var(--dtf-c4-deep)!important;min-height:47px!important;box-shadow:0 10px 24px rgba(6,23,14,.12)}
body.woocommerce-shop ul.products li.product .button:hover,body.post-type-archive-product ul.products li.product .button:hover{background:linear-gradient(180deg,var(--dtf-c4-green2),var(--dtf-c4-green))!important}
body.woocommerce-shop li.product:has(a[href*="10-regular-f2-blue-mango-seeds"])::before,body.post-type-archive-product li.product:has(a[href*="10-regular-f2-blue-mango-seeds"])::before{content:"BLUE MANGO • F2 REGULAR";position:absolute;z-index:5;left:23px;top:23px;padding:7px 9px;border-radius:999px;background:rgba(6,23,14,.84);backdrop-filter:blur(8px);color:#f0dda0;font-size:.63rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
body.woocommerce-shop li.product:has(a[href*="10-feminized-f2-blue-mango-x"])::before,body.post-type-archive-product li.product:has(a[href*="10-feminized-f2-blue-mango-x"])::before{content:"BLUE MANGO • F2 FEMINIZED";position:absolute;z-index:5;left:23px;top:23px;padding:7px 9px;border-radius:999px;background:rgba(36,79,103,.9);backdrop-filter:blur(8px);color:#fff;font-size:.63rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
body.woocommerce-shop li.product:has(a[href*="10-reg-f1-blueberry-bubblegum"])::before,body.post-type-archive-product li.product:has(a[href*="10-reg-f1-blueberry-bubblegum"])::before{content:"BLUE BUBBLEGUM • F1 REGULAR";position:absolute;z-index:5;left:23px;top:23px;padding:7px 9px;border-radius:999px;background:rgba(83,55,96,.9);backdrop-filter:blur(8px);color:#fff;font-size:.63rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
body.woocommerce-shop li.product:has(a[href*="10-regular-f2-blue-mango-seeds"]) .woocommerce-loop-product__title::after,body.post-type-archive-product li.product:has(a[href*="10-regular-f2-blue-mango-seeds"]) .woocommerce-loop-product__title::after,body.woocommerce-shop li.product:has(a[href*="10-feminized-f2-blue-mango-x"]) .woocommerce-loop-product__title::after,body.post-type-archive-product li.product:has(a[href*="10-feminized-f2-blue-mango-x"]) .woocommerce-loop-product__title::after{content:"Somango XXL × Blueberry Butcher";display:block;margin-top:8px;color:#2d6541;font-size:.78rem;font-weight:850;line-height:1.42;letter-spacing:0}
body.woocommerce-shop li.product:has(a[href*="10-reg-f1-blueberry-bubblegum"]) .woocommerce-loop-product__title::after,body.post-type-archive-product li.product:has(a[href*="10-reg-f1-blueberry-bubblegum"]) .woocommerce-loop-product__title::after{content:"Bubblegum Kush × Blueberry Butcher";display:block;margin-top:8px;color:#5f436f;font-size:.78rem;font-weight:850;line-height:1.42;letter-spacing:0}
body.woocommerce-shop li.product:has(a[href*="10-regular-f2-blue-mango-seeds"])::after,body.post-type-archive-product li.product:has(a[href*="10-regular-f2-blue-mango-seeds"])::after{background:linear-gradient(90deg,#2f6481,#7baec4,#d7b961)}
body.woocommerce-shop li.product:has(a[href*="10-feminized-f2-blue-mango-x"])::after,body.post-type-archive-product li.product:has(a[href*="10-feminized-f2-blue-mango-x"])::after{background:linear-gradient(90deg,#315e7a,#94bfd0,#d7b961)}
body.woocommerce-shop li.product:has(a[href*="10-reg-f1-blueberry-bubblegum"])::after,body.post-type-archive-product li.product:has(a[href*="10-reg-f1-blueberry-bubblegum"])::after{background:linear-gradient(90deg,#543c62,#a27fb0,#79a977)}
body.woocommerce-shop li.product:has(a[href*="garden-journal"]),body.post-type-archive-product li.product:has(a[href*="garden-journal"]){background:linear-gradient(180deg,#fffdf7,#f1eee4)!important}
body.woocommerce-shop li.product:has(a[href*="garden-journal"])::after,body.post-type-archive-product li.product:has(a[href*="garden-journal"])::after{background:linear-gradient(90deg,#8c7650,#d7b961,#b7a783)}
body.woocommerce-shop li.product:has(a[href*="garden-journal"]) .woocommerce-loop-product__title::after,body.post-type-archive-product li.product:has(a[href*="garden-journal"]) .woocommerce-loop-product__title::after{content:"Grow notes • observations • project records";display:block;margin-top:8px;color:#776649;font-size:.76rem;font-weight:800;line-height:1.4;letter-spacing:0}
body.woocommerce-shop .onsale,body.post-type-archive-product .onsale{border-radius:10px!important;box-shadow:0 8px 18px rgba(6,23,14,.16)!important}
body.woocommerce-shop .woocommerce-result-count,body.post-type-archive-product .woocommerce-result-count{border-radius:11px!important}.woocommerce-ordering select{border-radius:11px!important}
@media(max-width:720px){body.woocommerce-shop main:before,body.post-type-archive-product main:before{margin-bottom:12px}.woocommerce-products-header__title.page-title{font-size:clamp(2.8rem,14vw,4.35rem)!important}.woocommerce-products-header__title.page-title::after{font-size:1rem!important}.woocommerce-shop ul.products li.product::before,.post-type-archive-product ul.products li.product::before{left:20px!important;top:20px!important}}
@media(prefers-reduced-motion:reduce){body.woocommerce-shop *,body.post-type-archive-product *{transition:none!important;animation:none!important}}
</style>`;

const marker = 'dtf-commerce-archive-v4';
const parts = await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const headers = (parts || []).filter((part) => part.theme === 'hostinger-ai-theme' && part.slug === 'header');
if (!headers.length) throw new Error('Active Hostinger header template part was not found');

const results = [];
for (const part of headers) {
  const original = rendered(part.content);
  await writeFile(join(backupDir, `template-part-${String(part.id).replaceAll('/', '_')}-before.json`), `${JSON.stringify(part, null, 2)}\n`);
  const cleaned = original
    .replace(/<!-- wp:html -->\s*<style id="dtf-commerce-archive-v4">[\s\S]*?<\/style>\s*<!-- \/wp:html -->/gi, '')
    .replace(/<style id="dtf-commerce-archive-v4">[\s\S]*?<\/style>/gi, '');
  const next = `${cleaned}\n<!-- wp:html -->${style}<!-- /wp:html -->`;
  if (apply) {
    await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(part.id)}`, {
      method: 'POST',
      body: JSON.stringify({ content: next, status: 'publish' })
    });
  }
  results.push({ id: part.id, changed: original !== next, marker });
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  backupDir,
  templateParts: results,
  marker
};
await writeFile(join(backupDir, 'commerce-archive-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'commerce-archive-v4-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
