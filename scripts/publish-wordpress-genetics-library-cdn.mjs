import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_GENETICS_LIBRARY || '').toLowerCase() === 'true';
const catalogPath = process.env.SEED_LINE_CATALOG || 'site/wordpress/products/seed-line-catalog.json';
const identitiesPath = process.env.GENETICS_CDN_IDENTITIES || 'site/wordpress/products/genetics-cdn-identities.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-genetics-library';

if (!username || !password) throw new Error('WordPress credentials are required.');

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const identities = JSON.parse(await readFile(identitiesPath, 'utf8'));
if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog?.lines) || catalog.lines.length === 0) {
  throw new Error('Seed line catalog is missing or empty.');
}

const expectedCardCount = catalog.lines.reduce(
  (count, line) => count + (Array.isArray(line.releaseCards) ? line.releaseCards.length : 0),
  0
);
if (expectedCardCount === 0) throw new Error('Seed line catalog contains no reviewed strain cards.');
if (identities?.schemaVersion !== 1 || !Array.isArray(identities?.cards)) {
  throw new Error('Genetics CDN identity registry is missing or invalid.');
}
if (identities.cards.length !== expectedCardCount) {
  throw new Error(`Catalog contains ${expectedCardCount} reviewed cards but identity registry contains ${identities.cards.length}.`);
}

const identityBySlug = new Map(identities.cards.map((row) => [row.wordpressSlug, row]));
if (identityBySlug.size !== identities.cards.length) throw new Error('Duplicate reviewed CDN identity slug.');

const catalogCardSlugs = new Set();
for (const line of catalog.lines) {
  if (!line?.id || !line?.name || !line?.slug || !line?.summary) throw new Error(`Incomplete genetics line: ${line?.id || 'unknown'}`);
  if (!Array.isArray(line.releaseCards) || line.releaseCards.length === 0) throw new Error(`${line.id}: releaseCards must contain at least one reviewed card.`);
  for (const card of line.releaseCards) {
    if (!card?.sourceUrl || !card?.fileName || !card?.altText || !card?.wordpressSlug) throw new Error(`${line.id}: incomplete reviewed card metadata.`);
    if (!Number.isInteger(card.expectedWidth) || !Number.isInteger(card.expectedHeight)) throw new Error(`${line.id}: reviewed card dimensions are missing.`);
    if (!/^[a-f0-9]{64}$/.test(String(card.sourceSha256 || ''))) throw new Error(`${line.id}: original provenance SHA-256 is missing or invalid.`);
    if (catalogCardSlugs.has(card.wordpressSlug)) throw new Error(`Duplicate catalog card WordPress slug: ${card.wordpressSlug}`);
    catalogCardSlugs.add(card.wordpressSlug);
    if (!identityBySlug.has(card.wordpressSlug)) throw new Error(`${line.id}: no reviewed CDN identity for ${card.wordpressSlug}`);
  }
}
for (const slug of identityBySlug.keys()) {
  if (!catalogCardSlugs.has(slug)) throw new Error(`CDN identity has no matching catalog card: ${slug}`);
}

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const wpHeaders = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Genetics-CDN/2.0'
};
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `genetics-${stamp}`);
await mkdir(backupDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(options.timeoutMs || 60_000),
        headers: options.headers || {}
      });
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1300);
    }
  }
  throw lastError;
}

async function wpRequest(path, options = {}) {
  const response = await fetchWithRetry(`${siteUrl}${path}`, {
    ...options,
    headers: {
      ...wpHeaders,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error(`WordPress returned non-JSON for ${path}: ${text.slice(0, 500)}`); }
}

async function publicBytes(url, attempts = 4) {
  const response = await fetchWithRetry(url, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Cache-Control': 'no-cache, no-store, max-age=0',
      'User-Agent': 'DTFSeeds-Genetics-CDN-Source/2.0'
    }
  }, attempts);
  return Buffer.from(await response.arrayBuffer());
}

function imageInfo(bytes) {
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return { mimeType: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.subarray(0, 3).toString('hex') === 'ffd8ff') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 255) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 216 || marker === 217) { offset += 2; continue; }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        return { mimeType: 'image/jpeg', height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  throw new Error('Downloaded file is not a valid PNG or JPEG image.');
}

async function getPage(slug, parentId = null) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '20' });
  if (parentId) params.set('parent', String(parentId));
  const rows = await wpRequest(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(rows)) throw new Error(`Unexpected WordPress page response for ${slug}`);
  if (rows.length > 1) throw new Error(`Multiple WordPress pages found for slug ${slug}`);
  return rows[0] || null;
}

