import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/high-life/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/high-life/app.js', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/high-life/high-life-v2.css', 'utf8');
const canonicalEvents = JSON.parse(fs.readFileSync('games/high-life/data/events.json', 'utf8'));

assert.match(html, /<script id="high-life-events" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.doesNotMatch(html, /type="module"[^>]*app\.js/);
assert.match(html, /high-life-v2\.css/);
assert.match(html, /class="era-roadmap"/);

const embeddedMatch = html.match(/<script id="high-life-events" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded High Life event data must be present');
assert.deepEqual(JSON.parse(embeddedMatch[1]), canonicalEvents, 'public embedded High Life events must exactly match canonical events.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser ES-module imports');
assert.doesNotMatch(app, /fetch\s*\(/, 'public runtime must not fetch event JSON at startup');
assert.match(app, /const SAVE_VERSION = 2/);
assert.match(app, /pendingEvent: Boolean\(pendingEvent\)/);
assert.match(app, /payload\.version >= 2 && payload\.pendingEvent === true/);
assert.match(app, /renderTurnResolution\(state\.history\.at\(-1\)\)/);
assert.match(app, /saveGame\(\{ pendingEvent: true \}\)/);
assert.match(app, /saveGame\(\{ pendingEvent: false \}\)/);
assert.match(app, /state = takeTurn\(state, actionId, events\);[\s\S]*render\(\);[\s\S]*renderTurnResolution\(record\)/);
assert.match(app, /storageGet\(/);
assert.match(app, /storageSet\(/);
assert.match(app, /storageRemove\(/);
assert.match(app, /Confirm New Career/);
assert.match(app, /Confirm Discard/);
assert.match(app, /className = `resource\$\{value <= 2 \? ' low' : value >= 8 \? ' strong' : ''\}`/);
assert.match(app, /globalThis\.matchMedia\?\./);

assert.match(visual, /\.era-roadmap/);
assert.match(visual, /\.resource-meter/);
assert.match(visual, /\.action-card\.available:hover/);
assert.match(visual, /\.delta-list span\.positive/);
assert.match(visual, /\.danger-arm/);
assert.match(visual, /@media\(max-width:650px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);

console.log('High Life self-contained runtime, exact resume, and career UI regression checks passed.');
