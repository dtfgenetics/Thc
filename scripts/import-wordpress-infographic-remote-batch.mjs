import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifestPath = process.env.BULK_INFOGRAPHIC_MANIFEST || join(root, 'site/wordpress/imports/infographic-bulk-import.json');
const outputDir = process.env.INFOGRAPHIC_SOURCE_DIR || join(root, 'site/wordpress/assets/infographics');
const reportPath = process.env.BULK_IMPORT_REPORT || join(root, '.tmp/infographic-bulk-import-report.json');
const concurrency = Math.max(1, Math.min(8, Number.parseInt(process.env.BULK_IMPORT_CONCURRENCY || '4', 10) || 4));
const maxBytes = Math.max(1_000_000, Number.parseInt(process.env.BULK_IMPORT_MAX_BYTES || String(30 * 1024 * 1024), 10));
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const userAgent = 'DTFSeeds-Bulk-Infographic-Importer/1.0';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertImageMagic(bytes, ext, filename) {
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  const ascii = (start, length) => bytes.subarray(start, start + length).toString('ascii');
  let valid = false;
  if (ext === '.jpg' || ext === '.jpeg') valid = bytes.length >= 3 && starts(0xff, 0xd8, 0xff);
  else if (ext === '.png') valid = bytes.length >= 8 && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  else if (ext === '.gif') valid = bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6));
  else if (ext === '.webp') valid = bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
  if (!valid) throw new Error(`Downloaded bytes do not match ${ext} image format: ${filename}`);
}

function validateFilename(value) {
  if (!value || value !== basename(value)) throw new Error(`filename must be a plain file name without folders: ${value || '<empty>'}`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error(`filename contains unsupported characters: ${value}`);
  const ext = extname(value).toLowerCase();
  if (!allowedExtensions.has(ext)) throw new Error(`Unsupported image extension for ${value}`);
  return ext;
}

async function fetchBytes(asset) {
  const url = new URL(asset.sourceUrl);
  if (url.protocol !== 'https:') throw new Error(`sourceUrl must use HTTPS: ${asset.sourceUrl}`);

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': userAgent, Accept: 'image/*,*/*;q=0.8' },
        signal: AbortSignal.timeout(120_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const length = Number.parseInt(response.headers.get('content-length') || '0', 10);
      if (length > maxBytes) throw new Error(`Content-Length ${length} exceeds ${maxBytes} byte limit`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error('Downloaded file is empty');
      if (bytes.length > maxBytes) throw new Error(`Downloaded ${bytes.length} bytes, exceeding ${maxBytes} byte limit`);
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 1500);
    }
  }
  throw new Error(`Failed to download ${asset.sourceUrl}: ${lastError?.message || 'unknown error'}`);
}

async function importAsset(asset) {
  const ext = validateFilename(asset.filename);
  const bytes = await fetchBytes(asset);
  assertImageMagic(bytes, ext, asset.filename);
  const digest = sha256(bytes);
  if (asset.sha256 && String(asset.sha256).toLowerCase() !== digest) {
    throw new Error(`SHA-256 mismatch for ${asset.filename}: expected ${asset.sha256}, got ${digest}`);
  }

  const destination = join(outputDir, asset.filename);
  let existingHash = null;
  try {
    const existing = await readFile(destination);
    existingHash = sha256(existing);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (existingHash === digest) {
    return { filename: asset.filename, sourceUrl: asset.sourceUrl, sha256: digest, bytes: bytes.length, action: 'reused' };
  }
  if (existingHash && asset.replace !== true) {
    throw new Error(`Refusing to replace existing ${asset.filename}; set replace=true only for an intentional replacement`);
  }

  const temp = `${destination}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, bytes);
  await rename(temp, destination).catch(async (error) => {
    await unlink(temp).catch(() => {});
    throw error;
  });
  const written = await stat(destination);
  if (written.size !== bytes.length) throw new Error(`Write verification failed for ${asset.filename}`);
  return { filename: asset.filename, sourceUrl: asset.sourceUrl, sha256: digest, bytes: bytes.length, action: existingHash ? 'updated' : 'created' };
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

await mkdir(outputDir, { recursive: true });
await mkdir(join(root, '.tmp'), { recursive: true });
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1) throw new Error(`Unsupported bulk infographic manifest schemaVersion: ${manifest.schemaVersion}`);
if (!Array.isArray(manifest.assets)) throw new Error('Bulk infographic manifest must contain an assets array');

const assets = manifest.assets.filter((asset) => asset && asset.enabled !== false);
const seen = new Set();
for (const asset of assets) {
  if (!asset.sourceUrl || !asset.filename) throw new Error('Every enabled asset requires sourceUrl and filename');
  if (seen.has(asset.filename)) throw new Error(`Duplicate filename in bulk import manifest: ${asset.filename}`);
  seen.add(asset.filename);
  validateFilename(asset.filename);
}

const imported = await mapConcurrent(assets, concurrency, importAsset);
const report = {
  schemaVersion: 1,
  batchId: manifest.batchId || null,
  manifestPath,
  outputDir,
  requestedAssets: assets.length,
  created: imported.filter((item) => item.action === 'created').length,
  updated: imported.filter((item) => item.action === 'updated').length,
  reused: imported.filter((item) => item.action === 'reused').length,
  assets: imported
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
