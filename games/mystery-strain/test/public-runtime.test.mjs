import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/mystery-strain/data/strains.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/mystery-strain/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/mystery-strain/app.js', 'utf8');
const confirm = fs.readFileSync('site/public-route-patch/games/mystery-strain/guess-confirm-v2.js', 'utf8');
const confirmCss = fs.readFileSync('site/public-route-patch/games/mystery-strain/guess-confirm-v2.css', 'utf8');

assert.match(html, /<script\s+id="mystery-strain-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed deduction data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.match(html, /<script\s+src="\.\/guess-confirm-v2\.js"\s+defer><\/script>/i, 'public page must load explicit guess confirmation after the core runtime');
assert.match(html, /guess-confirm-v2\.css/i, 'public page must load guess confirmation styles');
assert.match(html, /Select a candidate, then confirm before a guess is spent/, 'candidate panel must disclose the two-step guess flow');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embedded = html.match(/<script\s+id="mystery-strain-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embedded, 'embedded deduction data block missing');
assert.deepEqual(JSON.parse(embedded[1]), canonical, 'embedded public data must exactly match canonical strains.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser imports');
assert.doesNotMatch(app, /fetch\(['"]\.\/data\/strains\.json/i, 'public runtime must not fetch strain JSON at runtime');
assert.match(app, /function readEmbeddedData\(/, 'runtime must read embedded data');
assert.match(app, /function validateData\(/, 'runtime must validate embedded data before play');
assert.match(app, /function createGame\(/, 'runtime must include the deterministic game engine');
assert.match(app, /function rankedQuestionOptions\(/, 'runtime must include information-ranked questions');
assert.match(app, /globalThis\.crypto\?\.getRandomValues/, 'random case generation must tolerate missing crypto APIs');
assert.match(app, /function safeReplaceUrl\(/, 'history mutation must be guarded');
assert.match(app, /function safeFocus\(/, 'focus-with-options must have a compatibility fallback');
assert.match(app, /function prefersReducedMotion\(/, 'reduced-motion lookup must be guarded');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'share behavior must tolerate unavailable clipboard APIs');

assert.match(confirm, /let selectedButton = null;/, 'guess layer must keep staged selection separate from game state');
assert.match(confirm, /let allowNextGuess = false;/, 'only an explicit confirm may pass through to the core guess handler');
assert.match(confirm, /event\.stopImmediatePropagation\(\)/, 'first candidate activation must be intercepted before it can spend a guess');
assert.match(confirm, /function selectCandidate\(/, 'candidate activation must stage a guess');
assert.match(confirm, /confirm\.addEventListener\('click'/, 'guess must have a separate confirmation action');
assert.match(confirm, /target\.click\(\)/, 'confirmation must deliberately forward exactly one candidate activation to the tested core handler');
assert.match(confirm, /function clearSelection\(/, 'staged guesses must be cancellable');
assert.match(confirm, /event\.key === 'Escape'/, 'Escape must cancel a staged guess without spending it');
assert.match(confirm, /questions\?\.addEventListener\('click'/, 'asking a question must clear any staged guess');
assert.match(confirm, /aria-pressed/, 'candidate selection state must be exposed accessibly');
assert.match(confirm, /candidate-progress/, 'candidate elimination progress must be rendered');
assert.match(confirm, /MutationObserver/, 'progress and selection state must stay synchronized after core rerenders');

assert.match(confirmCss, /\.guess-confirm-bar/);
assert.match(confirmCss, /\.candidate-card\.guess-selected/);
assert.match(confirmCss, /\.candidate-progress-track/);
assert.match(confirmCss, /@media\(max-width:520px\)/);
assert.match(confirmCss, /@media\(prefers-reduced-motion:reduce\)/);

assert.equal(canonical.questions.length, 12, 'canonical deduction question count changed unexpectedly');
assert.equal(canonical.strains.length, 20, 'canonical fictional profile count changed unexpectedly');
assert.equal(new Set(canonical.questions.map((item) => item.id)).size, 12, 'question ids must be unique');
assert.equal(new Set(canonical.strains.map((item) => item.id)).size, 20, 'profile ids must be unique');

console.log('Mystery Strain public runtime and explicit guess confirmation regression checks passed.');
