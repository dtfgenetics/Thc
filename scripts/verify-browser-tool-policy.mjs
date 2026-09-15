import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'vendor', 'artifacts']);
const forbidden = /(?:npx\s+playwright|playwright\s+(?:test|install)|@playwright\/test|from\s+['"]playwright['"]|require\(['"]playwright['"]\))/i;
const executableExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.yml', '.yaml']);
const activeRoots = ['.github/workflows', 'scripts', 'apps', 'games'];
const verifierPath = 'scripts/verify-browser-tool-policy.mjs';
const retiredBrowserPaths = [
  'apps/high-land-web/playwright.config.ts',
  'apps/high-land-web/playwright.live.config.ts',
  'apps/high-land-web/e2e',
  'apps/high-land-web/e2e-live',
  'apps/growlens-web/playwright.config.ts',
  'apps/growlens-web/e2e',
  'scripts/verify-grow-doc-browser.mjs',
  'scripts/capture-grow-doc-visual-matrix.mjs',
  'games/root-cause/test/browser-smoke.mjs',
  'games/test/live-game-hub-browser-audit.mjs'
];
const violations = [];

function walk(dir, visitor) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, visitor);
    else visitor(file);
  }
}

for (const relRoot of activeRoots) {
  walk(path.join(root, relRoot), (file) => {
    const rel = path.relative(root, file).replaceAll(path.sep, '/');
    if (rel === verifierPath || !executableExtensions.has(path.extname(file).toLowerCase())) return;
    const content = fs.readFileSync(file, 'utf8');
    if (forbidden.test(content)) violations.push(`${rel}#executable-source`);
  });
}

walk(root, (file) => {
  if (path.basename(file) !== 'package.json') return;
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  for (const [name, command] of Object.entries(pkg.scripts || {})) {
    if (forbidden.test(String(command))) violations.push(`${rel}#scripts.${name}`);
  }
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const name of Object.keys(pkg[section] || {})) {
      if (/playwright/i.test(name)) violations.push(`${rel}#${section}.${name}`);
    }
  }
});

for (const rel of retiredBrowserPaths) {
  if (fs.existsSync(path.join(root, rel))) violations.push(`${rel}#retired-browser-test-path`);
}

const unique = [...new Set(violations)].sort();
if (unique.length) {
  console.error('Browser-tool policy violation: prohibited browser-automation execution/dependency wiring remains in active code.');
  for (const violation of unique) console.error(` - ${violation}`);
  process.exit(1);
}

console.log('Browser-tool policy passed: active workflows, executable source, package manifests, and retired browser-test paths are clean.');
