import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || 'site/public-route-patch/games/seed-man-platformer');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error(`Seed Man entrypoint missing: ${indexPath}`);

const index = fs.readFileSync(indexPath, 'utf8');
const localReferences = new Set();
for (const match of index.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
  const value = match[1];
  if (!value.startsWith('./')) continue;
  const clean = value.slice(2).split(/[?#]/, 1)[0];
  if (clean) localReferences.add(clean);
}

let scriptsChecked = 0;
for (const rel of localReferences) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`Seed Man referenced file missing: ${rel}`);
  if (rel.endsWith('.js')) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (check.status !== 0) throw new Error(`Seed Man JavaScript syntax failure: ${rel}\n${check.stderr || check.stdout}`);
    scriptsChecked += 1;
  }
}

let dataFiles = 0;
const dataRoot = path.join(root, 'data');
if (fs.existsSync(dataRoot)) {
  for (const entry of fs.readdirSync(dataRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    JSON.parse(fs.readFileSync(path.join(dataRoot, entry.name), 'utf8'));
    dataFiles += 1;
  }
}

console.log(JSON.stringify({
  ok: true,
  verifier: 'seed-man-open-runtime',
  scriptsChecked,
  referencedFiles: localReferences.size,
  dataFiles,
  fixedCampaignContract: false,
  fixedRendererContract: false,
  fixedArtContract: false
}));
