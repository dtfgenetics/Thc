import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const registryPath = new URL('../site/wordpress/products/catalog-strain-cards.json', import.meta.url);
const seedsPath = new URL('../site/wordpress/pages/seeds.html', import.meta.url);
const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const seedsHtml = await readFile(seedsPath, 'utf8');
const repoRoot = process.cwd();

function fail(message) {
  throw new Error(`Catalog strain-card validation failed: ${message}`);
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) fail('invalid JPEG start marker');
  let offset = 2;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (offset + 1 >= bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (sof.has(marker)) {
      if (length < 7) fail('invalid JPEG SOF segment');
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  fail('JPEG dimensions could not be read');
}

async function loadReviewedWebCard(card) {
  const permanentPath = join(repoRoot, card.webAssetPath);
  try {
    const bytes = await readFile(permanentPath);
    return { bytes, source: card.webAssetPath };
  } catch (permanentError) {
    const stagingDir = join(repoRoot, '.tmp', 'strain-card-b64', card.webStagingKey);
    let names;
    try {
      names = (await readdir(stagingDir)).filter((name) => name.endsWith('.txt')).sort();
    } catch {
      fail(`${card.registryId} has neither permanent web asset ${card.webAssetPath} nor staging directory ${card.webStagingKey}`);
    }
    if (!names.length) fail(`${card.registryId} staging directory contains no chunks`);
    const parts = [];
    for (const name of names) parts.push(await readFile(join(stagingDir, name), 'utf8'));
    const encoded = parts.join('').replace(/\s+/g, '');
    if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      fail(`${card.registryId} staging data is not valid base64`);
    }
    return { bytes: Buffer.from(encoded, 'base64'), source: `.tmp/strain-card-b64/${card.webStagingKey}` };
  }
}

function verifyReviewedWebCard(card, loaded) {
  const { bytes, source } = loaded;
  const hash = sha256(bytes);
  if (bytes.length !== Number(card.webByteLength)) fail(`${card.registryId} web byte length ${bytes.length} != ${card.webByteLength}`);
  if (hash !== card.webSha256) fail(`${card.registryId} web SHA-256 ${hash} != ${card.webSha256}`);
  if (bytes.subarray(0, 3).toString('hex') !== 'ffd8ff' || bytes.subarray(-2).toString('hex') !== 'ffd9') {
    fail(`${card.registryId} web asset is not a complete JPEG`);
  }
  const dimensions = jpegDimensions(bytes);
  if (dimensions.width !== Number(card.webWidth) || dimensions.height !== Number(card.webHeight)) {
    fail(`${card.registryId} web dimensions ${dimensions.width}×${dimensions.height} != ${card.webWidth}×${card.webHeight}`);
  }
  return { source, byteLength: bytes.length, sha256: hash, width: dimensions.width, height: dimensions.height };
}

if (registry?.schemaVersion !== 1) fail('schemaVersion must be 1');
if (!Array.isArray(registry?.cards) || registry.cards.length === 0) fail('cards must be a non-empty array');
if (registry.policy?.requireExactMasterHash !== true) fail('requireExactMasterHash must be true');
if (registry.policy?.requireExactWebDerivativeHash !== true) fail('requireExactWebDerivativeHash must be true');

const ids = new Set();
const driveIds = new Set();
const mediaSlugs = new Set();
const placeholders = new Set();
const detailPaths = new Set();
const webPaths = new Set();
const stagingKeys = new Set();
const verified = [];

