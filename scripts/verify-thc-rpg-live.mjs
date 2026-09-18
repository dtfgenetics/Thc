import fs from 'node:fs';

const site = (process.env.SITE || 'https://dtfseeds.com').replace(/\/$/, '');
const base = `${site}/games/thc-rpg/`;
const expectedRevision = fs.readFileSync('site/public-route-patch/games/thc-rpg/source-revision.txt','utf8')
  .match(/^commit=([0-9a-f]{40})$/m)?.[1];
if (!expectedRevision) throw new Error('Pinned THC RPG revision is missing.');

async function get(path, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(new URL(path, base), {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'DTFSeeds-THC-RPG-live-verifier/1.0' }
    });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

const [html, releaseText, main, styles, revisionText] = await Promise.all([
  get('./', 'THC RPG route'),
  get('./game-release.json', 'THC RPG release manifest'),
  get('./src/main.js', 'THC RPG main runtime'),
  get('./src/styles.css', 'THC RPG styles'),
  get('./source-revision.txt', 'THC RPG source revision')
]);

const release = JSON.parse(releaseText);
if (release.id !== 'thc-rpg') throw new Error('Unexpected THC RPG release id.');
if (release.route !== '/games/thc-rpg/') throw new Error('THC RPG release route drifted.');
if (release.version !== '2.1.0') throw new Error(`Unexpected THC RPG release version: ${release.version}`);
if (release.saveVersion !== 6) throw new Error(`Unexpected THC RPG save version: ${release.saveVersion}`);
if (release.artifact !== 'thc-rpg-production-build') throw new Error('THC RPG artifact marker drifted.');
if (release.promotionGate?.liveVerification !== 'required-before-production-ready') {
  throw new Error('THC RPG live-verification promotion gate drifted.');
}

for (const marker of [
  'THC RPG',
  'SIX-CHAPTER CAMPAIGN',
  './src/main.js',
  './src/styles.css',
  './src/grow-journal-v1.css'
]) {
  if (!html.includes(marker)) throw new Error(`THC RPG HTML missing marker: ${marker}`);
}

for (const marker of [
  "const SAVE_KEY = 'thc-rpg-save'",
  "prefers-reduced-motion: reduce",
  'document.hidden',
  'startUpdateLoop'
]) {
  if (!main.includes(marker)) throw new Error(`THC RPG runtime missing marker: ${marker}`);
}

for (const marker of [
  'touch-action: manipulation',
  'min-height: 44px',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
  'env(safe-area-inset-bottom)'
]) {
  if (!styles.includes(marker)) throw new Error(`THC RPG styles missing production marker: ${marker}`);
}

if (!revisionText.includes(`commit=${expectedRevision}`)) {
  throw new Error(`Live THC RPG source revision does not match pinned revision ${expectedRevision}`);
}
if (!revisionText.includes('repository=dtfgenetics/Thc-rpg')) throw new Error('Live THC RPG source repository marker missing.');

console.log(`THC RPG live verification passed at ${base} (2.1.0, pinned ${expectedRevision}).`);
