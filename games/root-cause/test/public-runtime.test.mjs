import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/root-cause/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/root-cause/app.js', 'utf8');
const classicEngine = fs.readFileSync('site/public-route-patch/games/root-cause/engine.js', 'utf8');
const canonicalEngine = fs.readFileSync('games/root-cause/src/engine.mjs', 'utf8');
const publicModuleEngine = fs.readFileSync('site/public-route-patch/games/root-cause/engine.mjs', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/root-cause/root-cause-v2.css', 'utf8');

assert.equal(publicModuleEngine, canonicalEngine, 'public module engine mirror must remain identical to canonical engine.mjs');
assert.match(html, /<script\s+src="\.\/engine\.js"\s+defer><\/script>/i, 'public page must load the classic engine before the controller');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load the controller as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'Root Cause public route must not require ES-module serving');
assert.match(html, /root-cause-v2\.css/i, 'public page must load the V2 case-file visual layer');
assert.match(html, /pattern="\[A-HJ-NP-Z2-9\]\{6\}"/, 'case code field must expose its six-character validity contract');

assert.doesNotMatch(app, /^\s*import\s/m, 'public controller must not import browser modules');
assert.match(app, /const engine = globalThis\.RootCauseEngine;/, 'public controller must bind to the classic engine namespace');
assert.match(app, /globalThis\.crypto\?\.getRandomValues/, 'random code generation must tolerate missing crypto APIs');
assert.match(app, /globalThis\.history\?\.replaceState/, 'shareable case URLs must tolerate restricted history APIs');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'challenge sharing must tolerate unavailable clipboard APIs');
assert.match(app, /function prefersReducedMotion\(/, 'reduced-motion lookup must be guarded');
assert.match(app, /document\.documentElement\.dataset\.caseStatus/, 'case status must drive presentation state');
assert.match(app, /document\.documentElement\.dataset\.caseVisual/, 'case visual type must be exposed to the presentation layer');

assert.doesNotMatch(classicEngine, /^\s*export\s/m, 'classic engine must not contain ESM exports');
assert.doesNotMatch(classicEngine, /^\s*import\s/m, 'classic engine must not contain ESM imports');
assert.match(classicEngine, /globalThis\.RootCauseEngine = Object\.freeze/, 'classic engine must expose one immutable browser namespace');
for (const contract of ['ROOT_CODE_LENGTH','ROOT_ALPHABET','MAX_INSPECTIONS','MAX_GUESSES','createRun','currentCase','inspect','diagnose','advanceCase','normalizeRootCode','isValidRootCode','runGrade']) {
  assert.match(classicEngine, new RegExp(`\\b${contract}\\b`), `classic engine must expose ${contract}`);
}

assert.match(visual, /html\[data-case-status="active"\]/, 'active case must have a presentation state');
assert.match(visual, /html\[data-case-status="solved"\]/, 'solved case must have a presentation state');
assert.match(visual, /html\[data-case-status="failed"\]/, 'failed case must have a presentation state');
assert.match(visual, /html\[data-case-status="complete"\]/, 'completed run must have a presentation state');
assert.match(visual, /\.control-column>\.control-card:first-child\{position:sticky/, 'desktop inspection tray must remain visible while reading a case');
assert.match(visual, /@media\(max-width:1050px\)[\s\S]*position:static/, 'smaller layouts must disable sticky inspection tray behavior');
assert.match(visual, /@media\(hover:none\)/, 'touch layouts must not inherit hover-only motion');
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/, 'V2 case-file polish must respect reduced motion');

console.log('Root Cause classic runtime and V2 case-file presentation regression checks passed.');
