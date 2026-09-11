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
assert.equal(sproutSteps.layout.tutorials.length, 4, 'Sprout Steps should introduce four core actions');
assert.deepEqual(sproutSteps.layout.tutorials.map((entry) => entry.action), ['move','jump','attack','phenotype']);
assert.deepEqual([...sproutSteps.layout.tutorials].map((entry) => entry.x), [150,560,930,4380]);
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

console.log('Seed Man authored tutorial UI contract passed.');
