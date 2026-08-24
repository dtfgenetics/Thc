import { mkdir, open, readFile, readdir, copyFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import process from 'node:process';

const sourceRoot = process.env.INFOGRAPHIC_SOURCE_DIR || join(process.cwd(), 'site/wordpress/assets/infographics');
const outputRoot = process.env.INFOGRAPHIC_DIR || join(process.cwd(), '.tmp/eligible-infographics');
const exclusionsPath = process.env.INFOGRAPHIC_EXCLUSIONS || join(sourceRoot, 'infographic-exclusions.json');
const recoveryManifestPath = process.env.INFOGRAPHIC_RECOVERY_MANIFEST || join(sourceRoot, 'import-curated-2026-08-19.json');
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-infographic-backups';
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const maxInvalid = Number.parseInt(process.env.INFOGRAPHIC_MAX_INVALID || '10', 10);

const exclusions = JSON.parse(await readFile(exclusionsPath, 'utf8'));
if (!exclusions?.neverUseOnInfographicSurfaces || !Array.isArray(exclusions.excludePathFragments)) {
  throw new Error('Infographic exclusion manifest is missing the required quality policy');
}

function relPosix(file) {
  return relative(sourceRoot, file).split(sep).join('/');
}
function normalized(value = '') {
  return String(value).toLowerCase().replaceAll('\\', '/');
}
function isExcluded(rel) {
  const value = normalized(rel);
  if ((exclusions.allowedExceptions || []).some((item) => value === normalized(item))) return false;
  return exclusions.excludePathFragments.some((fragment) => value.includes(normalized(fragment)));
}

function validateHeaderForExtension(header, extension) {
  const ext = extension.toLowerCase();
  if (ext === '.png') {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return header.length >= 8 && header.subarray(0, 8).equals(signature)
      ? { valid: true }
      : { valid: false, reason: 'PNG extension does not contain a PNG signature' };
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
      ? { valid: true }
      : { valid: false, reason: 'JPEG extension does not contain a JPEG signature' };
  }
  if (ext === '.gif') {
    const signature = header.toString('ascii', 0, 6);
    return header.length >= 6 && (signature === 'GIF87a' || signature === 'GIF89a')
      ? { valid: true }
      : { valid: false, reason: 'GIF extension does not contain a GIF signature' };
  }
  if (ext === '.webp') {
    const riff = header.toString('ascii', 0, 4);
    const webp = header.toString('ascii', 8, 12);
    return header.length >= 12 && riff === 'RIFF' && webp === 'WEBP'
      ? { valid: true }
      : { valid: false, reason: 'WebP extension does not contain RIFF/WEBP container markers' };
  }
  return { valid: false, reason: `Unsupported image extension: ${extension}` };
}

async function validateImageSignature(file) {
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return validateHeaderForExtension(header.subarray(0, bytesRead), extname(file));
  } finally {
    await handle.close();
  }
}

async function loadRecoverySources() {
  try {
    const manifest = JSON.parse(await readFile(recoveryManifestPath, 'utf8'));
    const rows = Array.isArray(manifest?.assets) ? manifest.assets : [];
    const map = new Map();
    for (const row of rows) {
      if (!row?.path || !row?.url) continue;
      const marker = '/infographics/';
      const path = normalized(row.path);
      const offset = path.indexOf(marker);
      const rel = offset >= 0 ? path.slice(offset + marker.length) : path.split('/').pop();
      if (rel) map.set(normalized(rel), { url: row.url });
    }
    return map;
  } catch (error) {
    console.warn(`Recovery manifest unavailable: ${error.message}`);
    return new Map();
  }
}

async function recoverFromManifest(rel, dest, recoverySources) {
  const source = recoverySources.get(normalized(rel));
  if (!source?.url) return { recovered: false, reason: 'no recovery source registered' };
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      headers: { 'user-agent': 'THC-infographic-production/1.0' }
    });
    if (!response.ok) return { recovered: false, reason: `recovery HTTP ${response.status}` };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return { recovered: false, reason: 'recovery source returned an empty body' };
    const signature = validateHeaderForExtension(bytes.subarray(0, 12), extname(rel));
    if (!signature.valid) {
      const contentType = response.headers.get('content-type') || 'unknown';
      return { recovered: false, reason: `${signature.reason}; recovery content-type=${contentType}` };
    }
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
    return { recovered: true, bytes: bytes.length };
  } catch (error) {
    return { recovered: false, reason: `recovery request failed: ${error.message}` };
  }
}

async function walk(dir) {
  const rows = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) rows.push(...await walk(full));
    else if (entry.isFile() && imageExtensions.has(extname(entry.name).toLowerCase())) rows.push(full);
  }
  return rows;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await mkdir(backupRoot, { recursive: true });

const recoverySources = await loadRecoverySources();
const all = (await walk(sourceRoot)).sort();
const eligible = [];
const excluded = [];
const invalid = [];
const recovered = [];
for (const file of all) {
  const rel = relPosix(file);
  if (isExcluded(rel)) {
    excluded.push(rel);
    continue;
  }

  const dest = join(outputRoot, ...rel.split('/'));
  const signature = await validateImageSignature(file);
  if (!signature.valid) {
    const recovery = await recoverFromManifest(rel, dest, recoverySources);
    if (recovery.recovered) {
      eligible.push(rel);
      recovered.push({ path: rel, bytes: recovery.bytes });
      console.log(`Recovered invalid canonical infographic from registered source: ${rel} (${recovery.bytes} bytes)`);
      continue;
    }
    invalid.push({ path: rel, reason: signature.reason, recovery: recovery.reason });
    console.warn(`Quarantined invalid infographic source: ${rel} — ${signature.reason}; ${recovery.reason}`);
    continue;
  }

  eligible.push(rel);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(file, dest);
}

await copyFile(join(sourceRoot, 'placement-rules.json'), join(outputRoot, 'placement-rules.json'));

const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  outputRoot,
  sourceImageCount: all.length,
  eligibleImageCount: eligible.length,
  excludedImageCount: excluded.length,
  recoveredImageCount: recovered.length,
  invalidImageCount: invalid.length,
  excluded,
  recovered,
  invalid,
  policy: 'Reference-only assets are excluded. Invalid canonical binaries are recovered only from the registered curated source when the replacement has the exact expected image signature; otherwise they are quarantined and reported.'
};
const reportPath = join(backupRoot, 'infographic-quality-gate.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (eligible.length < 20) throw new Error(`Quality gate left too few infographic assets: ${eligible.length}`);
if (excluded.length < 1) throw new Error('Quality gate did not exclude any simple/reference images; inspect classification policy');
if (!Number.isFinite(maxInvalid) || maxInvalid < 0) throw new Error(`Invalid INFOGRAPHIC_MAX_INVALID value: ${process.env.INFOGRAPHIC_MAX_INVALID}`);
if (invalid.length > maxInvalid) throw new Error(`Quality gate found too many unrecoverable corrupt or mislabeled image assets: ${invalid.length} > ${maxInvalid}`);