for (const card of registry.cards) {
  const required = {
    registryId: card.registryId,
    canonicalName: card.canonicalName,
    generation: card.generation,
    seedType: card.seedType,
    driveFileId: card.driveFileId,
    masterFileName: card.masterFileName,
    masterMimeType: card.masterMimeType,
    masterSha256: card.masterSha256,
    webStagingKey: card.webStagingKey,
    webAssetPath: card.webAssetPath,
    webFileName: card.webFileName,
    webMimeType: card.webMimeType,
    webSha256: card.webSha256,
    wordpressSlug: card.wordpressSlug,
    altText: card.altText,
    placeholder: card.placeholder,
    detailPath: card.detailPath
  };
  for (const [field, value] of Object.entries(required)) {
    if (!String(value || '').trim()) fail(`${card.registryId || 'unknown'} missing ${field}`);
  }

  const uniqueFields = [
    [ids, card.registryId, 'registryId'],
    [driveIds, card.driveFileId, 'driveFileId'],
    [mediaSlugs, card.wordpressSlug, 'wordpressSlug'],
    [placeholders, card.placeholder, 'placeholder'],
    [detailPaths, card.detailPath, 'detailPath'],
    [webPaths, card.webAssetPath, 'webAssetPath'],
    [stagingKeys, card.webStagingKey, 'webStagingKey']
  ];
  for (const [set, value, label] of uniqueFields) {
    if (set.has(value)) fail(`duplicate ${label} ${value}`);
    set.add(value);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.registryId)) fail(`${card.registryId} has invalid registryId`);
  if (!/^F[1-9][0-9]*$/.test(card.generation)) fail(`${card.registryId} has invalid generation ${card.generation}`);
  if (!['regular', 'feminized', 'autoflower-regular', 'autoflower-feminized'].includes(card.seedType)) fail(`${card.registryId} has invalid seedType ${card.seedType}`);
  if (!['image/png', 'image/jpeg'].includes(card.masterMimeType)) fail(`${card.registryId} master mime type must be image/png or image/jpeg`);
  if (card.webMimeType !== 'image/jpeg') fail(`${card.registryId} web mime type must be image/jpeg`);
  const masterExtOk = card.masterMimeType === 'image/png' ? /\.png$/i.test(card.masterFileName) : /\.jpe?g$/i.test(card.masterFileName);
  if (!masterExtOk) fail(`${card.registryId} master filename extension does not match masterMimeType`);
  if (!/\.jpe?g$/i.test(card.webFileName)) fail(`${card.registryId} web filename must use a JPEG extension`);
  if (!Number.isInteger(card.masterByteLength) || card.masterByteLength < 1000) fail(`${card.registryId} has invalid masterByteLength`);
  if (!Number.isInteger(card.webByteLength) || card.webByteLength < 1000) fail(`${card.registryId} has invalid webByteLength`);
  if (!Number.isInteger(card.webWidth) || !Number.isInteger(card.webHeight) || card.webWidth < 320 || card.webHeight < 480) fail(`${card.registryId} has invalid web dimensions`);
  if (!/^[a-f0-9]{64}$/.test(card.masterSha256 || '')) fail(`${card.registryId} has invalid master SHA-256`);
  if (!/^[a-f0-9]{64}$/.test(card.webSha256 || '')) fail(`${card.registryId} has invalid web SHA-256`);
  if (!/^__DTF_MEDIA_[A-Z0-9_]+__$/.test(card.placeholder)) fail(`${card.registryId} has invalid placeholder`);
  if (!/^\/[a-z0-9-]+\/$/.test(card.detailPath)) fail(`${card.registryId} has invalid detailPath`);
  if (!/^site\/wordpress\/assets\/genetics\/[a-z0-9-]+\.jpe?g$/.test(card.webAssetPath)) fail(`${card.registryId} has invalid webAssetPath`);
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

  verified.push({ registryId: card.registryId, ...(verifyReviewedWebCard(card, await loadReviewedWebCard(card))) });
}

console.log(JSON.stringify({
  ok: true,
  cardCount: registry.cards.length,
  controlledMasterRecords: registry.cards.map((card) => ({
    registryId: card.registryId,
    driveFileId: card.driveFileId,
    masterMimeType: card.masterMimeType,
    masterByteLength: card.masterByteLength,
    masterSha256: card.masterSha256
  })),
  reviewedWebAssetsVerified: verified
}, null, 2));
