import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const html = fs.readFileSync('site/public-route-patch/games/high-life/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/high-life/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/high-life/runtime.mjs', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/high-life/high-life-v2.css', 'utf8');
const canonicalEngine = fs.readFileSync('games/high-life/src/engine.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/high-life/engine.mjs', 'utf8');
const canonicalEvents = JSON.parse(fs.readFileSync('games/high-life/data/events.json', 'utf8'));

assert.match(html, /<script id="high-life-events" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js\?v=20260909-visual-v1"><\/script>/);
assert.match(html, /<script defer src="\.\/high-life-enhancements\.js\?v=20260909-visual-v1"><\/script>/);
assert.match(html, /high-life-v2\.css/);
assert.match(html, /class="era-roadmap"/);
assert.match(html, /assets\/high-life-era-journey-v1\.webp/);
assert.match(html, /width="1920" height="768"/);
assert.match(html, /fetchpriority="high"/);

const canonicalArt = fs.readFileSync('games/high-life/assets/high-life-era-journey-v1.webp');
const publicArt = fs.readFileSync('site/public-route-patch/games/high-life/assets/high-life-era-journey-v1.webp');
assert.ok(canonicalArt.length > 150_000, 'High Life key art is suspiciously small or truncated');
assert.equal(canonicalArt.subarray(0, 4).toString('ascii'), 'RIFF');
assert.equal(canonicalArt.subarray(8, 12).toString('ascii'), 'WEBP');
const frameHeader = canonicalArt.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
assert.ok(frameHeader > 0, 'High Life key art is missing its VP8 frame header');
assert.equal(canonicalArt.readUInt16LE(frameHeader + 3) & 0x3fff, 1920, 'High Life key art width drifted');
assert.equal(canonicalArt.readUInt16LE(frameHeader + 5) & 0x3fff, 768, 'High Life key art height drifted');
assert.equal(
  crypto.createHash('sha256').update(canonicalArt).digest('hex'),
  crypto.createHash('sha256').update(publicArt).digest('hex'),
  'canonical and public key art must match'
);

const embeddedMatch = html.match(/<script id="high-life-events" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded High Life event data must be present');
assert.deepEqual(JSON.parse(embeddedMatch[1]), canonicalEvents, 'public embedded High Life events must exactly match canonical events.json');

assert.equal(publicEngine, canonicalEngine, 'public engine.mjs must exactly match the canonical High Life engine');
assert.match(bootstrap, /import\('\.\/runtime\.mjs'\)/, 'app.js must delegate to runtime.mjs');
assert.ok(bootstrap.length < 1500, 'app.js must remain a thin compatibility bootstrap, not another rules engine');
assert.match(runtime, /from '\.\/engine\.mjs';/, 'browser runtime must import the canonical public engine module');
assert.match(runtime, /const SAVE_VERSION = 3/);
assert.match(runtime, /pendingEvent: Boolean\(pendingEvent\)/);
assert.match(runtime, /payload\.version >= 2 && payload\.pendingEvent === true/);
assert.match(runtime, /renderTurnResolution\(state\.history\.at\(-1\)\)/);
assert.match(runtime, /saveGame\(\{ pendingEvent: true \}\)/);
assert.match(runtime, /saveGame\(\{ pendingEvent: false \}\)/);
assert.match(runtime, /state = takeTurn\(state, actionId, events\);[\s\S]*render\(\);[\s\S]*renderTurnResolution\(record\)/);
assert.match(runtime, /storageGet\(/);
assert.match(runtime, /storageSet\(/);
assert.match(runtime, /storageRemove\(/);
assert.match(runtime, /Confirm New Career/);
assert.match(runtime, /Confirm Discard/);
assert.match(runtime, /globalThis\.matchMedia\?\./);

for (const forbidden of [
  'function takeTurn(',
  'function createGame(',
  'function calculateLegacyScore(',
  'function legalActions(',
  'function resolveEvent(',
  'const ACTIONS ='
]) {
  assert.equal(runtime.includes(forbidden), false, `browser runtime must not duplicate canonical rules: ${forbidden}`);
}

assert.match(visual, /\.era-roadmap/);
assert.match(visual, /\.resource-meter/);
assert.match(visual, /\.action-card\.available:hover/);
assert.match(visual, /\.delta-list span\.positive/);
assert.match(visual, /\.danger-arm/);
assert.match(visual, /\.hero-art/);
assert.match(visual, /object-position:66% center/);
assert.match(visual, /@media\(max-width:650px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);

console.log('High Life canonical engine runtime, exact resume, event parity, and three-era visual regression checks passed.');
