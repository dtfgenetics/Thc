import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/strain-match/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/strain-match/app.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/strain-match/strain-match.css', 'utf8');
const canonical = fs.readFileSync('games/strain-match/data/decks.json', 'utf8').trim();
const publicCopy = fs.readFileSync('site/public-route-patch/games/strain-match/data/decks.json', 'utf8').trim();

assert.equal(publicCopy, canonical, 'public Strain Match deck data must match canonical source');
const data = JSON.parse(canonical);
assert.equal(data.decks.length, 4);
assert.ok(data.decks.every((deck) => deck.pairs.length === 8));

assert.match(html, /id="moves"/);
assert.match(html, /id="time"/);
assert.match(html, /id="pairs"/);
assert.match(html, /id="streak"/);
assert.match(html, /id="best"/);
assert.match(html, /id="restart"/);
assert.match(html, /id="complete"/);

assert.match(app, /document\.addEventListener\('visibilitychange'/);
assert.match(app, /Timer paused while hidden/);
assert.match(app, /Confirm restart/);
assert.match(app, /dtf-strain-match-best-/);
assert.match(app, /isBetterResult/);
assert.match(app, /completePanel\.focus/);
assert.match(app, /prefers-reduced-motion: reduce/);
assert.match(app, /aria-busy/);
assert.match(app, /aria-pressed/);

assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
assert.match(css, /min-height:44px/);
assert.match(css, /touch-action:manipulation/);
assert.match(css, /@media\(max-width:720px\)/);
assert.match(css, /@media\(max-width:440px\)/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(css, /@media\(forced-colors:active\)/);
assert.match(css, /outline:3px solid var\(--gold\)/);

console.log('Strain Match deck parity, five-stat HUD, timer pause, restart safety, best score, completion focus, mobile layout, and accessibility checks passed.');
