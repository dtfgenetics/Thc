import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const checkOnly = process.argv.includes('--check');
const files = [
  'site/public-route-patch/projects/index.html',
  'site/public-route-patch/tools/index.html',
  'site/public-route-patch/games/index.html',
  'site/public-route-patch/games/high-life/index.html',
  'site/public-route-patch/games/high-iq/index.html',
  'site/public-route-patch/games/grower-conversations/index.html',
  'site/public-route-patch/games/seed-man-platformer/index.html',
];

const obsolete = /(<a\b[^>]*href=["']\/tools\/["'][^>]*>)Tools(<\/a>)/gi;
let changed = 0;
const failures = [];

for (const file of files) {
  let source;
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
    continue;
  }

  const matches = [...source.matchAll(obsolete)];
  if (matches.length === 0) {
    if (!/<a\b[^>]*href=["']\/tools\/["'][^>]*>Diagnostic<\/a>/i.test(source)) {
      failures.push(`${file}: /tools/ primary link is neither Tools nor Diagnostic`);
    }
    continue;
  }

  const next = source.replace(obsolete, '$1Diagnostic$2');
  changed += 1;
  if (!checkOnly) await writeFile(file, next);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else if (checkOnly && changed) {
  console.error(`${changed} public-route files still use the obsolete Tools primary-nav label.`);
  process.exitCode = 1;
} else {
  console.log(`${checkOnly ? 'Verified' : 'Normalized'} primary navigation: Diagnostic label is canonical (${changed} file${changed === 1 ? '' : 's'} ${checkOnly ? 'need normalization' : 'updated'}).`);
}
