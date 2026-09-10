import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'site/public-route-patch/games/seed-man-platformer');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  throw new Error(`seed-man-bundle-missing:${root}`);
}

for (const rel of ['index.html']) {
  if (!exists(rel) || fs.statSync(path.join(root, rel)).size === 0) {
    throw new Error(`missing-or-empty:${rel}`);
  }
}

const index = read('index.html');
const localReferences = new Set();
for (const match of index.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
  const value = match[1];
  if (!value.startsWith('./')) continue;
  const clean = value.slice(2).split(/[?#]/, 1)[0];
  if (clean) localReferences.add(clean);
}

for (const rel of localReferences) {
  if (!exists(rel)) throw new Error(`referenced-file-missing:${rel}`);
  if (fs.statSync(path.join(root, rel)).size === 0) throw new Error(`referenced-file-empty:${rel}`);
}

const dataRoot = path.join(root, 'data');
let parsedJson = 0;
if (fs.existsSync(dataRoot)) {
  for (const entry of fs.readdirSync(dataRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const rel = path.posix.join('data', entry.name);
    try {
      JSON.parse(read(rel));
      parsedJson += 1;
    } catch (error) {
      throw new Error(`invalid-json:${rel}:${error.message}`);
    }
  }
}

console.log(JSON.stringify({
  ok: true,
  root,
  referencedFiles: localReferences.size,
  parsedJson,
  architectureLocked: false,
  rendererLocked: false,
  campaignLocked: false,
  artLocked: false
}));
