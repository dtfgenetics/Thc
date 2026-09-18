import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/root-cause/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/root-cause/app.js', 'utf8');
const classicEngine = fs.readFileSync('site/public-route-patch/games/root-cause/engine.js', 'utf8');
const canonicalEngine = fs.readFileSync('games/root-cause/src/engine.mjs', 'utf8');
const publicModuleEngine = fs.readFileSync('site/public-route-patch/games/root-cause/engine.mjs', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/root-cause/root-cause-v2.css', 'utf8');
const responsive = fs.readFileSync('site/public-route-patch/games/root-cause/root-cause-responsive-v3.css', 'utf8');

assert.equal(publicModuleEngine, canonicalEngine, 'public module engine mirror must remain identical to canonical engine.mjs');
assert.match(html, /<script\s+src="\.\/engine\.js"\s+defer><\/script>/i, 'public page must load the classic engine before the controller');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load the controller as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'Root Cause public route must not require ES-module serving');
assert.match(html, /root-cause-v2\.css/i, 'public page must load the V2 case-file visual layer');
assert.match(html, /root-cause-responsive-v3\.css/i, 'public page must load the V5 responsive integration layer after the visual layer');
assert.ok(html.indexOf('root-cause-responsive-v3.css') > html.indexOf('root-cause-v2.css'), 'responsive integration must load after V2 visuals');
assert.match(html, /pattern="\[A-HJ-NP-Z2-9\]\{6\}"/, 'case code field must expose its six-character validity contract');

assert.doesNotMatch(app, /^\s*import\s/m, 'public controller must not import browser modules');
assert.match(app, /const engine = globalThis\.RootCauseEngine;/, 'public controller must bind to the classic engine namespace');
assert.match(app, /globalThis\.crypto\?\.getRandomValues/, 'random code generation must tolerate missing crypto APIs');
assert.match(app, /globalThis\.history\?\.replaceState/, 'shareable case URLs must tolerate restricted history APIs');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'challenge sharing must tolerate unavailable clipboard APIs');
assert.match(app, /async function copyText\(/, 'challenge sharing must expose a clipboard fallback helper');
assert.match(app, /document\.execCommand\?\.\('copy'\) === true/, 'challenge sharing must retain a legacy clipboard fallback');
assert.match(app, /Copy failed\. Share case code/, 'share failure must preserve the full manual challenge path');
assert.match(app, /function prefersReducedMotion\(/, 'reduced-motion lookup must be guarded');
assert.match(app, /function revealStackedResult\(/, 'stacked layouts must expose result panels after actions');
assert.match(app, /\(max-width: 1050px\)/, 'result reveal must stay scoped to the one-column layout breakpoint');
assert.match(app, /if \(!stacked \|\| !target\?\.scrollIntoView\) return;/, 'desktop layouts must not be force-scrolled by result reveals');
assert.match(app, /requestAnimationFrame/, 'result reveal must wait for the newly rendered panel state');
assert.match(app, /revealStackedResult\(ui\.evidence\.closest\('\.evidence-card'\) \?\? ui\.evidence\)/, 'inspection results must reveal the evidence panel on stacked layouts');
assert.match(app, /revealStackedResult\(ui\.feedback\)/, 'diagnosis results must reveal feedback on stacked layouts');
assert.match(app, /behavior: prefersReducedMotion\(\) \? 'auto' : 'smooth'/, 'result reveals must respect reduced motion');
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

assert.match(responsive, /body:has\(> \.dtf-global-header\) \.site-bar\s*\{[\s\S]*top:\s*var\(--dtf-global-header-height, 92px\)/, 'Root Cause local site bar must clear the V5 desktop header');
assert.match(responsive, /body:has\(> \.dtf-global-header\) \.control-column > \.control-card:first-child\s*\{[\s\S]*top:\s*calc\(var\(--dtf-global-header-height, 92px\) \+ 88px\)/, 'desktop inspection tray must clear both V5 and local sticky chrome');
assert.match(responsive, /@media \(max-width: 1120px\)[\s\S]*var\(--dtf-global-header-height, 74px\)/, 'tablet Root Cause shell must use the 74px V5 header offset');
assert.match(responsive, /body\.admin-bar:has\(> \.dtf-global-header\) \.site-bar\s*\{[\s\S]*\+ 32px\)/, 'logged-in desktop/tablet editors must clear the WordPress admin bar');
assert.match(responsive, /@media \(max-width: 700px\)[\s\S]*body\.admin-bar:has\(> \.dtf-global-header\) \.site-bar[\s\S]*\+ 46px\)/, 'logged-in phone editors must clear the 46px WordPress admin bar');
assert.match(responsive, /min-height:\s*44px/, 'interactive controls must preserve the minimum touch target');
assert.match(responsive, /min-width:\s*0/, 'responsive shell must use intrinsic-width containment');
assert.match(responsive, /@media \(max-width: 430px\)/, 'narrow-phone shell contract must remain explicit');
assert.doesNotMatch(responsive, /overflow-x\s*:\s*hidden/, 'responsive integration must not hide page-level horizontal overflow regressions');

console.log('Root Cause classic runtime, V2 presentation, and V5 responsive integration regression checks passed.');
