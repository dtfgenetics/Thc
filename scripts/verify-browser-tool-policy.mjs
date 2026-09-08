import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowRoot = path.join(root, '.github', 'workflows');
const packageFiles = [
  path.join(root, 'package.json'),
  path.join(root, 'apps', 'high-land-web', 'package.json'),
];

const forbidden = /(?:npx\s+playwright|playwright\s+(?:test|install)|@playwright\/test|from\s+['"]playwright['"]|require\(['"]playwright['"]\))/i;
const violations = [];

for (const entry of fs.readdirSync(workflowRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
  const file = path.join(workflowRoot, entry.name);
  const content = fs.readFileSync(file, 'utf8');
  if (forbidden.test(content)) violations.push(path.relative(root, file));
}

for (const file of packageFiles) {
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [name, command] of Object.entries(pkg.scripts || {})) {
    if (forbidden.test(String(command))) violations.push(`${path.relative(root, file)}#scripts.${name}`);
  }
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(pkg[section] || {})) {
      if (/playwright/i.test(name)) violations.push(`${path.relative(root, file)}#${section}.${name}`);
    }
  }
}

if (violations.length) {
  console.error('Browser-tool policy violation: Playwright execution/dependency wiring is prohibited in active DTF workflows.');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log('Browser-tool policy passed: no Playwright execution or dependency wiring found in active workflows/package entrypoints.');
