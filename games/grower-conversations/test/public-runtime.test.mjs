import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/grower-conversations/data/prompt-bank.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/grower-conversations/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/grower-conversations/app.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/grower-conversations/grower-conversations-v2.css', 'utf8');

assert.match(html, /<script\s+id="grower-conversations-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed the canonical prompt bank');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');
assert.match(html, /grower-conversations-v2\.css/i, 'public page must load the V2 deck-table visual layer');
assert.match(html, /id="remaining-stat"/, 'deck HUD must expose remaining cards');
assert.match(html, /id="used-stat"/, 'deck HUD must expose used cards');
assert.match(html, /id="pool-stat"/, 'deck HUD must expose the current filtered pool');
assert.match(html, /id="deck-progress"[^>]*role="progressbar"/, 'deck progress must be exposed accessibly');
assert.match(html, /id="card-prompt" tabindex="-1"/, 'drawn prompt must be programmatically focusable');

const embedded = html.match(/<script\s+id="grower-conversations-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embedded, 'embedded prompt bank block missing');
assert.deepEqual(JSON.parse(embedded[1]), canonical, 'embedded public prompt bank must exactly match canonical prompt-bank.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not require browser imports');
assert.doesNotMatch(app, /fetch\(['"]\.\/data\/prompt-bank\.json/i, 'public runtime must not fetch prompt JSON at runtime');
assert.match(app, /function readEmbeddedBank\(/, 'runtime must validate and read embedded prompt data');
assert.match(app, /bank\?\.cardCount !== 96/, 'runtime must enforce the 96-card contract');
assert.match(app, /bank\.categories\[category\]\.length !== 12/, 'runtime must enforce twelve cards per topic');
assert.match(app, /globalThis\.localStorage\?\.setItem/, 'session persistence must tolerate restricted local storage');
assert.match(app, /globalThis\.localStorage\?\.getItem/, 'session restore must tolerate restricted local storage');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'copy behavior must tolerate unavailable clipboard APIs');
assert.match(app, /function safeFocus\(/, 'draw focus must include a compatibility fallback');
assert.match(app, /document\.documentElement\.dataset\.depth/, 'card depth must drive presentation state');
assert.match(app, /ui\.progress\.style\.width/, 'filtered-deck use must drive the progress meter');
assert.match(app, /aria-valuenow/, 'deck progress must remain accessible');
assert.match(app, /event\.key === 'd' \|\| event\.key === 'D'/, 'D keyboard shortcut must draw outside interactive controls');

assert.match(css, /\.card-stage::before,.card-stage::after/, 'deck presentation must include stacked-card depth');
assert.match(css, /\.prompt-card\.draw-pop/, 'draw action must have focused card feedback');
assert.match(css, /html\[data-depth="easy"\]/, 'easy cards must have a distinct depth treatment');
assert.match(css, /html\[data-depth="reflective"\]/, 'reflective cards must have a distinct depth treatment');
assert.match(css, /html\[data-depth="technical"\]/, 'technical cards must have a distinct depth treatment');
assert.match(css, /\.deck-progress/, 'deck completion must have a dedicated visual meter');
assert.match(css, /@media\(hover:none\)/, 'touch devices must not inherit hover-only movement');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'deck polish must respect reduced-motion preferences');

assert.equal(canonical.cardCount, 96, 'canonical card count changed unexpectedly');
assert.equal(Object.keys(canonical.categories).length, 8, 'canonical topic count changed unexpectedly');
for (const [category, prompts] of Object.entries(canonical.categories)) {
  assert.equal(prompts.length, 12, `${category} must retain twelve prompts`);
}

console.log('Grower Conversations embedded runtime, deck progress and V2 visual-state regression checks passed.');
