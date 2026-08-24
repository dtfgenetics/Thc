import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_HOME_GENETICS_ART || '').toLowerCase() === 'true';
if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTFSeeds-Home-Genetics-Art/2.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status === 429 || response.status >= 500) && attempt < 10) {
        await sleep(Math.min(12_000, attempt * 1600));
        continue;
      }
      if (!response.ok) {
        throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
      }
      return body;
    } catch (error) {
      last = error;
      if (attempt < 10) {
        await sleep(Math.min(12_000, attempt * 1600));
        continue;
      }
    }
  }
  throw last;
}

const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const rx = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function allMedia() {
  const out = [];
  for (let page = 1; page <= 8; page += 1) {
    let batch;
    try {
      batch = await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
    } catch (error) {
      if (/400|invalid_page_number/i.test(error.message)) break;
      throw error;
    }
    if (!Array.isArray(batch) || !batch.length) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

const releases = [
  {
    key: 'blue-mango-f2-regular',
    name: 'Blue Mango F2 Regular',
    href: '/product/10-regular-f2-blue-mango-seeds/',
    slugPrefix: 'dtf-strain-card-blue-mango-f2-regular',
    alt: 'Blue Mango F2 Regular DTF Genetics strain card',
    fallback: 'https://cdn.shopify.com/s/files/1/0664/2542/1885/files/dtf-blue-mango-f2-regular.jpg?v=1787510072'
  },
  {
    key: 'blue-mango-f2-feminized',
    name: 'Blue Mango F2 Feminized',
    href: '/product/10-feminized-f2-blue-mango-x/',
    slugPrefix: 'dtf-strain-card-blue-mango-f2-feminized',
    alt: 'Blue Mango F2 Feminized DTF Genetics strain card',
    fallback: 'https://cdn.shopify.com/s/files/1/0664/2542/1885/files/dtf-blue-mango-f2-feminized.png?v=1787510082'
  },
  {
    key: 'blue-bubblegum-f1-regular',
    name: 'Blue Bubblegum F1 Regular',
    href: '/product/10-reg-f1-blueberry-bubblegum/',
    slugPrefix: 'dtf-strain-card-blue-bubblegum-f1-regular',
    alt: 'Blue Bubblegum F1 Regular DTF Genetics strain card',
    fallback: 'https://cdn.shopify.com/s/files/1/0664/2542/1885/files/dtf-blue-bubblegum-f1-regular.jpg?v=1787510057'
  }
];

const featuredLine = {
  key: 'mango-bubbles-f1-regular',
  name: 'Mango Bubbles F1 Regular',
  slugPrefix: 'dtf-strain-card-mango-bubbles-f1-regular',
  alt: 'Mango Bubbles F1 Regular DTF Genetics strain card',
  fallback: 'https://cdn.shopify.com/s/files/1/0664/2542/1885/files/dtf-mango-bubbles-f1-regular.jpg?v=1787510106'
};

function newestReviewedMedia(media, item) {
  const candidates = media.filter((row) => String(row?.slug || '').startsWith(item.slugPrefix) && row?.source_url);
  candidates.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  return candidates[0] || null;
}

function imageTag(url, alt, { eager = false, className = 'dtf-img', style = '' } = {}) {
  return `<img class="${esc(className)}" src="${esc(url)}" alt="${esc(alt)}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async"${style ? ` style="${esc(style)}"` : ''}>`;
}

function replaceReleaseImage(content, release, url) {
  const href = rx(release.href);
  const articleRe = new RegExp(`(<article\\s+class=["'][^"']*\\brelease\\b[^"']*["'][^>]*>)([\\s\\S]*?<a[^>]+href=["']${href}["'][^>]*>[\\s\\S]*?<\\/a>[\\s\\S]*?<\\/article>)`, 'i');
  const match = content.match(articleRe);
  if (!match) throw new Error(`Home release card not found by product route: ${release.href}`);
  const whole = match[0];
  const img = imageTag(url, release.alt, {
    style: 'display:block;width:100%;aspect-ratio:2/3;object-fit:contain;background:#fff;padding:10px'
  });
  const next = /<img\b[^>]*>/i.test(whole)
    ? whole.replace(/<img\b[^>]*>/i, img)
    : whole.replace(/^(<article\b[^>]*>)/i, `$1${img}`);
  return content.replace(whole, next);
}

function replaceHeroMedia(content, chosen) {
  const heroRe = /<div\s+class=["']hero-media["']>[\s\S]*?<\/div>/i;
  const current = content.match(heroRe)?.[0];
  if (!current) throw new Error('Home hero media container was not found.');

  const cards = chosen.map(({ release, url }, index) => imageTag(url, release.alt, {
    eager: index === 0,
    className: `dtf-home-genetics-card dtf-home-genetics-card-${index + 1}`,
    style: 'object-fit:contain;background:#fff'
  })).join('');
  return content.replace(current, `<div class="hero-media dtf-home-genetics-hero" data-dtf-home-genetics-v2="hero"><div class="dtf-home-genetics-stack">${cards}</div></div>`);
}

function replaceGeneticsFeatureImage(content, url) {
  const featureRe = /<article\s+class=["']feature["']>[\s\S]*?<h3>Know the breeding project before you buy the pack\.<\/h3>[\s\S]*?<\/article>/i;
  const current = content.match(featureRe)?.[0];
  if (!current) throw new Error('Homepage genetics feature was not found.');
  const img = imageTag(url, featuredLine.alt, {
    style: 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#102b1a;padding:18px;border-radius:0'
  });
  const next = /<img\b[^>]*>/i.test(current)
    ? current.replace(/<img\b[^>]*>/i, img)
    : current.replace(/^(<article\b[^>]*>)/i, `$1${img}`);
  return content.replace(current, next);
}

function installGeneticsStyles(content) {
  const marker = 'id="dtf-home-genetics-v2-style"';
  if (content.includes(marker)) return content;
  const style = `<style id="dtf-home-genetics-v2-style">
.v3 .dtf-home-genetics-hero:before{display:none}
.v3 .dtf-home-genetics-stack{position:relative;min-height:570px;display:grid;place-items:center;isolation:isolate}
.v3 .dtf-home-genetics-card{position:absolute!important;display:block;width:min(66%,360px)!important;height:auto!important;aspect-ratio:2/3!important;border-radius:24px!important;padding:8px;box-shadow:0 28px 70px rgba(0,0,0,.34)!important;transition:transform .2s ease;transform-origin:50% 90%}
.v3 .dtf-home-genetics-card-1{z-index:3;transform:translateY(-3px) rotate(-1deg)}
.v3 .dtf-home-genetics-card-2{z-index:2;transform:translate(-31%,20px) rotate(-9deg)}
.v3 .dtf-home-genetics-card-3{z-index:1;transform:translate(31%,24px) rotate(9deg)}
.v3 .dtf-home-genetics-stack:hover .dtf-home-genetics-card-1{transform:translateY(-10px) rotate(0deg)}
.v3 .dtf-home-genetics-stack:hover .dtf-home-genetics-card-2{transform:translate(-34%,16px) rotate(-11deg)}
.v3 .dtf-home-genetics-stack:hover .dtf-home-genetics-card-3{transform:translate(34%,18px) rotate(11deg)}
.v3 .release>img{background:#fff!important;object-fit:contain!important}
@media(max-width:820px){.v3 .dtf-home-genetics-stack{min-height:500px}.v3 .dtf-home-genetics-card{width:min(62%,300px)!important}}
@media(max-width:560px){.v3 .dtf-home-genetics-stack{min-height:430px}.v3 .dtf-home-genetics-card{width:min(67%,260px)!important}.v3 .dtf-home-genetics-card-2{transform:translate(-24%,16px) rotate(-8deg)}.v3 .dtf-home-genetics-card-3{transform:translate(24%,18px) rotate(8deg)}}
</style>`;
  const root = /(<div\s+class=["']v3["'][^>]*>)/i;
  if (!root.test(content)) throw new Error('Home V3 root was not found; refusing to inject Genetics V2 styles.');
  return content.replace(root, `$1${style}`);
}

function strengthenBrandCopy(content) {
  return content
    .replace('Three jobs define the site.', 'Genetics at the center. Knowledge around it.')
    .replace('Genetics is the product identity. Teaching Healthy Cultivation explains the plant. The tools turn observations into records and decisions. Everything else supports those three jobs.', 'Start with the breeding project and the pack. Then use Teaching Healthy Cultivation and the grow tools to understand, measure, and document the plant behind it.')
    .replace('Current genetics stay simple and direct.', 'Current releases, shown with the real strain cards.')
    .replace('Three reviewed listings are public. Product pages control current price and availability while the genetics catalog carries the breeding context.', 'The current public releases now use their reviewed DTF Genetics card artwork. Product pages control price and availability; the genetics library carries the breeding context.');
}

const [homeRows, media] = await Promise.all([
  request('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=10'),
  allMedia()
]);
if (!Array.isArray(homeRows) || homeRows.length !== 1) {
  throw new Error(`Expected exactly one Home page; found ${Array.isArray(homeRows) ? homeRows.length : 'invalid'}.`);
}

const home = homeRows[0];
let content = rendered(home.content);
if (!content.includes('data-dtf-layout="home-v3"') || !content.includes('Current releases')) {
  throw new Error('Home does not expose the expected V3 genetics/current-release structure; refusing visual replacement.');
}

const chosen = releases.map((release) => {
  const wpMedia = newestReviewedMedia(media, release);
  return {
    release,
    url: wpMedia?.source_url || release.fallback,
    wordpressMediaId: wpMedia?.id || null,
    source: wpMedia ? 'wordpress' : 'cdn-fallback'
  };
});
const featuredWp = newestReviewedMedia(media, featuredLine);
const featured = {
  release: featuredLine,
  url: featuredWp?.source_url || featuredLine.fallback,
  wordpressMediaId: featuredWp?.id || null,
  source: featuredWp ? 'wordpress' : 'cdn-fallback'
};

content = installGeneticsStyles(content);
content = replaceHeroMedia(content, chosen);
content = replaceGeneticsFeatureImage(content, featured.url);
for (const row of chosen) content = replaceReleaseImage(content, row.release, row.url);
content = strengthenBrandCopy(content);

if (apply) {
  await request(`/wp-json/wp/v2/pages/${home.id}`, {
    method: 'POST',
    body: JSON.stringify({ content, status: 'publish' })
  });
}

const check = await request(`/wp-json/wp/v2/pages/${home.id}?context=edit`);
const saved = rendered(check.content);
for (const release of releases) {
  if (!saved.includes(release.alt)) throw new Error(`Home did not persist reviewed release image alt text: ${release.name}`);
}
if (!saved.includes(featuredLine.alt)) throw new Error('Home did not persist the reviewed Mango Bubbles genetics feature artwork.');
if (!saved.includes('data-dtf-home-genetics-v2="hero"')) throw new Error('Home Genetics V2 hero marker did not persist.');
if (!saved.includes('Current releases, shown with the real strain cards.')) throw new Error('Home Genetics V2 customer-facing release copy did not persist.');

console.log(JSON.stringify({
  ok: true,
  apply,
  pageId: home.id,
  heroCards: chosen.map(({ release, url, wordpressMediaId, source }) => ({ name: release.name, url, wordpressMediaId, source })),
  geneticsFeature: { name: featuredLine.name, url: featured.url, wordpressMediaId: featured.wordpressMediaId, source: featured.source }
}, null, 2));
