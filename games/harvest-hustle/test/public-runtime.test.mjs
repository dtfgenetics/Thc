import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/harvest-hustle/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/harvest-hustle/app.js', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/harvest-hustle/harvest-hustle-v2.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/harvest-hustle/data/shift.json', 'utf8'));

assert.match(html, /<script id="harvest-shift-data" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.doesNotMatch(html, /type="module"[^>]*app\.js/);
assert.match(html, /harvest-hustle-v2\.css/);
assert.match(html, /id="shift-progress-fill"/);
assert.match(html, /id="control-state"/);

const embeddedMatch = html.match(/<script id="harvest-shift-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded shift data must be present');
const embedded = JSON.parse(embeddedMatch[1]);
assert.deepEqual(embedded, canonical, 'public embedded shift data must exactly match canonical shift data');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser ES-module imports');
assert.doesNotMatch(app, /fetch\s*\(/, 'public runtime must not depend on browser-time JSON fetches');
assert.match(app, /function validateData\(/);
assert.match(app, /function createShift\(/);
assert.match(app, /function applyStation\(/);
assert.match(app, /if \(running\) \{[\s\S]*Shift paused/);
assert.match(app, /ui\.start\.textContent = state\.status === 'complete' \? 'Shift Complete' : running \? 'Pause Shift' : state\.elapsed > 0 \? 'Resume Shift' : 'Start Shift'/);
assert.match(app, /ui\.code\.disabled = running/);
assert.match(app, /clockId = window\.setInterval\(settleClock, 250\)/);
assert.match(app, /navigator\.vibrate/);
assert.match(app, /next-station/);
assert.match(app, /document\.addEventListener\('visibilitychange'/);

assert.match(visual, /\.shift-progress/);
assert.match(visual, /\.timer-critical/);
assert.match(visual, /\.combo-hot/);
assert.match(visual, /\.station-button\.next-station/);
assert.match(visual, /@media\(max-width:640px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);

console.log('Harvest Hustle self-contained runtime and arcade UI regression checks passed.');
