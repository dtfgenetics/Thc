import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const html = fs.readFileSync('site/public-route-patch/games/high-life/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/high-life/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/high-life/runtime.mjs', 'utf8');
const enhancements = fs.readFileSync('site/public-route-patch/games/high-life/high-life-enhancements.js', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/high-life/high-life-v2.css', 'utf8');
const canonicalEngine = fs.readFileSync('games/high-life/src/engine.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/high-life/engine.mjs', 'utf8');
const canonicalEvents = JSON.parse(fs.readFileSync('games/high-life/data/events.json', 'utf8'));

assert.match(html, /<script id="high-life-events" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js\?v=20260920-era-journey-v3"><\/script>/);
assert.match(html, /<script defer src="\.\/high-life-enhancements\.js\?v=20260917-visual-v2"><\/script>/);
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
assert.match(runtime, /ui\.game\.dataset\.eraState = era/, 'High Life must expose the current era to the journey renderer');
assert.match(runtime, /document\.body\.dataset\.highLifeEra = era/, 'High Life must expose current era state at document level');
assert.match(runtime, /new CustomEvent\('high-life:state'/, 'runtime must publish a safe view-state bridge for classic enhancements');
assert.match(runtime, /publishEnhancementState\(\)/, 'runtime must refresh the enhancement state bridge during render');
assert.match(enhancements, /addEventListener\('high-life:state'/, 'enhancement script must consume the view-state bridge');
assert.doesNotMatch(enhancements, /\bif \(!state\b|\bstate\.history\b|(?<![.\w])resourceLabels\?\./, 'enhancement script must not read ES-module-scoped runtime variables directly');
assert.match(runtime, /function safeFocus\(element\)/, 'High Life should guard focus transitions');
assert.match(runtime, /safeFocus\(ui\.continue\)/, 'resolved turns should move focus to Continue');
assert.match(runtime, /safeFocus\(document\.querySelector\('\.action-card\.available'\)\)/, 'continuing should return focus to the next available action');
assert.doesNotMatch(html, /id="event-panel"[^>]*aria-live=/, 'event panel should not duplicate the dedicated live announcer');
assert.match(html, /id="event-panel"[^>]*aria-labelledby="event-title"/, 'event panel should keep an accessible name');

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
assert.match(visual, /@media\(max-width:480px\)\{\.dashboard\{grid-template-columns:1fr\}/, 'narrow-phone dashboard must collapse to one column');
assert.match(visual, /top:calc\(var\(--dtf-global-header-height,74px\) \+ 8px\)/, 'sticky era roadmap must clear the V5 site header');
assert.match(visual, /High Life three-era journey v3/, 'three-era journey presentation must remain active');
assert.match(visual, /#game-panel\[data-era-state="underground"\]/, 'Underground era must have a dedicated visual state');
assert.match(visual, /#game-panel\[data-era-state="medical"\]/, 'Medical era must have a dedicated visual state');
assert.match(visual, /#game-panel\[data-era-state="legal"\]/, 'Legal era must have a dedicated visual state');
assert.match(visual, /#game-panel\[data-era-state\] \.event-panel/, 'event presentation must inherit the active era state');
assert.match(visual, /\.career-log-panel \.log-toggle\{min-height:44px/, 'career log control must retain a 44px touch target');
assert.match(visual, /scroll-margin-top:calc\(var\(--dtf-global-header-height,92px\) \+ 16px\)/, 'turn-resolution anchors must clear the global header');
assert.doesNotMatch(visual, /\.era-roadmap\{[^}]*position:sticky;top:\.35rem/, 'legacy sticky roadmap offset must not return');
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(visual, /@media\(forced-colors:active\)/);
assert.match(visual, /touch-action:manipulation/);
assert.match(visual, /outline:3px solid var\(--gold\)/);
assert.match(html, /<h2>How to play<\/h2>/);
assert.doesNotMatch(html, /browser prototype/i);
assert.doesNotMatch(html, /Prototype rules/i);
assert.doesNotMatch(html, /playtest values/i);

console.log('High Life canonical engine runtime, exact resume, event parity, V5 mobile layout, and three-era visual regression checks passed.');
