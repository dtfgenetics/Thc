import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const runtimeManifestPath = path.join(root, 'site/public-route-patch/games/high-iq/assets/domains/manifest.json');
const batchPath = path.join(root, 'data/game-asset-batches/HIQ-001.json');
const fail = (message) => {
  console.error(`High IQ domain icon validation failed: ${message}`);
  process.exitCode = 1;
};

for (const required of [runtimeManifestPath, batchPath]) {
  if (!fs.existsSync(required)) fail(`missing ${path.relative(root, required)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const runtime = JSON.parse(fs.readFileSync(runtimeManifestPath, 'utf8'));
const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
const expected = [
  'Nutrition & pH',
  'Environment & Climate',
  'Root Zone & Irrigation',
  'Plant Biology',
  'Diagnostics',
  'Photobiology',
  'Plant Physiology',
  'Integrated Pest Management',
  'Genetics & Breeding',
  'Harvest & Postharvest',
];

if (runtime.schemaVersion !== 1) fail('runtime manifest schemaVersion must be 1');
if (runtime.datasetVersion !== '2.4') fail(`runtime manifest datasetVersion must be 2.4, found ${runtime.datasetVersion}`);
if (runtime.batchId !== 'HIQ-001') fail(`runtime manifest batchId must be HIQ-001, found ${runtime.batchId}`);
if (!Array.isArray(runtime.categories) || runtime.categories.length !== 10) fail('runtime manifest must contain exactly 10 categories');

const runtimeCategories = (runtime.categories || []).map((entry) => entry.category);
if (JSON.stringify(runtimeCategories) !== JSON.stringify(expected)) fail(`runtime category order mismatch: ${JSON.stringify(runtimeCategories)}`);

const batchCategories = (batch.assets || []).map((entry) => entry.category);
if (JSON.stringify(batchCategories) !== JSON.stringify(expected)) fail('HIQ-001 batch categories do not match runtime manifest');
if (!batch.runtime?.activeIntegration) fail('HIQ-001 runtime.activeIntegration must be true once runtime icon files are committed');
if (batch.runtime?.runtimeManifest !== 'site/public-route-patch/games/high-iq/assets/domains/manifest.json') fail('HIQ-001 runtime manifest path mismatch');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const entry of runtime.categories || []) {
  if (!entry.assetId || !entry.file || !entry.driveApprovedMasterId) fail(`incomplete runtime record for ${entry.category}`);
  if (!/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) fail(`invalid sha256 for ${entry.category}`);
  const filePath = path.join(root, 'site/public-route-patch/games/high-iq/assets/domains', entry.file);
  if (!fs.existsSync(filePath)) {
    fail(`missing runtime file ${entry.file}`);
    continue;
  }
  const bytes = fs.readFileSync(filePath);
  if (bytes.length !== Number(entry.sizeBytes)) fail(`${entry.file} byte size mismatch`);
  if (sha256(bytes) !== entry.sha256) fail(`${entry.file} sha256 mismatch`);
  const prefix = bytes.subarray(0, Math.min(bytes.length, 512)).toString('utf8');
  if (!prefix.includes('<svg')) fail(`${entry.file} is not an SVG`);
  const batchAsset = (batch.assets || []).find((asset) => asset.assetId === entry.assetId);
  if (!batchAsset) {
    fail(`batch missing ${entry.assetId}`);
    continue;
  }
  if (batchAsset.state !== 'INTEGRATED') fail(`${entry.assetId} must be INTEGRATED`);
  if (batchAsset.driveFile?.fileId !== entry.driveApprovedMasterId) fail(`${entry.assetId} approved Drive ID mismatch`);
  if (batchAsset.driveFile?.sha256 !== entry.sha256) fail(`${entry.assetId} Drive hash mismatch`);
}

if (!process.exitCode) console.log('High IQ domain icon system valid: 10 exact categories, Drive provenance bound, runtime SVG bytes verified.');
