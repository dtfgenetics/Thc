import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import process from 'node:process';

const batchPath = process.env.GAME_ASSET_MANIFEST || process.argv[2] || '';
const assetId = process.env.GAME_ASSET_ID || process.argv[3] || '';
if (!batchPath || !assetId) {
  throw new Error('Usage: node scripts/recover-approved-game-asset.mjs <batch-manifest.json> <asset-id>');
}

const registry = JSON.parse(await readFile('data/game-asset-production-registry.json', 'utf8'));
const batch = JSON.parse(await readFile(batchPath, 'utf8'));
const fail = (message) => { throw new Error(`${batchPath} [${assetId}]: ${message}`); };

if (batch.schemaVersion !== 1) fail('batch schemaVersion must be 1');
const game = registry.games?.[batch.gameId];
if (!game) fail(`unknown gameId ${batch.gameId}`);
if (batch.owningRepo !== 'dtfgenetics/Thc' || game.repo !== 'dtfgenetics/Thc') {
  fail(`this importer only writes the current dtfgenetics/Thc workspace; owning repo is ${batch.owningRepo || game.repo}`);
}

const asset = (batch.assets || []).find((entry) => entry.assetId === assetId);
if (!asset) fail('assetId is not present in batch.assets');
if (!['APPROVED', 'NORMALIZED', 'OPTIMIZED'].includes(asset.state)) {
  fail(`asset state ${asset.state} is not approved for import`);
}

const source = asset.driveFile;
if (!source?.fileId) fail('asset.driveFile.fileId is required');
if (!source?.sha256 || !/^[a-f0-9]{64}$/i.test(source.sha256)) fail('asset.driveFile.sha256 must be a 64-character SHA-256');
if (!Number(source?.sizeBytes)) fail('asset.driveFile.sizeBytes is required');
if (!source?.mimeType || !source?.extension) fail('asset.driveFile.mimeType and extension are required');

const targetDirectory = String(batch.runtime?.targetDirectory || '');
if (!targetDirectory || targetDirectory.includes('..') || targetDirectory.startsWith('/') || targetDirectory.startsWith('\\')) {
  fail('unsafe or missing batch.runtime.targetDirectory');
}

const routeSegment = String(game.publicRoute || '').replace(/^\/+|\/+$/g, '');
const publicRoot = routeSegment ? `site/public-route-patch/${routeSegment}` : null;
const allowedRoots = [game.repoRuntimeRoot, publicRoot].filter(Boolean);
if (!allowedRoots.some((root) => targetDirectory === root || targetDirectory.startsWith(`${root}/`))) {
  fail(`targetDirectory ${targetDirectory} is outside allowed game roots: ${allowedRoots.join(', ')}`);
}

const extension = String(source.extension).toLowerCase().replace(/^\./, '');
const runtimeFilename = asset.runtimeFilename || `${String(asset.assetId).toLowerCase()}.${extension}`;
if (/[\\/]/.test(runtimeFilename)) fail('runtime filename must be a basename');
const filenameExtension = runtimeFilename.split('.').pop()?.toLowerCase();
if (extension !== filenameExtension) fail(`runtime extension ${filenameExtension} does not match Drive export extension ${extension}`);

const allowedMime = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['svg', 'image/svg+xml'],
]);
if (allowedMime.get(extension) !== source.mimeType) fail(`unsupported or mismatched MIME/extension: ${source.mimeType} / ${extension}`);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const looksLike = (bytes, ext) => {
  if (ext === 'png') return bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (ext === 'jpg' || ext === 'jpeg') return bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (ext === 'webp') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (ext === 'svg') return bytes.toString('utf8', 0, Math.min(bytes.length, 512)).includes('<svg');
  return false;
};

const downloadUrls = [
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(source.fileId)}&export=download&confirm=t`,
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(source.fileId)}&confirm=t`,
];

let bytes = null;
const failures = [];
for (const url of downloadUrls) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(90_000),
      headers: { Accept: `${source.mimeType},image/*,*/*;q=0.8`, 'User-Agent': 'DTFSeeds-Game-Asset-Recovery/1.1' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const candidate = Buffer.from(await response.arrayBuffer());
    if (candidate.length !== Number(source.sizeBytes)) throw new Error(`size ${candidate.length} != ${source.sizeBytes}`);
    if (sha256(candidate).toLowerCase() !== String(source.sha256).toLowerCase()) throw new Error('SHA-256 mismatch');
    if (!looksLike(candidate, extension)) throw new Error(`downloaded bytes do not match ${extension}`);
    bytes = candidate;
    break;
  } catch (error) {
    failures.push(`${url}: ${error.message}`);
  }
}
if (!bytes) fail(`approved Drive export could not be downloaded and validated: ${failures.join(' | ')}`);

const destination = normalize(join(targetDirectory, runtimeFilename));
const targetPrefix = `${normalize(targetDirectory)}${sep}`;
if (!destination.startsWith(targetPrefix)) fail('resolved destination escapes target directory');

await mkdir(dirname(destination), { recursive: true });
try {
  const existing = await readFile(destination);
  if (sha256(existing) !== sha256(bytes)) fail(`destination exists with different bytes: ${destination}`);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await writeFile(destination, bytes);

asset.runtimeFilename = runtimeFilename;
asset.imported = {
  destination,
  sha256: sha256(bytes),
  sizeBytes: bytes.length,
  importedAt: new Date().toISOString(),
  sourceTransport: 'validated-google-drive-direct-download',
};
asset.state = 'INTEGRATED';
await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`);

console.log(JSON.stringify({ batchId: batch.batchId, gameId: batch.gameId, assetId, destination, runtimeFilename, sha256: sha256(bytes), bytes: bytes.length }, null, 2));
