import fs from 'node:fs';

const site = (process.env.SITE || 'https://dtfseeds.com').replace(/\/$/, '');
const base = `${site}/games/ganjumanji/`;
const expectedRevision = fs.readFileSync('site/public-route-patch/games/ganjumanji/source-revision.txt','utf8')
  .match(/^commit=([0-9a-f]{40})$/m)?.[1];
if (!expectedRevision) throw new Error('Pinned Ganjumanji revision is missing.');

async function get(path, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(new URL(path, base), {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'DTFSeeds-Ganjumanji-live-verifier/1.0' }
    });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

const [html, releaseText, revisionText] = await Promise.all([
  get('./', 'Ganjumanji route'),
  get('./game-release.json', 'Ganjumanji release manifest'),
  get('./source-revision.txt', 'Ganjumanji source revision')
]);

const release = JSON.parse(releaseText);
if (release.id !== 'ganjumanji') throw new Error('Unexpected Ganjumanji release id.');
if (release.route !== '/games/ganjumanji/') throw new Error('Ganjumanji release route drifted.');
if (release.version !== '0.4.1') throw new Error(`Unexpected Ganjumanji release version: ${release.version}`);
if (release.status !== 'production-candidate') throw new Error('Ganjumanji release status drifted.');
if (release.campaign?.regions !== 5) throw new Error('Ganjumanji must expose five regions.');
if (release.campaign?.relicSeeds !== 10) throw new Error('Ganjumanji must expose 10 relic seeds.');
if (release.campaign?.saveVersion !== 5) throw new Error('Ganjumanji save version drifted.');
if (JSON.stringify(release.campaign?.pressureCurve) !== JSON.stringify([9,7,5,6,5])) {
  throw new Error('Ganjumanji pressure curve drifted.');
}

for (const marker of [
  'Ganjumanji',
  'Glasshouse Ruins',
  'Seed Throne',
  'Continue from Safe Checkpoint',
  '/games/ganjumanji/assets/'
]) {
  if (!html.includes(marker)) throw new Error(`Ganjumanji HTML missing marker: ${marker}`);
}
if (html.includes('/src/main.ts')) throw new Error('Ganjumanji live HTML references TypeScript source.');

if (!revisionText.includes(`commit=${expectedRevision}`)) {
  throw new Error(`Live Ganjumanji source revision does not match pinned revision ${expectedRevision}`);
}
if (!revisionText.includes('repository=dtfgenetics/GANJUMANJI-The-Lost-Grower-s-Temple')) {
  throw new Error('Live Ganjumanji source repository marker missing.');
}

console.log(`Ganjumanji live verification passed at ${base} (0.4.1, pinned ${expectedRevision}).`);
