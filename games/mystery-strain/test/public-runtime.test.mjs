import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/mystery-strain/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/mystery-strain/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/mystery-strain/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/mystery-strain/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/mystery-strain/src/engine.mjs', 'utf8');
const confirmJs = fs.readFileSync('site/public-route-patch/games/mystery-strain/guess-confirm-v2.js', 'utf8');
const confirmCss = fs.readFileSync('site/public-route-patch/games/mystery-strain/guess-confirm-v2.css', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/mystery-strain/mystery-strain.css', 'utf8');

assert.equal(publicEngine, canonicalEngine, 'public Mystery Strain engine must match canonical source');
assert.match(bootstrap, /import\('\.\/runtime\.mjs'\)/);
assert.ok(bootstrap.length < 1500, 'Mystery Strain app.js must remain a thin bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/);
for (const forbidden of ['function createGame(', 'function askQuestion(', 'function guessStrain(', 'function questionOptions(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}

assert.match(html, /guess-confirm-v2\.css/);
assert.match(html, /guess-confirm-v2\.js/);
assert.match(html, /20 fictional profiles/);
assert.match(html, /Select a candidate, then confirm before a guess is spent/);

assert.match(runtime, /rankedQuestionOptions/);
assert.match(runtime, /informationScore/);
assert.match(runtime, /copyText/);
assert.match(runtime, /Copy failed\. Share case/);
assert.match(runtime, /prefers-reduced-motion: reduce/);

assert.match(confirmJs, /event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*selectCandidate\(button\)/);
assert.match(confirmJs, /allowNextGuess = true/);
assert.match(confirmJs, /Confirm Guess/);
assert.match(confirmJs, /No guess was spent/);
assert.match(confirmJs, /event\.key === 'Escape'/);
assert.match(confirmJs, /event\.key === 'g' \|\| event\.key === 'G'/);
assert.match(confirmJs, /role', 'progressbar'/);

assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(css, /@media\(forced-colors:active\)/);
assert.match(css, /min-height:48px/);
assert.match(confirmCss, /min-height:48px/);
assert.match(confirmCss, /top:calc\(var\(--dtf-global-header-height,74px\) \+ 8px\)/);

console.log('Mystery Strain canonical engine parity, ranked deduction UI, safe guess confirmation, mobile controls, sharing, and accessibility checks passed.');
