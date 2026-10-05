import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const warnings = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`Missing required responsive contract file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function requireMatch(content, regex, message) {
  if (!regex.test(content)) failures.push(message);
}

function gitDiff() {
  const candidates = [
    ['diff', '--unified=2', 'HEAD^1', 'HEAD', '--'],
    ['diff', '--unified=2', 'HEAD^', 'HEAD', '--']
  ];
  for (const args of candidates) {
    try {
      return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {}
  }
  warnings.push('Unable to derive a parent diff; shared-contract checks still ran, but added-line regression checks were skipped.');
  return '';
}

const responsive = read('site/wordpress/assets/responsive-layout-v1.css');
const standard = read('docs/RESPONSIVE_LAYOUT_STANDARD.md');

requireMatch(responsive, /--dtf-layout-gutter\s*:\s*clamp\(/, 'Shared responsive CSS must keep a fluid gutter token.');
requireMatch(responsive, /--dtf-layout-touch\s*:\s*44px/, 'Shared responsive CSS must keep the 44px touch-target token.');
requireMatch(responsive, /@media\s*\(min-width:\s*701px\)\s*and\s*\(max-width:\s*1120px\)/, 'Shared responsive CSS must keep the 701–1120px tablet/compact band.');
requireMatch(responsive, /@media\s*\(max-width:\s*900px\)/, 'Shared responsive CSS must keep the 900px composition breakpoint.');
requireMatch(responsive, /@media\s*\(max-width:\s*700px\)/, 'Shared responsive CSS must keep the 700px phone breakpoint.');
requireMatch(responsive, /@media\s*\(max-width:\s*420px\)/, 'Shared responsive CSS must keep the 420px small-phone breakpoint.');
requireMatch(responsive, /minmax\(0\s*,\s*1fr\)/, 'Shared responsive CSS must retain shrink-safe grid columns.');
requireMatch(responsive, /min-width\s*:\s*0/, 'Shared responsive CSS must retain min-width:0 overflow protection.');
requireMatch(responsive, /overflow-x\s*:\s*auto/, 'Shared responsive CSS must retain local horizontal scrolling for dense content.');
requireMatch(responsive, /100dvh/, 'Shared responsive CSS must account for dynamic mobile viewport height.');

for (const token of ['360', '390', '430', '768', '820', '1024', '1280', '1440']) {
  if (!standard.includes(token)) failures.push(`Responsive standard must retain the ${token}px QA viewport family.`);
}
requireMatch(standard, /844\s*[×x]\s*390/, 'Responsive standard must retain a landscape-phone QA case.');

const criticalHtml = [
  'site/public-route-patch/tools/index.html',
  'site/public-route-patch/games/index.html',
  'site/public-route-patch/games/high-iq/index.html',
  'site/public-route-patch/atlas/index.html',
  'site/public-route-patch/terpene-atlas/index.html'
];
for (const rel of criticalHtml) {
  const html = read(rel);
  if (html && !/<meta\s+name=["']viewport["'][^>]*width=device-width/i.test(html)) {
    failures.push(`${rel} is missing a responsive viewport meta tag.`);
  }
}

const diff = gitDiff();
const added = diff
  .split('\n')
  .filter(line => line.startsWith('+') && !line.startsWith('+++'))
  .map(line => line.slice(1));

for (let i = 0; i < added.length; i += 1) {
  const line = added[i];
  const nearby = added.slice(Math.max(0, i - 2), i + 1).join('\n');
  const exception = /responsive-exception\s*:/i.test(nearby);

  if (!exception && /\b100vh\b/.test(line) && !/100dvh/.test(line)) {
    failures.push('New responsive code must use 100dvh instead of bare 100vh, or document a responsive-exception.');
  }
  if (!exception && /overflow-x\s*:\s*hidden/i.test(line)) {
    failures.push('New responsive code must not hide horizontal overflow instead of fixing its source; document a responsive-exception when clipping is intentional.');
  }

  const width = line.match(/@media[^\{]*(?:max-width|min-width)\s*:\s*(\d+)px/i)?.[1];
  if (width && !['420','700','900','1120','1121'].includes(width) && !exception) {
    warnings.push(`New component breakpoint ${width}px is outside canonical bands; document a responsive-exception if it is intentional.`);
  }
}

const cssRoots = ['site/public-route-patch', 'apps/growlens-web', 'apps/high-land-web'];
const knownBands = new Set([420, 700, 900, 1120, 1121]);
const debt = new Map();

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && /\.css$/i.test(entry.name)) out.push(full);
  }
  return out;
}

for (const relRoot of cssRoots) {
  for (const file of walk(path.join(root, relRoot))) {
    const source = fs.readFileSync(file, 'utf8');
    const re = /@media[^\{]*(?:max-width|min-width)\s*:\s*(\d+)px/gi;
    let match;
    while ((match = re.exec(source))) {
      const width = Number(match[1]);
      if (knownBands.has(width)) continue;
      const before = source.slice(Math.max(0, match.index - 220), match.index);
      if (/responsive-exception\s*:/i.test(before)) continue;
      const rel = path.relative(root, file).replaceAll('\\', '/');
      debt.set(`${rel}:${width}`, (debt.get(`${rel}:${width}`) || 0) + 1);
    }
  }
}
if (debt.size) {
  const examples = [...debt.keys()].slice(0, 20);
  warnings.push(
    `Existing component-breakpoint debt: ${debt.size} file/width combinations. This is migration debt, not a reason to add more undocumented breakpoints. Examples:\n  - ${examples.join('\n  - ')}${debt.size > examples.length ? `\n  - …and ${debt.size - examples.length} more` : ''}`
  );
}

const uniqueFailures = [...new Set(failures)];
const uniqueWarnings = [...new Set(warnings)];

if (uniqueWarnings.length) {
  console.warn('\nResponsive verifier warnings:');
  for (const warning of uniqueWarnings) console.warn(`- ${warning}`);
}

if (uniqueFailures.length) {
  console.error('\nResponsive verifier failed:');
  for (const failure of uniqueFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Responsive layout contract verified. Existing debt observations: ${debt.size}.`);
