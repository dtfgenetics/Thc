import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/trichome-trials/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/trichome-trials/app.js', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/trichome-trials/trichome-trials-v2.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/trichome-trials/data/trials.json', 'utf8'));

assert.match(html, /<script id="trichome-trials-data" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.doesNotMatch(html, /type="module"[^>]*app\.js/);
assert.match(html, /trichome-trials-v2\.css/);
assert.match(html, /id="scorecard-progress"/);

const embeddedMatch = html.match(/<script id="trichome-trials-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded judging data must be present');
const embedded = JSON.parse(embeddedMatch[1]);
assert.deepEqual(embedded, canonical, 'public embedded judging data must exactly match the canonical trials deck');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser ES-module imports');
assert.doesNotMatch(app, /fetch\s*\(/, 'public runtime must not depend on browser-time JSON fetches');
assert.doesNotMatch(app, /CSS\.escape/, 'public score controls must not require CSS.escape');
assert.match(app, /let touchedIds = new Set\(\)/);
assert.match(app, /ui\.submit\.disabled = !judging \|\| !allReviewed/);
assert.match(app, /button\[data-score-step\]\[data-category\]/);
assert.match(app, /Review all .* categories before submitting/);
assert.match(app, /globalThis\.crypto\?\.getRandomValues/);
assert.match(app, /globalThis\.history\?\.replaceState/);
assert.match(app, /globalThis\.matchMedia\?\./);
assert.match(app, /navigator\.clipboard\?\.writeText/);

assert.match(visual, /\.score-stepper/);
assert.match(visual, /\.score-row\.unreviewed/);
assert.match(visual, /\.score-row\.reviewed/);
assert.match(visual, /\.scorecard-progress\.complete/);
assert.match(visual, /@media\(max-width:640px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);

console.log('Trichome Trials self-contained runtime and reviewed-scorecard regression checks passed.');
