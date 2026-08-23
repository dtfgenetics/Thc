import { mkdir, readFile, readdir, copyFile, rm, writeFile } from 'node:fs/promises';
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
for (const file of all) {
  const rel = relPosix(file);
  if (isExcluded(rel)) {
    excluded.push(rel);
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

const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  outputRoot,
  sourceImageCount: all.length,
  eligibleImageCount: eligible.length,
  excludedImageCount: excluded.length,
  excluded,
  policy: 'Excluded assets are reference-only and must not be uploaded, featured, or reused on infographic surfaces.'
};
const reportPath = join(backupRoot, 'infographic-quality-gate.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
