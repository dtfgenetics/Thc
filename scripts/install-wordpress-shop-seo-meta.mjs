import './wordpress-ipv4-fetch-bootstrap.mjs';
import './normalize-shop-seo-verification-html.mjs';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const expectedTitle = 'DTF Genetics Seeds & Current Releases';
const expectedDescription = 'Shop current DTF Genetics seed releases with reviewed strain-card artwork, documented lineage and generation context, and links to each breeding project.';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractTitle(html) {
  return String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
}

function extractDescription(html) {
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const name = tag.match(/\bname=["']([^"']*)["']/i)?.[1]?.toLowerCase();
    if (name !== 'description') continue;
    return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
  }
  return '';
}

async function verifyExistingMetadata() {
  let last = { status: 0, title: '', description: '' };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}/shop/?dtf_shop_seo_preflight=${Date.now()}-${attempt}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTF-Shop-SEO-Preflight/1.0',
        },
      });
      const html = await response.text();
      last = {
        status: response.status,
        title: extractTitle(html),
        description: extractDescription(html),
      };
      if (response.ok && last.title.includes(expectedTitle) && last.description === expectedDescription) {
        return { ok: true, ...last };
      }
    } catch (error) {
      last = { ...last, error: error?.message || String(error) };
    }
    await sleep(attempt * 900);
  }
  return { ok: false, ...last };
}

const existing = await verifyExistingMetadata();
if (existing.ok) {
  console.log(JSON.stringify({
    ok: true,
    siteUrl,
    alreadyCurrent: true,
    changed: false,
    installSkipped: true,
    verified: existing,
    reason: 'Reviewed Shop SEO metadata is already visitor-facing; privileged MU-plugin mutation is unnecessary.'
  }));
} else {
  await import('./install-wordpress-shop-seo-meta-core.mjs');
}
