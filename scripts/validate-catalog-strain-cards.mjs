import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const registryPath = new URL('../site/wordpress/products/catalog-strain-cards.json', import.meta.url);
const seedsPath = new URL('../site/wordpress/pages/seeds.html', import.meta.url);
const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const seedsHtml = await readFile(seedsPath, 'utf8');

function fail(message) {
  throw new Error(`Catalog strain-card validation failed: ${message}`);
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (registry?.schemaVersion !== 1) fail('schemaVersion must be 1');
if (!Array.isArray(registry?.cards) || registry.cards.length === 0) fail('cards must be a non-empty array');
if (registry.policy?.requireExactHash !== true) fail('requireExactHash must be true');

const ids = new Set();
const driveIds = new Set();
const mediaSlugs = new Set();
const placeholders = new Set();
const detailPaths = new Set();

async function fetchBytes(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
        headers: { 'User-Agent': 'DTFSeeds-Catalog-Card-Validator/1.0' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

async function downloadExact(card) {
  const urls = [
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(card.driveFileId)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(card.driveFileId)}&confirm=t`
  ];
  const failures = [];
  for (const url of urls) {
    try {
      const bytes = await fetchBytes(url);
      if (bytes.length !== Number(card.byteLength)) throw new Error(`byte length ${bytes.length} != ${card.byteLength}`);
      const hash = sha256(bytes);
      if (hash !== card.sha256) throw new Error(`SHA-256 ${hash} != ${card.sha256}`);
      if (bytes.subarray(0, 3).toString('hex') !== 'ffd8ff') throw new Error('JPEG start marker missing');
      if (bytes.subarray(-2).toString('hex') !== 'ffd9') throw new Error('JPEG end marker missing');
      return { url, bytes: bytes.length, sha256: hash };
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }
  fail(`${card.registryId} exact Drive source is not publicly downloadable: ${failures.join(' | ')}`);
}

const downloadResults = [];
for (const card of registry.cards) {
  for (const [field, value] of Object.entries({
    registryId: card.registryId,
    canonicalName: card.canonicalName,
    generation: card.generation,
    seedType: card.seedType,
    driveFileId: card.driveFileId,
    fileName: card.fileName,
    mimeType: card.mimeType,
    wordpressSlug: card.wordpressSlug,
    altText: card.altText,
    placeholder: card.placeholder,
    detailPath: card.detailPath
  })) {
    if (!String(value || '').trim()) fail(`${card.registryId || 'unknown'} missing ${field}`);
  }

  if (ids.has(card.registryId)) fail(`duplicate registryId ${card.registryId}`);
  if (driveIds.has(card.driveFileId)) fail(`duplicate driveFileId ${card.driveFileId}`);
  if (mediaSlugs.has(card.wordpressSlug)) fail(`duplicate wordpressSlug ${card.wordpressSlug}`);
  if (placeholders.has(card.placeholder)) fail(`duplicate placeholder ${card.placeholder}`);
  if (detailPaths.has(card.detailPath)) fail(`duplicate detailPath ${card.detailPath}`);
  ids.add(card.registryId);
  driveIds.add(card.driveFileId);
  mediaSlugs.add(card.wordpressSlug);
  placeholders.add(card.placeholder);
  detailPaths.add(card.detailPath);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.registryId)) fail(`${card.registryId} has invalid registryId`);
  if (!/^F[1-9][0-9]*$/.test(card.generation)) fail(`${card.registryId} has invalid generation ${card.generation}`);
  if (!['regular', 'feminized', 'autoflower-regular', 'autoflower-feminized'].includes(card.seedType)) fail(`${card.registryId} has invalid seedType ${card.seedType}`);
  if (card.mimeType !== 'image/jpeg') fail(`${card.registryId} must be image/jpeg`);
  if (!/\.jpe?g$/i.test(card.fileName)) fail(`${card.registryId} filename must use a JPEG extension`);
  if (!Number.isInteger(card.byteLength) || card.byteLength < 1000) fail(`${card.registryId} has invalid byteLength`);
  if (!/^[a-f0-9]{64}$/.test(card.sha256 || '')) fail(`${card.registryId} has invalid SHA-256`);
  if (!/^__DTF_MEDIA_[A-Z0-9_]+__$/.test(card.placeholder)) fail(`${card.registryId} has invalid placeholder`);
  if (!/^\/[a-z0-9-]+\/$/.test(card.detailPath)) fail(`${card.registryId} has invalid detailPath`);
  if (card.lineage !== null && !String(card.lineage).includes('×')) fail(`${card.registryId} documented lineage must use ×`);
  if (card.floweringWindowWeeks !== null) {
    const w = card.floweringWindowWeeks;
    if (!Number.isInteger(w?.minimum) || !Number.isInteger(w?.maximum) || w.minimum < 1 || w.maximum < w.minimum || !w.qualifier?.trim()) {
      fail(`${card.registryId} has invalid floweringWindowWeeks`);
    }
  }

  if (!seedsHtml.includes(card.placeholder)) fail(`seeds.html is missing image placeholder ${card.placeholder}`);
  if (!seedsHtml.includes(card.detailPath)) fail(`seeds.html is missing detail path ${card.detailPath}`);
  if (!seedsHtml.includes(card.canonicalName)) fail(`seeds.html is missing ${card.canonicalName}`);

  const slug = card.detailPath.replace(/^\//, '').replace(/\/$/, '');
  const pageUrl = new URL(`../site/wordpress/pages/${slug}.html`, import.meta.url);
  const pageHtml = await readFile(pageUrl, 'utf8');
  if (!pageHtml.includes('<h1')) fail(`${slug}.html is missing h1`);
  if (!pageHtml.includes(card.canonicalName)) fail(`${slug}.html is missing canonical name`);
  if (!pageHtml.includes(card.placeholder)) fail(`${slug}.html is missing its exact media placeholder`);
  if (card.lineage && !pageHtml.includes(card.lineage)) fail(`${slug}.html is missing documented lineage ${card.lineage}`);

  downloadResults.push({ registryId: card.registryId, ...(await downloadExact(card)) });
}

console.log(JSON.stringify({
  ok: true,
  cardCount: registry.cards.length,
  exactSourcesVerified: downloadResults
}, null, 2));
