import fs from 'node:fs';
import path from 'node:path';

const canonicalRoot = path.resolve('games/seed-man-platformer/data');
const publicRoot = path.resolve('site/public-route-patch/games/seed-man-platformer/data');
const files = [
  'campaign.json',
  'levels-20-v1.json',
  'campaign-20-v1.json',
  'seed-man-art-manifest-v1.json',
  'enemy-catalog-v1.json',
  'boss-catalog-v1.json'
];

fs.mkdirSync(publicRoot, { recursive: true });
for (const file of files) {
  const source = path.join(canonicalRoot, file);
  const target = path.join(publicRoot, file);
  if (!fs.existsSync(source) || fs.statSync(source).size === 0) throw new Error(`Missing canonical Seed Man production data: ${file}`);
  fs.copyFileSync(source, target);
  if (!fs.readFileSync(source).equals(fs.readFileSync(target))) throw new Error(`Seed Man production data sync failed: ${file}`);
}

console.log(JSON.stringify({ ok: true, synced: files }, null, 2));
