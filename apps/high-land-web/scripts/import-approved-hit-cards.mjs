import { existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(process.cwd().endsWith('apps/high-land-web') ? '../..' : '.');
const zipPath = findApprovedZip(repoRoot);
const extractDir = '/tmp/highland_hit_cards_package_import';
const targetRoot = join(repoRoot, 'apps/high-land-web/public/assets/images/cards/hit');
const targetMaster = join(targetRoot, 'master');
const targetVariants = join(targetRoot, 'variants');

if (!zipPath) {
  fail(`Could not find highland_hit_cards_package.zip under ${repoRoot}. Put the ZIP anywhere inside the repo and run this again.`);
}

console.log(`Using approved HIT card ZIP: ${zipPath}`);
rmSync(extractDir, { recursive: true, force: true });
mkdirSync(extractDir, { recursive: true });
execFileSync('unzip', ['-o', zipPath, '-d', extractDir], { stdio: 'inherit' });

const masterDir = findDirectoryNamed(extractDir, 'master');
const variantsDir = findDirectoryNamed(extractDir, 'variants');

if (!masterDir) {
  const pngs = findFiles(extractDir, (path) => path.toLowerCase().endsWith('.png'));
  fail(`ZIP extracted, but no folder named master was found. PNGs found: ${pngs.length}. Expected package structure: highland_hit_cards_package/master/*.png`);
}

const masterPngs = findFiles(masterDir, (path) => path.toLowerCase().endsWith('.png')).sort();
const variantPngs = variantsDir ? findFiles(variantsDir, (path) => path.toLowerCase().endsWith('.png')).sort() : [];

if (masterPngs.length !== 39) {
  fail(`Expected 39 approved master HIT cards, found ${masterPngs.length} in ${masterDir}.`);
}

mkdirSync(targetMaster, { recursive: true });
mkdirSync(targetVariants, { recursive: true });
clearPngs(targetMaster);
clearPngs(targetVariants);

for (const file of masterPngs) copyFileSync(file, join(targetMaster, basename(file)));
for (const file of variantPngs) copyFileSync(file, join(targetVariants, basename(file)));
copyFirstIfFound(extractDir, 'manifest.csv', join(targetRoot, 'manifest.csv'));
copyFirstIfFound(extractDir, 'manifest.json', join(targetRoot, 'manifest.json'));
copyFirstIfFound(extractDir, 'README.md', join(targetRoot, 'README_APPROVED_PACKAGE.md'));

console.log(`Installed ${masterPngs.length} approved master HIT card images.`);
console.log(`Installed ${variantPngs.length} approved variant HIT card images.`);
console.log(`Target: ${targetRoot}`);
console.log('Next: git add apps/high-land-web/public/assets/images/cards/hit && git commit -m "Add approved High Land HIT card artwork" && git push origin main');

function findApprovedZip(root) {
  const matches = findFiles(root, (path) => basename(path).toLowerCase() === 'highland_hit_cards_package.zip');
  return matches[0] ?? null;
}

function findDirectoryNamed(root, targetName) {
  const lowerTarget = targetName.toLowerCase();
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (basename(current).toLowerCase() === lowerTarget) return current;
    for (const entry of safeReadDir(current)) {
      const full = join(current, entry);
      if (safeStat(full)?.isDirectory()) stack.push(full);
    }
  }
  return null;
}

function findFiles(root, predicate) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of safeReadDir(current)) {
      const full = join(current, entry);
      const stats = safeStat(full);
      if (!stats) continue;
      if (stats.isDirectory()) {
        if (shouldSkipDirectory(full)) continue;
        stack.push(full);
      } else if (stats.isFile() && predicate(full)) {
        files.push(full);
      }
    }
  }
  return files;
}

function shouldSkipDirectory(path) {
  const name = basename(path);
  return name === '.git' || name === 'node_modules' || name === 'dist' || name === 'test-results' || name === 'playwright-report';
}

function safeReadDir(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function clearPngs(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry.toLowerCase().endsWith('.png')) rmSync(join(dir, entry), { force: true });
  }
}

function copyFirstIfFound(root, filename, target) {
  const source = findFiles(root, (path) => basename(path) === filename)[0];
  if (!source) return;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
