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
          'User-Agent': 'DTFSeeds-Home-Genetics-Art/3.0',
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

function detectHomeLayout(content) {
  const hasCurrentReleases = /Current releases/i.test(content);
  const hasAllProductRoutes = releases.every((release) => content.includes(release.href));
  if (!hasCurrentReleases || !hasAllProductRoutes) {
    throw new Error('Home does not expose all three verified current-release routes; refusing visual replacement.');
  }
  if (content.includes('data-dtf-layout="home-v3"') && /<article\s+class=["'][^"']*\brelease\b/i.test(content)) {
    return 'home-v3';
  }
  if (/<div\s+class=["'][^"']*\bdtf-page\b/i.test(content) && /<article\s+class=["'][^"']*\bdtf-image-card\b/i.test(content)) {
    return 'visual-v2';
  }
  throw new Error('Home does not match a supported reviewed-genetics layout; refusing visual replacement.');
}

function releaseArticlePattern(layout, release) {
  const href = rx(release.href);
  const classNeedle = layout === 'home-v3' ? 'release' : 'dtf-image-card';
  return new RegExp(`(<article\\s+class=["'][^"']*\\b${classNeedle}\\b[^"']*["'][^>]*>)([\\s\\S]*?<a[^>]+href=["']${href}["'][^>]*>[\\s\\S]*?<\\/a>[\\s\\S]*?<\\/article>)`, 'i');
}

function replaceReleaseImage(content, layout, release, url) {
  const articleRe = releaseArticlePattern(layout, release);
  const match = content.match(articleRe);
  if (!match) throw new Error(`Home ${layout} release card not found by product route: ${release.href}`);
  const whole = match[0];
  const img = imageTag(url, release.alt, {
    style: 'display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:contain;background:#fff;padding:10px'
  });
  const next = /<img\b[^>]*>/i.test(whole)
    ? whole.replace(/<img\b[^>]*>/i, img)
    : whole.replace(/^(<article\b[^>]*>)/i, `$1${img}`);
  return content.replace(whole, next);
}

function heroPattern(layout) {
  return layout === 'home-v3'
    ? /<div\s+class=["']hero-media["']>[\s\S]*?<\/div>/i
    : /<div\s+class=["'][^"']*\bdtf-hero-media\b[^"']*["'][^>]*>[\s\S]*?<\/div>/i;
}

function replaceHeroMedia(content, layout, chosen) {
  const heroRe = heroPattern(layout);
  const current = content.match(heroRe)?.[0];
  if (!current) throw new Error(`Home ${layout} hero media container was not found.`);

  const cards = chosen.map(({ release, url }, index) => imageTag(url, release.alt, {
    eager: index === 0,
    className: `dtf-home-genetics-card dtf-home-genetics-card-${index + 1}`,
    style: 'object-fit:contain;background:#fff'
  })).join('');
  const baseClass = layout === 'home-v3' ? 'hero-media' : 'dtf-hero-media';
  return content.replace(current, `<div class="${baseClass} dtf-home-genetics-hero" data-dtf-home-genetics-v2="hero"><div class="dtf-home-genetics-stack">${cards}</div></div>`);
}

function replaceV3GeneticsFeatureImage(content, url) {
  const featureRe = /<article\s+class=["']feature["']>[\s\S]*?<h3>Know the breeding project before you buy the pack\.<\/h3>[\s\S]*?<\/article>/i;
  const current = content.match(featureRe)?.[0];
  if (!current) throw new Error('Homepage V3 genetics feature was not found.');
  const img = imageTag(url, featuredLine.alt, {
    style: 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#102b1a;padding:18px;border-radius:0'
  });
  const next = /<img\b[^>]*>/i.test(current)
    ? current.replace(/<img\b[^>]*>/i, img)
    : current.replace(/^(<article\b[^>]*>)/i, `$1${img}`);
  return content.replace(current, next);
}

function visualV2FeatureMarkup(url) {
  const img = imageTag(url, featuredLine.alt, {
    className: 'dtf-img dtf-home-genetics-feature-card',
    style: 'display:block;width:min(100%,420px);height:auto;aspect-ratio:2/3;object-fit:contain;background:#fff;padding:10px;margin:auto'
  });
  return `<section class="dtf-section dtf-section-dark dtf-home-genetics-feature" data-dtf-home-genetics-v2="feature"><div class="dtf-wrap"><div class="dtf-home-genetics-feature-grid" style="display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr);gap:42px;align-items:center">${img}<div><p class="dtf-eyebrow">Featured breeding project</p><h2 style="margin:0 0 14px;color:#fff;font-size:clamp(2rem,4vw,3.4rem)">Mango Bubbles</h2><p style="margin:0;color:#c7d7cc;line-height:1.75;font-size:1.05rem"><strong style="color:#fff">Blue Mango × Blue Bubblegum.</strong> The reviewed F1 Regular card documents the release-specific cross as Blue Mango F2 × Blue Bubblegum F1. Trait direction is breeding context, not a guarantee for every seed.</p><div class="dtf-actions"><a class="dtf-btn dtf-btn-primary" href="/seeds/mango-bubbles/">Open Mango Bubbles profile</a><a class="dtf-btn dtf-btn-secondary" href="/seeds/">Browse all genetics</a></div></div></div></section>`;
}

function upsertVisualV2GeneticsFeature(content, url) {
  const feature = visualV2FeatureMarkup(url);
  const existingRe = /<section\s+class=["'][^"']*\bdtf-home-genetics-feature\b[^"']*["'][^>]*data-dtf-home-genetics-v2=["']feature["'][^>]*>[\s\S]*?<\/section>/i;
  if (existingRe.test(content)) return content.replace(existingRe, feature);

  const releasesSectionRe = /<section\s+class=["'][^"']*\bdtf-section\b[^"']*["'][^>]*>[\s\S]*?<p\s+class=["']dtf-eyebrow["']>Current releases<\/p>[\s\S]*?<\/section>/i;
  const current = content.match(releasesSectionRe)?.[0];
  if (!current) throw new Error('Current visual Home release section was not found for Mango Bubbles feature insertion.');
  return content.replace(current, `${current}${feature}`);
}

function installGeneticsStyles(content, layout) {
  const marker = 'id="dtf-home-genetics-v2-style"';
  if (content.includes(marker)) return content;
  const style = `<style id="dtf-home-genetics-v2-style">
.v3 .dtf-home-genetics-hero:before,.dtf-page .dtf-home-genetics-hero:before{display:none}
.v3 .dtf-home-genetics-stack,.dtf-page .dtf-home-genetics-stack{position:relative;min-height:570px;display:grid;place-items:center;isolation:isolate}
.v3 .dtf-home-genetics-card,.dtf-page .dtf-home-genetics-card{position:absolute!important;display:block;width:min(66%,360px)!important;height:auto!important;aspect-ratio:2/3!important;border-radius:24px!important;padding:8px;box-shadow:0 28px 70px rgba(0,0,0,.34)!important;transition:transform .2s ease;transform-origin:50% 90%}
.v3 .dtf-home-genetics-card-1,.dtf-page .dtf-home-genetics-card-1{z-index:3;transform:translateY(-3px) rotate(-1deg)}
.v3 .dtf-home-genetics-card-2,.dtf-page .dtf-home-genetics-card-2{z-index:2;transform:translate(-31%,20px) rotate(-9deg)}
.v3 .dtf-home-genetics-card-3,.dtf-page .dtf-home-genetics-card-3{z-index:1;transform:translate(31%,24px) rotate(9deg)}
.v3 .dtf-home-genetics-stack:hover .dtf-home-genetics-card-1,.dtf-page .dtf-home-genetics-stack:hover .dtf-home-genetics-card-1{transform:translateY(-10px) rotate(0deg)}
.v3 .dtf-home-genetics-stack:hover .dtf-home-genetics-card-2,.dtf-page .dtf-home-genetics-stack:hover .dtf-home-genetics-card-2{transform:translate(-34%,16px) rotate(-11deg)}
.v3 .dtf-home-genetics-stack:hover .dtf-home-genetics-card-3,.dtf-page .dtf-home-genetics-stack:hover .dtf-home-genetics-card-3{transform:translate(34%,18px) rotate(11deg)}
.v3 .release>img,.dtf-page .dtf-image-card>img{background:#fff!important;object-fit:contain!important;aspect-ratio:2/3!important}
.dtf-page .dtf-home-genetics-feature-card{box-shadow:0 24px 60px rgba(0,0,0,.28)!important}
@media(max-width:820px){.v3 .dtf-home-genetics-stack,.dtf-page .dtf-home-genetics-stack{min-height:500px}.v3 .dtf-home-genetics-card,.dtf-page .dtf-home-genetics-card{width:min(62%,300px)!important}.dtf-page .dtf-home-genetics-feature-grid{grid-template-columns:1fr!important}}
@media(max-width:560px){.v3 .dtf-home-genetics-stack,.dtf-page .dtf-home-genetics-stack{min-height:430px}.v3 .dtf-home-genetics-card,.dtf-page .dtf-home-genetics-card{width:min(67%,260px)!important}.v3 .dtf-home-genetics-card-2,.dtf-page .dtf-home-genetics-card-2{transform:translate(-24%,16px) rotate(-8deg)}.v3 .dtf-home-genetics-card-3,.dtf-page .dtf-home-genetics-card-3{transform:translate(24%,18px) rotate(8deg)}}
</style>`;
  const root = layout === 'home-v3'
    ? /(<div\s+class=["']v3["'][^>]*>)/i
    : /(<div\s+class=["'][^"']*\bdtf-page\b[^"']*["'][^>]*>)/i;
  if (!root.test(content)) throw new Error(`Home ${layout} root was not found; refusing to inject reviewed-genetics styles.`);
  return content.replace(root, `$1${style}`);
}

function strengthenBrandCopy(content) {
  const currentReleaseLead = 'The store handles price and availability; the genetics catalog explains lineage, generation, selection direction, and what has actually been observed.';
  const reviewedReleaseLead = 'Current releases, shown with the real strain cards. The store handles price and availability; the genetics catalog explains lineage, generation, selection direction, and what has actually been observed.';
  return content
    .replace('Three jobs define the site.', 'Genetics at the center. Knowledge around it.')
    .replace('Genetics is the product identity. Teaching Healthy Cultivation explains the plant. The tools turn observations into records and decisions. Everything else supports those three jobs.', 'Start with the breeding project and the pack. Then use Teaching Healthy Cultivation and the grow tools to understand, measure, and document the plant behind it.')
    .replace('Current genetics stay simple and direct.', 'Current releases, shown with the real strain cards.')
    .replace('Three reviewed listings are public. Product pages control current price and availability while the genetics catalog carries the breeding context.', 'The current public releases now use their reviewed DTF Genetics card artwork. Product pages control price and availability; the genetics library carries the breeding context.')
    .replace(currentReleaseLead, reviewedReleaseLead);
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
const layout = detectHomeLayout(content);

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

content = installGeneticsStyles(content, layout);
content = replaceHeroMedia(content, layout, chosen);
if (layout === 'home-v3') content = replaceV3GeneticsFeatureImage(content, featured.url);
else content = upsertVisualV2GeneticsFeature(content, featured.url);
for (const row of chosen) content = replaceReleaseImage(content, layout, row.release, row.url);
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
  if (!saved.includes(release.href)) throw new Error(`Home did not preserve verified release route: ${release.href}`);
}
if (!saved.includes(featuredLine.alt)) throw new Error('Home did not persist the reviewed Mango Bubbles genetics feature artwork.');
if (!saved.includes('/seeds/mango-bubbles/')) throw new Error('Home did not persist the Mango Bubbles genetics profile route.');
if (!saved.includes('data-dtf-home-genetics-v2="hero"')) throw new Error('Home reviewed-genetics hero marker did not persist.');
if (!saved.includes('Current releases, shown with the real strain cards.')) throw new Error('Home customer-facing reviewed-release copy did not persist.');

console.log(JSON.stringify({
  ok: true,
  apply,
  pageId: home.id,
  layout,
  heroCards: chosen.map(({ release, url, wordpressMediaId, source }) => ({ name: release.name, url, wordpressMediaId, source })),
  geneticsFeature: { name: featuredLine.name, url: featured.url, wordpressMediaId: featured.wordpressMediaId, source: featured.source }
}, null, 2));
