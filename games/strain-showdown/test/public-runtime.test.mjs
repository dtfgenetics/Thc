import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const build = spawnSync(process.execPath, ['games/strain-showdown/scripts/build-browser-bundle.mjs'], { encoding: 'utf8' });
assert.equal(build.status, 0, build.stderr || build.stdout);

const bundlePath = 'site/public-route-patch/games/strain-showdown/data/browser-bundle.json';
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
const app = fs.readFileSync('site/public-route-patch/games/strain-showdown/app.js', 'utf8');
const html = fs.readFileSync('site/public-route-patch/games/strain-showdown/index.html', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/strain-showdown/runtime-v2.css', 'utf8');

assert.equal(bundle.schemaVersion, 1);
assert.equal(bundle.cardCount, 96);
assert.equal(bundle.familyCount, 8);
assert.equal(bundle.cards.length, 96);
assert.equal(bundle.families.length, 8);
for (const family of ['kush', 'haze', 'skunk', 'gas', 'cookies', 'fruit', 'purple', 'frost']) {
  assert.equal(bundle.cards.filter((card) => card.family === family).length, 12, `${family} must have 12 cards`);
}

assert.match(app, /fetch\('\.\/data\/browser-bundle\.json'/);
assert.match(app, /async function loadLegacyData\(\)/);
assert.match(app, /let matchToken = 0;/);
assert.match(app, /token !== matchToken/);
assert.match(app, /function requestRestart\(\)/);
assert.match(app, /restartArmedUntil/);
assert.match(app, /globalThis\.localStorage\?\.setItem/);
assert.match(app, /globalThis\.localStorage\?\.getItem/);
assert.match(app, /class="card[^`]*unplayable|unplayable/);
assert.match(app, /aria-disabled=/);
assert.match(app, /Rival turn in progress/);

assert.match(html, /id="runtimeStatus"/);
assert.match(html, /runtime-v2\.css/);
assert.match(html, /data-selecting="false"/);
assert.match(css, /body\[data-battle-turn="cpu"\]/);
assert.match(css, /\.arena\[data-selecting="true"\]/);
assert.match(css, /\.hand \.card\.unplayable/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /min-width:680px/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);

fs.rmSync(bundlePath, { force: true });
console.log('Strain Showdown bundled runtime, match isolation, restart guard and mobile UI checks passed.');
