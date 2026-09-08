import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowRoot = path.join(root, '.github', 'workflows');
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'vendor', 'artifacts']);
const forbidden = /(?:npx\s+playwright|playwright\s+(?:test|install)|@playwright\/test|from\s+['"]playwright['"]|require\(['"]playwright['"]\))/i;
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

if (violations.length) {
  console.error('Browser-tool policy violation: Playwright execution/dependency wiring is prohibited in active DTF workflows and package manifests.');
  for (const violation of [...new Set(violations)].sort()) console.error(` - ${violation}`);
  process.exit(1);
}

console.log('Browser-tool policy passed: no Playwright execution or dependency wiring found in active workflows or package manifests.');
