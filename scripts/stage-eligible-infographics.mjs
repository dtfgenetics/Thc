import { mkdir, open, readFile, readdir, copyFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import process from 'node:process';

const sourceRoot = process.env.INFOGRAPHIC_SOURCE_DIR || join(process.cwd(), 'site/wordpress/assets/infographics');
const outputRoot = process.env.INFOGRAPHIC_DIR || join(process.cwd(), '.tmp/eligible-infographics');
const exclusionsPath = process.env.INFOGRAPHIC_EXCLUSIONS || join(sourceRoot, 'infographic-exclusions.json');
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-infographic-backups';
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

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

async function validateImageSignature(file) {
  const extension = extname(file).toLowerCase();
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (extension === '.png') {
      const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      return bytesRead >= 8 && header.subarray(0, 8).equals(signature)
        ? { valid: true }
        : { valid: false, reason: 'PNG extension does not contain a PNG signature' };
    }
    if (extension === '.jpg' || extension === '.jpeg') {
      return bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
        ? { valid: true }
        : { valid: false, reason: 'JPEG extension does not contain a JPEG signature' };
    }
    if (extension === '.gif') {
      const signature = header.toString('ascii', 0, 6);
      return bytesRead >= 6 && (signature === 'GIF87a' || signature === 'GIF89a')
        ? { valid: true }
        : { valid: false, reason: 'GIF extension does not contain a GIF signature' };
    }
    if (extension === '.webp') {
      const riff = header.toString('ascii', 0, 4);
      const webp = header.toString('ascii', 8, 12);
      return bytesRead >= 12 && riff === 'RIFF' && webp === 'WEBP'
        ? { valid: true }
        : { valid: false, reason: 'WebP extension does not contain RIFF/WEBP container markers' };
    }
    return { valid: false, reason: `Unsupported image extension: ${extension}` };
  } finally {
    await handle.close();
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

const all = (await walk(sourceRoot)).sort();
const eligible = [];
const excluded = [];
const invalid = [];
for (const file of all) {
  const rel = relPosix(file);
  if (isExcluded(rel)) {
    excluded.push(rel);
    continue;
  }

  const signature = await validateImageSignature(file);
  if (!signature.valid) {
    invalid.push({ path: rel, reason: signature.reason });
    console.warn(`Quarantined invalid infographic source: ${rel} — ${signature.reason}`);
    continue;
  }

  eligible.push(rel);
  const dest = join(outputRoot, ...rel.split('/'));
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(file, dest);
}

await copyFile(join(sourceRoot, 'placement-rules.json'), join(outputRoot, 'placement-rules.json'));

if (eligible.length < 20) throw new Error(`Quality gate left too few infographic assets: ${eligible.length}`);
if (excluded.length < 1) throw new Error('Quality gate did not exclude any simple/reference images; inspect classification policy');
if (invalid.length > 5) throw new Error(`Quality gate found too many corrupt or mislabeled image assets: ${invalid.length}`);

const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  outputRoot,
  sourceImageCount: all.length,
  eligibleImageCount: eligible.length,
  excludedImageCount: excluded.length,
  invalidImageCount: invalid.length,
  excluded,
  invalid,
  policy: 'Reference-only assets are excluded from infographic surfaces. Invalid or mislabeled image files are quarantined and reported instead of blocking all valid production assets.'
};
const reportPath = join(backupRoot, 'infographic-quality-gate.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
