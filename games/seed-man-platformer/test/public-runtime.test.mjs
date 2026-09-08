import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPlayer as createCanonicalPlayer, stepPlayer as stepCanonicalPlayer } from '../src/physics.mjs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [canonicalLevelText, publicLevelText, html, app, css, productionArt, spriteRuntime] = await Promise.all([
  readFile(new URL('data/level-01.json', root), 'utf8'),
  readFile(new URL('data/level-01.json', publicRoot), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('app.js', publicRoot), 'utf8'),
  readFile(new URL('seed-man.css', publicRoot), 'utf8'),
  readFile(new URL('seed-man-production-art.js', publicRoot), 'utf8'),
  readFile(new URL('seed-man-sprite-runtime-v2.js', publicRoot), 'utf8')
]);

const canonicalLevel = JSON.parse(canonicalLevelText);
assert.deepStrictEqual(JSON.parse(publicLevelText), canonicalLevel, 'public legacy compatibility level must match canonical level-01.json');
assert.equal(canonicalLevel.worldWidth, 7800);
assert.equal(canonicalLevel.pickups.length, 24);
assert.equal(canonicalLevel.checkpoints.length, 3);
assert.ok(canonicalLevel.powerups.length >= 7);

assert.doesNotMatch(html, /<script[^>]+type=["']module["']/i, 'public runtime must not depend on module-script MIME handling');
assert.match(html, /<script\s+src=["']\.\/app\.js\?v=[^"']+["']\s+defer><\/script>/i, 'public runtime should use a versioned deferred classic script');
assert.match(html, /JUMP ×2/, 'touch UI must advertise the double-jump control');
assert.match(html, /id=["']power-count["']/, 'HUD must expose active power-up state');
assert.match(html, /id=["']jump-count["']/, 'HUD must expose double-jump readiness');

const levelMatch = html.match(/<script\s+id=["']seed-man-level["']\s+type=["']application\/json["']>\s*([\s\S]*?)\s*<\/script>/i);
assert.ok(levelMatch, 'public page must embed a compatibility level payload');

assert.doesNotMatch(app, /^\s*import\s/m, 'public app.js must be self-contained');
assert.doesNotMatch(app, /fetch\s*\(/i, 'public app.js must not fetch runtime data');
assert.match(app, /doubleJumpSpeed:\s*590/, 'public runtime must contain the stronger double jump');
assert.match(app, /groundAcceleration:\s*2600/, 'public runtime must include progressive ground acceleration');
assert.match(app, /jumpCutGravityMultiplier:\s*2\.35/, 'public runtime must include variable jump-height gravity');
assert.match(app, /maxAirJumps:\s*1/, 'public runtime must preserve one mid-air jump');
assert.match(app, /function\s+approach\s*\(/, 'public runtime must include acceleration/deceleration helper');
assert.match(app, /function\s+collectPowerup\s*\(/, 'public runtime must include power-up collection');
assert.match(app, /function\s+guardedReset\s*\(/, 'active runs should guard destructive restart');
assert.match(app, /function\s+drawPowerup\s*\(/, 'power-ups must be visible in the canvas renderer');
assert.match(app, /function\s+drawProgressRail\s*\(/, 'expanded level needs visible course progress');
assert.match(app, /function\s+readEmbeddedLevel\s*\(/, 'public runtime should read embedded level data');
assert.match(app, /function\s+writeBest\s*\(/, 'public runtime should guard best-time persistence');
assert.match(app, /function\s+focusCanvas\s*\(/, 'public runtime should guard canvas focus');
assert.match(app, /function\s+cameraBlend\s*\(/, 'camera smoothing must be time-based');
assert.match(app, /Math\.exp\(-CAMERA_FOLLOW_RATE/, 'camera smoothing should use elapsed frame time');
assert.match(app, /jumpHeld:\s*input\.jumpHeld/, 'held jump state must reach fixed-step physics');
assert.match(app, /lostpointercapture/, 'touch controls should clear held input when pointer capture ends');
assert.doesNotMatch(app, /addEventListener\(['"]pointerleave['"]/, 'captured touch movement must not cancel on pointer leave');
assert.match(css, /position:sticky/, 'mobile touch controls should remain reachable');
assert.match(css, /min-height:72px/, 'mobile touch targets should remain large enough');

// Approved atlas renderer is the visual source of truth; compatibility sprite runtimes must not replace it.
assert.match(productionArt, /seed-man-approved-atlas-renderer-v3/, 'production art must use the approved atlas renderer');
assert.match(productionArt, /approved-showcase-2026-09-08/, 'production art must identify the approved showcase source');
assert.match(productionArt, /green-armored-plant-hero/, 'production art must lock the approved character contract');
assert.match(productionArt, /fallbackAllowed:false/, 'approved character art must not silently fall back');
assert.match(productionArt, /window\.drawSeedManProduction=drawSeedManProduction/, 'approved production renderer must publish its function');
assert.match(productionArt, /window\.drawSeedMan=drawSeedManProduction/, 'approved production renderer must own initial rendering');
assert.match(productionArt, /character\.seedman\.atlas/, 'approved production renderer must consume the approved atlas');

assert.match(spriteRuntime, /function approvedRendererAvailable\(\)/, 'compatibility sprite runtime must detect approved production renderer');
assert.match(spriteRuntime, /if \(approvedRendererAvailable\(\)\)/, 'compatibility sprite runtime must yield ownership to approved renderer');
assert.match(spriteRuntime, /dataset\.seedManRendererOwner = 'seed-man-production-v1'/, 'compatibility runtime must report production ownership');
assert.match(spriteRuntime, /drawPhenotypeLayer/, 'compatibility runtime must retain phenotype-layer support');
assert.match(spriteRuntime, /drawElementalVfx/, 'compatibility runtime must retain elemental VFX support');

assert.match(css, /\.game-shell/, 'game-shell theme must remain present');
assert.match(css, /\.course-status/, 'course progress presentation must be styled');
assert.match(css, /\[data-paused="true"\]/, 'pause state must be visually explicit');
assert.match(css, /\[data-power="active"\]/, 'active power state must alter playfield presentation');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'reduced-motion support must remain present');

const runtimeEnd = app.indexOf("const BEST_KEY = 'dtf-seed-man-best-v1';");
assert.ok(runtimeEnd > 0, 'could not isolate inlined public physics runtime');
const runtimeSource = app.slice(0, runtimeEnd);
const sandbox = { console, JSON, Number, Array, Math, Object };
vm.createContext(sandbox);
vm.runInContext(runtimeSource, sandbox, { filename: 'public-seed-man-physics.js' });

assert.equal(typeof sandbox.createPlayer, 'function');
assert.equal(typeof sandbox.stepPlayer, 'function');
assert.equal(typeof sandbox.approach, 'function');

let canonicalPlayer = createCanonicalPlayer(canonicalLevel.spawn);
let publicPlayer = sandbox.createPlayer(canonicalLevel.spawn);
assert.deepStrictEqual(JSON.parse(JSON.stringify(publicPlayer)), canonicalPlayer, 'public createPlayer must match canonical runtime');

for (let frame = 0; frame < 480; frame += 1) {
  const jumpFrame = frame === 38 || frame === 52 || frame === 126 || frame === 141 || frame === 270 || frame === 286;
  const releaseWindow = (frame >= 43 && frame < 52) || (frame >= 132 && frame < 141) || (frame >= 276 && frame < 286);
  const input = { left: false, right: frame < 450, jumpPressed: jumpFrame, jumpHeld: jumpFrame || !releaseWindow };
  canonicalPlayer = stepCanonicalPlayer(canonicalPlayer, input, canonicalLevel, 1 / 60);
  publicPlayer = sandbox.stepPlayer(publicPlayer, input, canonicalLevel, 1 / 60);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(publicPlayer)), canonicalPlayer, `public physics diverged from canonical physics at frame ${frame}`);
}

console.log('Seed Man public runtime and approved-art regression checks passed.');
