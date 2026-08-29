import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/strain-match/data/decks.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/strain-match/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/strain-match/app.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/strain-match/strain-match.css', 'utf8');

assert.match(html, /<script\s+id="strain-match-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed deck data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embeddedMatch = html.match(/<script\s+id="strain-match-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embeddedMatch, 'embedded Strain Match data block missing');
assert.deepEqual(JSON.parse(embeddedMatch[1]), canonical, 'embedded public data must exactly match canonical decks.json');

assert.doesNotMatch(app, /fetch\(['"]\.\/data\/decks\.json/i, 'public runtime must not fetch deck JSON at runtime');
assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not require browser imports');
assert.match(app, /function readEmbeddedData\(/, 'runtime must read embedded data');
assert.match(app, /function isBetterResult\(/, 'runtime must compare complete best results');
assert.match(app, /let roundToken = 0;/, 'round token must isolate delayed mismatch callbacks');
assert.match(app, /const token = roundToken;/, 'mismatch callback must capture current round token');
assert.match(app, /if \(token !== roundToken\) return;/, 'stale mismatch callback must be ignored after reset');
assert.match(app, /document\.addEventListener\('visibilitychange'/, 'runtime must pause timing when the page is hidden');
assert.match(app, /pauseTimer\('Timer paused while hidden'\)/, 'hidden-page timer pause must be explicit');
assert.match(app, /resumeTimer\(\)/, 'visible page must resume an active round timer');
assert.match(app, /elapsedMs/, 'timer must accumulate only visible play time');
assert.match(app, /function requestRestart\(/, 'active rounds must use guarded restart behavior');
assert.match(app, /restartArmedUntil/, 'restart must require a second confirmation once progress exists');
assert.match(app, /classList\.add\('mismatch'\)/, 'mismatch feedback class must be applied');
assert.match(app, /classList\.add\('matched', 'match-pop'\)/, 'match success feedback class must be applied');
assert.match(app, /aria-pressed/, 'card reveal state must be exposed accessibly');

assert.match(css, /\.match-card\.mismatch/);
assert.match(css, /@keyframes mismatch-nudge/);
assert.match(css, /\.match-card\.match-pop/);
assert.match(css, /\.primary-control\[data-armed=true\]/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);

for (const deck of canonical.decks) {
  assert.equal(deck.pairs.length, 8, `${deck.id} must keep eight pairs`);
  assert.equal(new Set(deck.pairs.map((pair) => pair.id)).size, 8, `${deck.id} pair ids must remain unique`);
}

console.log('Strain Match public runtime, visible-play timer, round isolation and feedback checks passed.');