async function getMediaBySlug(slug) {
  const rows = await wpRequest(`/wp-json/wp/v2/media?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  if (!Array.isArray(rows)) throw new Error(`Unexpected WordPress media response for ${slug}`);
  return rows;
}

function preflightCard(line, card, bytes) {
  const info = imageInfo(bytes);
  const identity = identityBySlug.get(card.wordpressSlug);
  if (!identity) throw new Error(`${line.id}: reviewed CDN identity missing for ${card.wordpressSlug}`);
  if (!/^[a-f0-9]{64}$/.test(String(identity.cdnSha256 || ''))) throw new Error(`${line.id}: reviewed CDN SHA-256 is invalid.`);
  if (info.width !== Number(card.expectedWidth) || info.height !== Number(card.expectedHeight)) {
    throw new Error(`${line.id}: CDN dimensions ${info.width}x${info.height} != catalog ${card.expectedWidth}x${card.expectedHeight}`);
  }
  if (info.width !== Number(identity.width) || info.height !== Number(identity.height) || info.mimeType !== identity.mimeType) {
    throw new Error(`${line.id}: current CDN image metadata does not match reviewed CDN identity.`);
  }
  if (bytes.length !== Number(identity.cdnByteLength)) {
    throw new Error(`${line.id}: CDN byte length ${bytes.length} != reviewed ${identity.cdnByteLength}`);
  }
  const digest = sha256(bytes);
  if (digest !== identity.cdnSha256) {
    throw new Error(`${line.id}: CDN SHA-256 ${digest} != reviewed ${identity.cdnSha256}`);
  }
  return { bytes, digest, info, identity };
}

async function ensureMedia(line, card, reviewed) {
  const { bytes, digest, info } = reviewed;
  const exactSlug = `${card.wordpressSlug}-${digest.slice(0, 10)}`;
  const candidates = [
    ...(await getMediaBySlug(card.wordpressSlug)),
    ...(await getMediaBySlug(exactSlug))
  ];
  const uniqueCandidates = [...new Map(candidates.map((item) => [item.id, item])).values()];

  for (const item of uniqueCandidates) {
    if (!item?.source_url) continue;
    try {
      const remote = await publicBytes(item.source_url, 2);
      if (remote.length === bytes.length && sha256(remote) === digest) {
        if (!apply) return item;
        return wpRequest(`/wp-json/wp/v2/media/${item.id}`, {
          method: 'POST',
          body: JSON.stringify({
            title: basename(card.fileName).replace(/\.[^.]+$/, ''),
            alt_text: card.altText,
            caption: `DTF Genetics · ${line.name} · ${card.generation} ${card.seedType}`
          })
        });
      }
    } catch {
      // A stale candidate is ignored; a new exact asset will be uploaded below.
    }
  }

  if (!apply) return { id: null, source_url: card.sourceUrl, slug: exactSlug, dryRun: true };

  const extension = info.mimeType === 'image/png' ? '.png' : '.jpg';
  const stem = basename(card.fileName).replace(/\.[^.]+$/, '');
  const upload = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
    headers: {
      ...wpHeaders,
      'Content-Type': info.mimeType,
      'Content-Disposition': `attachment; filename="${stem}${extension}"`
    },
    body: bytes
  });
  const uploadText = await upload.text();
  let created;
  try { created = uploadText ? JSON.parse(uploadText) : null; } catch { created = { raw: uploadText.slice(0, 700) }; }
  if (!upload.ok || !created?.id) {
    throw new Error(`${line.id}: WordPress media upload failed (${upload.status}): ${created?.message || created?.raw || 'unknown error'}`);
  }

  const saved = await wpRequest(`/wp-json/wp/v2/media/${created.id}`, {
    method: 'POST',
    body: JSON.stringify({
      slug: exactSlug,
      title: stem,
      alt_text: card.altText,
      caption: `DTF Genetics · ${line.name} · ${card.generation} ${card.seedType}`
    })
  });
  const remote = await publicBytes(saved.source_url, 3);
  if (remote.length !== bytes.length || sha256(remote) !== digest) {
    throw new Error(`${line.id}: uploaded WordPress original failed exact CDN-byte verification.`);
  }
  return saved;
}

const badge = (text) => `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#e7f1e9;color:#17462a;font-size:.78rem;font-weight:850;text-transform:uppercase">${esc(text)}</span>`;
const button = (url, text, primary = true) => `<a href="${esc(url)}" style="display:inline-block;margin:5px 8px 5px 0;padding:11px 17px;border-radius:999px;background:${primary ? '#173c25' : '#fff'};color:${primary ? '#fff' : '#173c25'};border:1px solid #173c25;text-decoration:none;font-weight:850">${esc(text)}</a>`;
const image = (media, alt, eager = false) => media?.source_url
  ? `<img src="${esc(media.source_url)}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" ${eager ? 'fetchpriority="high"' : ''} decoding="async" style="display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;border-radius:20px">`
  : '';
const panel = (inner) => `<article style="background:#fff;border:1px solid #dce8df;border-radius:22px;padding:18px;box-shadow:0 10px 30px rgba(13,55,29,.07)">${inner}</article>`;

function lineageHtml(line) {
  if (line.lineage) return `<p><strong>Lineage:</strong> ${esc(line.lineage)}</p>`;
  if (line.lineageStatus === 'intentionally-unknown-on-reviewed-card') {
    return '<p><strong>Lineage:</strong> Intentionally unknown on the reviewed strain card. DTF will not invent parentage.</p>';
  }
  return '<p><strong>Lineage:</strong> Controlled parentage record not yet published. DTF will not guess or invent parentage.</p>';
}

function linePageHtml(line, mediaList) {
  const gallery = line.releaseCards.map((card, index) => panel(
    `${image(mediaList[index], card.altText, index === 0)}<p>${badge(`${card.generation} · ${card.seedType}`)}</p><h3>${esc(line.name)}</h3>`
  )).join('');
  const traits = (line.breedingDirection || []).map((value) => `<li>${esc(value)}</li>`).join('');
  const stores = Array.isArray(line.storeRoutes) && line.storeRoutes.length
    ? line.storeRoutes.map((route, index) => button(route.path, route.label, index === 0)).join('')
    : '<p>No current WooCommerce route is claimed from this catalog page.</p>';

  return `<div data-dtf-genetics-line="${esc(line.slug)}" style="background:#f4f8f4;color:#173522">
<section style="max-width:1180px;margin:auto;padding:52px 22px 30px">
  <p style="color:#2d7d48;font-weight:900;text-transform:uppercase">DTF Genetics · line profile</p>
  <h1 style="font-size:clamp(2.5rem,6vw,4.8rem);margin:0 0 16px">${esc(line.name)}</h1>
  <p style="font-size:1.1rem;line-height:1.8;color:#46604e">${esc(line.summary)}</p>
</section>
<section style="max-width:1180px;margin:auto;padding:8px 22px 52px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">${gallery}</section>
<section style="background:#12341f;color:#fff"><div style="max-width:1180px;margin:auto;padding:52px 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px">
  <div><h2 style="color:#fff">Lineage & project direction</h2>${lineageHtml(line)}${line.releaseSpecificLineage ? `<p><strong>Reviewed release lineage:</strong> ${esc(line.releaseSpecificLineage)}</p>` : ''}${line.floweringObservation ? `<p><strong>Flowering observation:</strong> ${esc(line.floweringObservation)}</p>` : ''}</div>
  <div><h2 style="color:#fff">Selection / packaging direction</h2><ul>${traits}</ul><p>These are breeding goals, packaging observations, or planning ranges—not guarantees.</p></div>
</div></section>
<section style="max-width:1180px;margin:auto;padding:52px 22px"><h2>Availability</h2>${stores}<p>${button('/seeds/', 'Back to Seeds / Genetics', false)}${button('/learn/subjects/genetics-breeding/', 'Learn genetics & breeding', false)}</p></section>
</div>`;
}

// Preflight every CDN source and identity before the first WordPress mutation.
const reviewedLines = [];
for (const line of catalog.lines) {
  const reviewedCards = [];
  for (const card of line.releaseCards) {
    const bytes = await publicBytes(card.sourceUrl);
    reviewedCards.push({ card, reviewed: preflightCard(line, card, bytes) });
  }
  reviewedLines.push({ line, reviewedCards });
}
await writeFile(join(backupDir, 'cdn-preflight.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  lineCount: catalog.lines.length,
  cardCount: expectedCardCount,
  cards: reviewedLines.flatMap(({ line, reviewedCards }) => reviewedCards.map(({ card, reviewed }) => ({
    lineId: line.id,
    wordpressSlug: card.wordpressSlug,
    cdnByteLength: reviewed.bytes.length,
    cdnSha256: reviewed.digest,
    mimeType: reviewed.info.mimeType,
    width: reviewed.info.width,
    height: reviewed.info.height
  })))
}, null, 2)}\n`);

const seedsPage = await getPage('seeds');
if (!seedsPage?.id) throw new Error('Canonical /seeds/ page was not found.');
await writeFile(join(backupDir, 'seeds-before.json'), `${JSON.stringify(seedsPage, null, 2)}\n`);

const prepared = [];
for (const { line, reviewedCards } of reviewedLines) {
  const mediaList = [];
  for (const { card, reviewed } of reviewedCards) {
    mediaList.push(await ensureMedia(line, card, reviewed));
  }
  prepared.push({ line, mediaList });
}

const pages = [];
for (const { line, mediaList } of prepared) {
  const existing = await getPage(line.slug, seedsPage.id);
  if (existing) await writeFile(join(backupDir, `${line.slug}-before.json`), `${JSON.stringify(existing, null, 2)}\n`);
  const payload = {
    slug: line.slug,
    parent: seedsPage.id,
    title: `${line.name} | DTF Genetics`,
    content: linePageHtml(line, mediaList),
    excerpt: line.summary,
    status: 'publish',
    featured_media: Number(mediaList[0]?.id) || 0
  };
  let page = existing;
  if (apply) {
    page = existing
      ? await wpRequest(`/wp-json/wp/v2/pages/${existing.id}`, { method: 'POST', body: JSON.stringify(payload) })
      : await wpRequest('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify(payload) });
  }
  pages.push({ slug: line.slug, id: page?.id || null, link: page?.link || `${siteUrl}/seeds/${line.slug}/` });
}

const catalogCardsHtml = prepared.map(({ line, mediaList }) => {
  const firstCard = line.releaseCards[0];
  return panel(`<a href="/seeds/${esc(line.slug)}/" style="color:inherit;text-decoration:none">${image(mediaList[0], firstCard.altText)}<p>${badge(line.releaseCards.map((card) => `${card.generation} ${card.seedType}`).join(' · '))}</p><h2>${esc(line.name)}</h2><p><strong>${esc(line.lineage || (line.lineageStatus === 'intentionally-unknown-on-reviewed-card' ? 'Unknown lineage' : 'Lineage record pending'))}</strong></p><p>${esc(line.summary)}</p><strong>Open line profile →</strong></a>`);
}).join('');

const blueMango = prepared.find(({ line }) => line.id === 'blue-mango');
const seedsHtml = `<div data-dtf-genetics-library="2026" style="background:#f4f8f4;color:#173522">
<section style="max-width:1240px;margin:auto;padding:58px 22px 38px;display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:38px;align-items:center">
  <div><p style="color:#2d7d48;font-weight:900;text-transform:uppercase">DTF Genetics · documented breeding library</p><h1 style="font-size:clamp(2.6rem,6vw,5rem);margin:0 0 20px">From breeding notes to current releases.</h1><p style="font-size:1.13rem;line-height:1.8;color:#46604e">Browse DTF Genetics by line. Every profile includes reviewed strain-card artwork, generation and seed-type context, description, verified lineage where available, and store routes only when a listing exists.</p><p>${button('#genetics-library', 'Browse the genetics library')}${button('/shop/', 'Shop current releases', false)}</p></div>
  <div>${image(blueMango?.mediaList?.[0], blueMango?.line?.releaseCards?.[0]?.altText || 'Blue Mango strain card', true)}</div>
</section>
<section id="genetics-library" style="max-width:1240px;margin:auto;padding:12px 22px 62px"><h2 style="font-size:clamp(2rem,4vw,3.35rem)">DTF Genetics library</h2><p>Unknown parentage is intentionally labeled as unverified rather than guessed.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px">${catalogCardsHtml}</div></section>
<section style="background:#12341f;color:#fff"><div style="max-width:1240px;margin:auto;padding:52px 22px"><h2 style="color:#fff">Catalog standard: observation over hype.</h2><p>Product pages control current price, inventory, quantity, seed type, fulfillment information and policies. The genetics library does not invent availability or guarantee phenotype, aroma, yield or finish date.</p></div></section>
</div>`;

if (apply) {
  await wpRequest(`/wp-json/wp/v2/pages/${seedsPage.id}`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Seeds / Genetics',
      content: seedsHtml,
      status: 'publish',
      featured_media: Number(blueMango?.mediaList?.[0]?.id) || 0
    })
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  apply,
  lineCount: catalog.lines.length,
  cardCount: expectedCardCount,
  cdnIdentityCount: identityBySlug.size,
  pages
};
await writeFile(join(backupDir, 'genetics-library-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'genetics-library-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
