import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MANIFEST_PATH = 'site/wordpress/education/outdoor-visual-library-v2/manifest.json';
const EXPECTED_BRAND = 'THC — Teaching Healthy Cultivation';
const EXPECTED_ROUTE = '/learn/outdoor/';
const EXPECTED_ASSET_COUNT = 48;
const EXPECTED_CHAPTERS = 8;
const VALID_STATUSES = new Set(['artwork-needed', 'artwork-in-review', 'approved', 'published']);
const FORBIDDEN_ASSET_BRAND = /\b(?:dtfseeds|dtf\s+genetics)\b/i;
const FORBIDDEN_ASSET_TYPE = /(?:strain[\s_-]*card|genetics[\s_-]*card|seed[\s_-]*pack)/i;

const fail = (message) => { throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(join(ROOT, path), 'utf8'));
const exists = async (path) => {
  try { await access(join(ROOT, path)); return true; } catch { return false; }
};

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label}: required non-empty string`);
}

function validateAsset(asset, chapter, assetIds, filenames) {
  const prefix = `${chapter.chapterId}/${asset?.id || 'unknown'}`;
  for (const key of ['id', 'title', 'type', 'purpose', 'diagnosticUse', 'masterFilename', 'placement', 'status']) {
    requiredString(asset?.[key], `${prefix}.${key}`);
  }

  if (!/^THC-OUT2-\d{3}$/.test(asset.id)) fail(`${prefix}: invalid asset id format`);
  if (assetIds.has(asset.id)) fail(`${prefix}: duplicate asset id`);
  assetIds.add(asset.id);

  if (!/\.png$/i.test(asset.masterFilename)) fail(`${prefix}: masterFilename must be PNG`);
  if (filenames.has(asset.masterFilename)) fail(`${prefix}: duplicate masterFilename ${asset.masterFilename}`);
  filenames.add(asset.masterFilename);

  if (!VALID_STATUSES.has(asset.status)) fail(`${prefix}: unsupported status ${asset.status}`);
  if (!Array.isArray(asset.measurementFocus) || asset.measurementFocus.length < 3 || asset.measurementFocus.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(`${prefix}: measurementFocus must contain at least three usable entries`);
  }

  const assetText = [
    asset.id,
    asset.title,
    asset.type,
    asset.purpose,
    asset.diagnosticUse,
    asset.masterFilename,
    asset.placement,
    ...(asset.measurementFocus || [])
  ].join(' ');
  if (FORBIDDEN_ASSET_BRAND.test(assetText)) fail(`${prefix}: DTFSeeds/DTF Genetics branding is forbidden on THC Outdoor V2 assets`);
  if (FORBIDDEN_ASSET_TYPE.test(assetText)) fail(`${prefix}: strain/genetics/seed-pack artwork is forbidden on Outdoor education assets`);

  if (asset.status !== 'artwork-needed') {
    requiredString(asset.altText, `${prefix}.altText`);
    requiredString(asset.caption, `${prefix}.caption`);
  }
  if (asset.status === 'approved' || asset.status === 'published') {
    if (!asset.review || typeof asset.review !== 'object') fail(`${prefix}: approved/published asset requires review object`);
    for (const key of ['scientificQA', 'visualQA', 'labelSpellingQA', 'measurementUnitQA', 'pagePlacementQA']) {
      if (asset.review[key] !== true) fail(`${prefix}: approved/published asset requires ${key}=true`);
    }
  }
}

const manifest = await readJson(MANIFEST_PATH);
if (manifest?.schemaVersion !== 1) fail('Manifest schemaVersion must be 1');
if (manifest?.id !== 'thc-outdoor-visual-library-v2') fail('Unexpected manifest id');
if (manifest?.brand !== EXPECTED_BRAND) fail(`Manifest brand must be exactly '${EXPECTED_BRAND}'`);
if (manifest?.route !== EXPECTED_ROUTE) fail(`Manifest route must be ${EXPECTED_ROUTE}`);
if (manifest?.assetCount !== EXPECTED_ASSET_COUNT) fail(`Manifest assetCount must be ${EXPECTED_ASSET_COUNT}`);
if (!Array.isArray(manifest.chapters) || manifest.chapters.length !== EXPECTED_CHAPTERS) fail(`Manifest must define ${EXPECTED_CHAPTERS} chapters`);
if (manifest.designSystem?.masterCanvas !== '8.5 x 11 in portrait, 2550 x 3300 px, 300 DPI') fail('Master canvas specification changed unexpectedly');
if (manifest.designSystem?.masterFormat !== 'PNG') fail('Master format must remain PNG');
if (!String(manifest.designSystem?.style || '').includes('no cartoon/vector-card look')) fail('Design system must preserve the no-cartoon/vector-card rule');
if (!String(manifest.designSystem?.diagnosticPolicy || '').includes('look-alikes')) fail('Diagnostic policy must require look-alike comparison');
if (!String(manifest.designSystem?.measurementPolicy || '').includes('No unsupported universal thresholds')) fail('Measurement policy must prohibit unsupported universal thresholds');
if (!Array.isArray(manifest.designSystem?.qaRequired) || manifest.designSystem.qaRequired.length < 5) fail('Manifest must preserve the five-part QA gate');

const chapterIds = new Set();
const assetIds = new Set();
const filenames = new Set();
let totalAssets = 0;
const chapterSummary = [];

const ordered = [...manifest.chapters].sort((a, b) => a.number - b.number);
for (let index = 0; index < ordered.length; index += 1) {
  const spec = ordered[index];
  if (spec.number !== index + 1) fail(`Manifest chapter numbering must be contiguous: expected ${index + 1}, got ${spec.number}`);
  requiredString(spec.chapterId, `manifest.chapters[${index}].chapterId`);
  if (chapterIds.has(spec.chapterId)) fail(`Duplicate chapterId ${spec.chapterId}`);
  chapterIds.add(spec.chapterId);
  if (spec.assetCount !== 6) fail(`${spec.chapterId}: manifest must require exactly six assets`);
  requiredString(spec.path, `${spec.chapterId}.path`);
  if (!(await exists(spec.path))) fail(`${spec.chapterId}: chapter file missing at ${spec.path}`);

  const document = await readJson(spec.path);
  if (document?.schemaVersion !== 1) fail(`${spec.chapterId}: schemaVersion must be 1`);
  if (document?.brand !== EXPECTED_BRAND) fail(`${spec.chapterId}: brand must be exactly '${EXPECTED_BRAND}'`);
  if (document?.chapterId !== spec.chapterId) fail(`${spec.chapterId}: chapterId mismatch in ${spec.path}`);
  requiredString(document.sourceData, `${spec.chapterId}.sourceData`);
  if (!(await exists(document.sourceData))) fail(`${spec.chapterId}: sourceData missing at ${document.sourceData}`);
  if (!Array.isArray(document.assets) || document.assets.length !== spec.assetCount) fail(`${spec.chapterId}: expected ${spec.assetCount} assets`);

  for (const asset of document.assets) validateAsset(asset, document, assetIds, filenames);
  totalAssets += document.assets.length;
  chapterSummary.push({ chapterId: spec.chapterId, assets: document.assets.length, sourceData: document.sourceData });
}

if (totalAssets !== EXPECTED_ASSET_COUNT) fail(`Expected ${EXPECTED_ASSET_COUNT} total assets, found ${totalAssets}`);
if (assetIds.size !== EXPECTED_ASSET_COUNT) fail(`Expected ${EXPECTED_ASSET_COUNT} unique asset IDs, found ${assetIds.size}`);
if (filenames.size !== EXPECTED_ASSET_COUNT) fail(`Expected ${EXPECTED_ASSET_COUNT} unique filenames, found ${filenames.size}`);

const expectedIds = Array.from({ length: EXPECTED_ASSET_COUNT }, (_, i) => `THC-OUT2-${String(i + 1).padStart(3, '0')}`);
const missingIds = expectedIds.filter((id) => !assetIds.has(id));
const unexpectedIds = [...assetIds].filter((id) => !expectedIds.includes(id));
if (missingIds.length || unexpectedIds.length) fail(`Asset sequence mismatch. Missing: ${missingIds.join(', ') || 'none'}; unexpected: ${unexpectedIds.join(', ') || 'none'}`);

console.log(JSON.stringify({
  valid: true,
  library: manifest.id,
  brand: manifest.brand,
  route: manifest.route,
  chapters: chapterSummary.length,
  assets: totalAssets,
  firstAssetId: expectedIds[0],
  lastAssetId: expectedIds.at(-1),
  uniqueFilenames: filenames.size,
  qaRules: manifest.designSystem.qaRequired,
  chapterSummary
}, null, 2));
