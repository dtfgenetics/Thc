import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowRoot = path.join(root, '.github', 'workflows');
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'vendor', 'artifacts']);
const forbidden = /(?:npx\s+playwright|playwright\s+(?:test|install)|@playwright\/test|from\s+['"]playwright['"]|require\(['"]playwright['"]\))/i;
const highLandRetiredBrowserTestPaths = [
  'apps/high-land-web/playwright.config.ts',
  'apps/high-land-web/playwright.live.config.ts',
  'apps/high-land-web/e2e',
  'apps/high-land-web/e2e-live'
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

walk(workflowRoot, (file) => {
  if (!/\.ya?ml$/i.test(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  if (forbidden.test(content)) violations.push(path.relative(root, file));
});

walk(root, (file) => {
  if (path.basename(file) !== 'package.json') return;
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [name, command] of Object.entries(pkg.scripts || {})) {
    if (forbidden.test(String(command))) violations.push(`${path.relative(root, file)}#scripts.${name}`);
  }
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const name of Object.keys(pkg[section] || {})) {
      if (/playwright/i.test(name)) violations.push(`${path.relative(root, file)}#${section}.${name}`);
    }
  }
});

for (const rel of highLandRetiredBrowserTestPaths) {
  if (fs.existsSync(path.join(root, rel))) {
    violations.push(`${rel}#retired-high-land-browser-test-path`);
  }
}

if (violations.length) {
  console.error('Browser-tool policy violation: Playwright execution/dependency wiring and retired High Land browser-test paths are prohibited in active DTF workflows.');
  for (const violation of [...new Set(violations)].sort()) console.error(` - ${violation}`);
  process.exit(1);
}

console.log('Browser-tool policy passed: no Playwright execution, dependency wiring, or retired High Land browser-test paths found.');
