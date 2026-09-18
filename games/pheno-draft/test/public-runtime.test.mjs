import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/pheno-draft/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/pheno-draft/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/pheno-draft/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/pheno-draft/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/pheno-draft/src/engine.mjs', 'utf8');
const baseCss = fs.readFileSync('site/public-route-patch/games/pheno-draft/pheno-draft.css', 'utf8');
const visualCss = fs.readFileSync('site/public-route-patch/games/pheno-draft/pheno-draft-v2.css', 'utf8');

assert.equal(publicEngine, canonicalEngine, 'public Pheno Draft engine must match canonical source');
assert.match(bootstrap, /import\('\.\/runtime\.mjs'\)/);
assert.ok(bootstrap.length < 1500, 'Pheno Draft app.js must remain a thin bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/);
for (const forbidden of ['function createRun(', 'function refreshDraft(', 'function selectParent(', 'function selectPhenotype(', 'function goalFit(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}

assert.match(html, /DTF GENETICS · SELECTION STRATEGY/);
assert.doesNotMatch(html, /GAME LAB/);
assert.match(html, /id="run-code"/);
assert.match(html, /id="refresh-draft"/);
assert.match(html, /id="share-run"/);
assert.match(html, /role="progressbar"/);

assert.match(runtime, /Confirm New Run/);
assert.match(runtime, /copyText\(text\)/);
assert.match(runtime, /Copy failed\. Share run code/);
assert.match(runtime, /aria-keyshortcuts', 'R'/);
assert.match(runtime, /\['1', '2', '3'\]/);
assert.match(runtime, /prefers-reduced-motion: reduce/);

assert.match(visualCss, /grid-template-columns:repeat\(3,minmax\(82vw,1fr\)\)/);
assert.match(visualCss, /scroll-snap-type:x mandatory/);
assert.match(visualCss, /top:calc\(var\(--dtf-global-header-height,74px\) \+ 8px\)/);
assert.match(visualCss, /top:calc\(var\(--dtf-global-header-height,74px\) \+ 94px\)/);
assert.doesNotMatch(visualCss, /position:sticky;top:\.35rem/);
assert.match(baseCss, /@media\(forced-colors:active\)/);
assert.match(visualCss, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(visualCss, /min-height:56px/);

console.log('Pheno Draft canonical engine parity, restart/share safeguards, shortcuts, mobile card rail, and sticky-header contracts passed.');
