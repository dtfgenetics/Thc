import fs from 'node:fs';

const triggerPath = 'site/public-route-patch/games/seed-man-platformer/.deploy-trigger';
const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';
const uiPath = 'site/public-route-patch/games/seed-man-platformer/seed-man-ui-v3.js';

for (const file of [triggerPath, indexPath, compatPath, uiPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man release-version input: ${file}`);
}

const trigger = fs.readFileSync(triggerPath, 'utf8');
const requestedRelease = trigger.match(/^release=(\d{8}-r\d+)$/m)?.[1];
if (!requestedRelease) throw new Error('Seed Man deploy trigger is missing a valid release=YYYYMMDD-rN marker.');

let index = fs.readFileSync(indexPath, 'utf8');
const currentRelease = index.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
if (!currentRelease) throw new Error('Seed Man index is missing dtf-sprout-release.');

if (currentRelease !== requestedRelease) {
  index = index.split(currentRelease).join(requestedRelease);
  fs.writeFileSync(indexPath, index);
}

let compat = fs.readFileSync(compatPath, 'utf8');
compat = compat.replace(/const RELEASE = '\d{8}-r\d+';/, `const RELEASE = '${requestedRelease}';`);
fs.writeFileSync(compatPath, compat);

let ui = fs.readFileSync(uiPath, 'utf8');
ui = ui.replace(/\|\| '\d{8}-r\d+';/, `|| '${requestedRelease}';`);
fs.writeFileSync(uiPath, ui);

const synchronizedIndex = fs.readFileSync(indexPath, 'utf8');
for (const required of [
  `name="dtf-sprout-release" content="${requestedRelease}"`,
  `seed-man.css?v=${requestedRelease}`,
  `canvas-compat-v1.js?v=${requestedRelease}`,
  `campaign-v1.js?v=${requestedRelease}`,
  `app.js?v=${requestedRelease}`,
  `seed-man-production-art.js?v=${requestedRelease}`,
  `gameplay-v2.js?v=${requestedRelease}`,
  `world-five-v1.js?v=${requestedRelease}`,
  `seed-man-ui-v3.js?v=${requestedRelease}`,
  `input-guard-v1.js?v=${requestedRelease}`
]) {
  if (!synchronizedIndex.includes(required)) throw new Error(`Seed Man release synchronization missing index marker: ${required}`);
}

if (!fs.readFileSync(compatPath, 'utf8').includes(`const RELEASE = '${requestedRelease}';`)) {
  throw new Error('Seed Man canvas compatibility release did not synchronize.');
}
if (!fs.readFileSync(uiPath, 'utf8').includes(`|| '${requestedRelease}';`)) {
  throw new Error('Seed Man UI fallback release did not synchronize.');
}

console.log(JSON.stringify({
  ok: true,
  previousRelease: currentRelease,
  release: requestedRelease,
  indexSynchronized: true,
  compatSynchronized: true,
  uiFallbackSynchronized: true
}, null, 2));