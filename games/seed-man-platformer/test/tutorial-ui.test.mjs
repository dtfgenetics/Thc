import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);
const [levelsText, ui, css] = await Promise.all([
  readFile(new URL('data/levels-20-v1.json', root), 'utf8'),
  readFile(new URL('campaign-ui-v20.js', publicRoot), 'utf8'),
  readFile(new URL('seed-man.css', publicRoot), 'utf8')
]);

const catalog = JSON.parse(levelsText);
const sproutSteps = catalog.levels.find((entry) => entry.id === '1-1-sprout-steps');
assert.ok(sproutSteps?.layout?.tutorials, 'Sprout Steps authored layout must expose tutorial metadata');
assert.equal(sproutSteps.layout.tutorials.length, 5, 'Sprout Steps should introduce five core actions');
assert.deepEqual(sproutSteps.layout.tutorials.map((entry) => entry.action), ['move','jump','attack','stomp','phenotype']);
assert.deepEqual([...sproutSteps.layout.tutorials].map((entry) => entry.x), [150,560,930,1280,4380]);
assert.match(sproutSteps.layout.tutorials.find((entry) => entry.action === 'stomp')?.text || '', /STOMP.*damage.*bounce/i, 'stomp tutorial should explain damage and bounce');
assert.ok(sproutSteps.layout.tutorials.every((entry) => entry.id && entry.text), 'every tutorial needs a stable id and player-facing text');

assert.match(ui, /seed-man-tutorial-ui-v1/, 'campaign UI must expose tutorial controller version');
assert.match(ui, /dtf-seed-man-tutorial-seen-v1/, 'tutorial dismissals must use a dedicated session key');
assert.match(ui, /sessionStorage\.setItem/, 'tutorial state should be session scoped');
assert.doesNotMatch(ui, /localStorage\.setItem\(TUTORIAL_SESSION_KEY/, 'tutorial dismissals must not become permanent campaign state');
assert.match(ui, /level\.tutorials/, 'tutorial UI must read the active runtime level metadata');
assert.match(ui, /requestAnimationFrame\(tickTutorial\)/, 'tutorial trigger checks should use the game presentation frame loop');
assert.match(ui, /TUTORIAL_PRE_TRIGGER=90/, 'tutorials should begin shortly before their authored marker');
assert.match(ui, /TUTORIAL_POST_TRIGGER=340/, 'tutorials should remain visible through the authored teaching zone');
assert.match(ui, /TUTORIAL_AUTO_DISMISS_MS=5200/, 'tutorials should clear without blocking play');
assert.match(ui, /seedman:tutorial-shown/, 'tutorial UI must emit a presentation event when shown');
assert.match(ui, /seedman:tutorial-dismissed/, 'tutorial UI must emit a presentation event when dismissed');
assert.match(ui, /__SEED_MAN_TUTORIAL_UI__/, 'tutorial controller must expose a small diagnostics/test API');
assert.doesNotMatch(ui, /1-1-sprout-steps/, 'tutorial controller must not hard-code a specific level id');
assert.doesNotMatch(ui, /fire-carrier-intro/, 'tutorial controller must not hard-code encounter ids');

assert.match(css, /\.seed-tutorial\{/, 'tutorial prompt must have a dedicated game UI surface');
assert.match(css, /\.seed-tutorial-dismiss\{/, 'tutorial prompt must include a touch-accessible dismiss control');
assert.match(css, /@media\(max-width:680px\)[\s\S]*\.seed-tutorial\{position:fixed/, 'mobile tutorial prompt must stay above touch controls');
assert.match(css, /bottom:calc\(max\(\.45rem,env\(safe-area-inset-bottom\)\) \+ 82px\)/, 'mobile prompt must respect touch controls and safe area');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'tutorial animation must inherit reduced-motion protection');

assert.match(css, /2026-09-15 playfield-first mobile polish/, 'mobile gameplay UI pass must stay explicitly versioned in the public stylesheet');
assert.match(css, /\.hero>\.eyebrow,\.hero>\.lede,\.hero>#seed-ui-release-marker\{display:none!important\}/, 'mobile view must collapse nonessential hero copy before the playfield');
assert.match(css, /\.hud\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:\.34rem!important;max-height:none!important;overflow:visible!important/, 'mobile HUD must be a compact non-scrolling grid');
assert.match(css, /\.hud span:nth-of-type\(3\),\.hud span:nth-of-type\(5\),\.hud span:nth-of-type\(6\),\.hud span:nth-of-type\(7\)\{display:none!important\}/, 'secondary mobile HUD stats must not crowd the playfield');
assert.match(css, /\.hud button\{margin:0!important;min-height:44px!important/, 'mobile pause and restart controls must remain touch-accessible');
assert.match(css, /@media\(orientation:landscape\) and \(max-height:520px\) and \(pointer:coarse\)/, 'short landscape touch screens need a dedicated playfield-first layout');

console.log('Seed Man authored tutorial and mobile UI contracts passed.');
