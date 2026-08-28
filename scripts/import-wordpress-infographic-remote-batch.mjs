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
const requireAllRemoteAssets = /^(1|true|yes)$/i.test(process.env.BULK_IMPORT_REQUIRE_ALL || 'false');
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const userAgent = 'DTFSeeds-Bulk-Infographic-Importer/1.1';

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

function remoteError(asset, message, status = 0) {
  const error = new Error(`Failed to download ${asset.sourceUrl}: ${message}`);
  error.status = status;
  return error;
}

async function fetchBytes(asset) {
  const url = new URL(asset.sourceUrl);
  if (url.protocol !== 'https:') throw new Error(`sourceUrl must use HTTPS: ${asset.sourceUrl}`);

  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': userAgent, Accept: 'image/*,*/*;q=0.8' },
        signal: AbortSignal.timeout(120_000)
      });
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        lastError = remoteError(asset, `HTTP ${response.status}`, response.status);
        if (!retryable || attempt === 4) throw lastError;
        await sleep(Math.min(8000, attempt * 1800));
        continue;
      }
      const length = Number.parseInt(response.headers.get('content-length') || '0', 10);
      if (length > maxBytes) throw new Error(`Content-Length ${length} exceeds ${maxBytes} byte limit`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error('Downloaded file is empty');
      if (bytes.length > maxBytes) throw new Error(`Downloaded ${bytes.length} bytes, exceeding ${maxBytes} byte limit`);
      return bytes;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
      if (!retryable || attempt === 4) break;
      await sleep(Math.min(8000, attempt * 1800));
    }
  }
  throw remoteError(asset, lastError?.message || 'unknown error', Number(lastError?.status || 0));
}

async function readExistingCanonical(destination, ext, asset) {
  try {
    const existing = await readFile(destination);
    assertImageMagic(existing, ext, asset.filename);
    const digest = sha256(existing);
    if (asset.sha256 && String(asset.sha256).toLowerCase() !== digest) {
      throw new Error(`Existing canonical SHA-256 mismatch for ${asset.filename}: expected ${asset.sha256}, got ${digest}`);
    }
    return { bytes: existing, digest };
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function importAsset(asset) {
  const ext = validateFilename(asset.filename);
  const destination = join(outputDir, asset.filename);
  let bytes;
  try {
    bytes = await fetchBytes(asset);
  } catch (error) {
    const existing = await readExistingCanonical(destination, ext, asset).catch(() => null);
    if (existing) {
      return {
        filename: asset.filename,
        sourceUrl: asset.sourceUrl,
        sha256: existing.digest,
        bytes: existing.bytes.length,
        action: 'reused',
        remoteUnavailable: true,
        warning: error?.message || String(error)
      };
    }
    return {
      filename: asset.filename,
      sourceUrl: asset.sourceUrl,
      action: 'quarantined',
      remoteUnavailable: true,
      error: error?.message || String(error)
    };
  }

  assertImageMagic(bytes, ext, asset.filename);
  const digest = sha256(bytes);
  if (asset.sha256 && String(asset.sha256).toLowerCase() !== digest) {
    return {
      filename: asset.filename,
      sourceUrl: asset.sourceUrl,
      sha256: digest,
      bytes: bytes.length,
      action: 'quarantined',
      error: `SHA-256 mismatch: expected ${asset.sha256}, got ${digest}`
    };
  }

  let existingHash = null;
  try {
    const existing = await readFile(destination);
    assertImageMagic(existing, ext, asset.filename);
    existingHash = sha256(existing);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (existingHash === digest) {
    return { filename: asset.filename, sourceUrl: asset.sourceUrl, sha256: digest, bytes: bytes.length, action: 'reused' };
  }
  if (existingHash && asset.replace !== true) {
    return {
      filename: asset.filename,
      sourceUrl: asset.sourceUrl,
      sha256: digest,
      bytes: bytes.length,
      action: 'quarantined',
      error: `Refusing to replace existing ${asset.filename}; set replace=true only for an intentional replacement`
    };
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
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        results[index] = {
          filename: items[index]?.filename || null,
          sourceUrl: items[index]?.sourceUrl || null,
          action: 'quarantined',
          error: error?.message || String(error)
        };
      }
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
const quarantined = imported.filter((item) => item.action === 'quarantined');
const report = {
  schemaVersion: 1,
  batchId: manifest.batchId || null,
  manifestPath,
  outputDir,
  status: quarantined.length ? 'partial' : 'complete',
  requestedAssets: assets.length,
  created: imported.filter((item) => item.action === 'created').length,
  updated: imported.filter((item) => item.action === 'updated').length,
  reused: imported.filter((item) => item.action === 'reused').length,
  quarantined: quarantined.length,
  requireAllRemoteAssets,
  assets: imported
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (quarantined.length) {
  console.warn(`Quarantined ${quarantined.length} unavailable or invalid remote infographic asset(s); canonical assets and the remaining education pipeline may continue.`);
  for (const item of quarantined) console.warn(`- ${item.filename || '<unknown>'}: ${item.error || 'unavailable'}`);
  if (requireAllRemoteAssets) {
    throw new Error(`Bulk infographic intake requires every remote asset, but ${quarantined.length} asset(s) were quarantined.`);
  }
}
