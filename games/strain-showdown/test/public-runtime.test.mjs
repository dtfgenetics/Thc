import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const build = spawnSync(process.execPath, ['games/strain-showdown/scripts/build-browser-bundle.mjs'], { encoding: 'utf8' });
assert.equal(build.status, 0, build.stderr || build.stdout);

const bundlePath = 'site/public-route-patch/games/strain-showdown/data/browser-bundle.json';
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
const app = fs.readFileSync('site/public-route-patch/games/strain-showdown/app.js', 'utf8');
const polishV1 = fs.readFileSync('site/public-route-patch/games/strain-showdown/polish-v1.js', 'utf8');
const html = fs.readFileSync('site/public-route-patch/games/strain-showdown/index.html', 'utf8');
const runtimeV2 = fs.readFileSync('site/public-route-patch/games/strain-showdown/runtime-v2.css', 'utf8');
const runtimeV3 = fs.readFileSync('site/public-route-patch/games/strain-showdown/runtime-v3.css', 'utf8');
const runtimeV4 = fs.readFileSync('site/public-route-patch/games/strain-showdown/runtime-v4.css', 'utf8');

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
assert.match(polishV1, /globalThis\.localStorage\?\.getItem/, 'sound preference read must tolerate restricted storage');
assert.match(polishV1, /globalThis\.localStorage\?\.setItem/, 'sound preference write must tolerate restricted storage');
assert.match(polishV1, /typeof rulesDialog\.close === 'function'/, 'Escape-close must tolerate dialog fallbacks');

assert.match(html, /id="runtimeStatus"/);
assert.match(html, /runtime-v2\.css/);
assert.match(html, /runtime-v3\.css/);
assert.match(html, /runtime-v4\.css/);
assert.match(html, /data-selecting="false"/);

assert.match(runtimeV2, /body\[data-battle-turn="cpu"\]/);
assert.match(runtimeV2, /\.arena\[data-selecting="true"\]/);
assert.match(runtimeV2, /\.hand \.card\.unplayable/);
assert.match(runtimeV2, /@media\(max-width:760px\)/);
assert.match(runtimeV2, /min-width:680px/);
assert.match(runtimeV2, /@media\(prefers-reduced-motion:reduce\)/);

assert.match(runtimeV3, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(runtimeV3, /\.lane \.attack-button\{min-height:44px/);
assert.match(runtimeV3, /@media\(max-width:430px\)/);

assert.match(runtimeV4, /min-height:44px/);
assert.match(runtimeV4, /touch-action:manipulation/);
assert.match(runtimeV4, /:focus-visible/);
assert.match(runtimeV4, /\.lane\.valid-target::after\{content:"SELECT"/);
assert.match(runtimeV4, /\.card\.selected::after\{content:"SELECTED"/);
assert.match(runtimeV4, /env\(safe-area-inset-bottom\)/);
assert.match(runtimeV4, /@media\(forced-colors:active\)/);
assert.match(runtimeV4, /@media\(prefers-reduced-motion:reduce\)/);

fs.rmSync(bundlePath, { force: true });
console.log('Strain Showdown bundled runtime, match isolation, restart guard, final responsive UI and accessibility checks passed.');
