import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPlayer as createCanonicalPlayer, stepPlayer as stepCanonicalPlayer } from '../src/physics.mjs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [canonicalLevelText, publicLevelText, html, app, css, productionArt, approvedRuntime] = await Promise.all([
  readFile(new URL('data/level-01.json', root), 'utf8'),
  readFile(new URL('data/level-01.json', publicRoot), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('app.js', publicRoot), 'utf8'),
  readFile(new URL('seed-man.css', publicRoot), 'utf8'),
  readFile(new URL('seed-man-production-art.js', publicRoot), 'utf8'),
  readFile(new URL('approved-art-runtime-v1.js', publicRoot), 'utf8')
]);

const canonicalLevel = JSON.parse(canonicalLevelText);
assert.deepStrictEqual(JSON.parse(publicLevelText), canonicalLevel, 'public level fixture must remain semantically aligned with the canonical fixture');
assert.equal(canonicalLevel.worldWidth, 7800);
assert.equal(canonicalLevel.pickups.length, 24);
assert.equal(canonicalLevel.checkpoints.length, 3);

assert.doesNotMatch(html, /<script[^>]+type=["']module["']/i, 'public runtime must not depend on module-script MIME handling');
assert.match(html, /<script\s+src=["']\.\/app\.js\?v=[^"']+["']\s+defer><\/script>/i, 'public runtime should use a versioned deferred classic script');
assert.match(html, /JUMP ×2/, 'touch UI must advertise the double-jump control');
assert.match(html, /id=["']power-count["']/, 'HUD must expose active phenotype state');
assert.match(html, /id=["']jump-count["']/, 'HUD must expose double-jump readiness');

const levelMatch = html.match(/<script\s+id=["']seed-man-level["']\s+type=["']application\/json["']>\s*([\s\S]*?)\s*<\/script>/i);
assert.ok(levelMatch, 'public page must embed bootstrap level data for immediate startup');
const bootstrapLevel = JSON.parse(levelMatch[1]);
assert.equal(bootstrapLevel.schemaVersion, 2, 'bootstrap level schema must stay compatible');
assert.equal(bootstrapLevel.id, canonicalLevel.id, 'bootstrap level must preserve the compatibility identity');
assert.equal(bootstrapLevel.worldWidth, canonicalLevel.worldWidth, 'bootstrap level must preserve world width');
assert.equal(bootstrapLevel.worldHeight, canonicalLevel.worldHeight, 'bootstrap level must preserve world height');
assert.equal(bootstrapLevel.requiredPickups, canonicalLevel.requiredPickups, 'bootstrap level must preserve completion requirement');
assert.deepStrictEqual(bootstrapLevel.spawn, canonicalLevel.spawn, 'bootstrap level must preserve initial spawn');
assert.equal(bootstrapLevel.pickups?.length, canonicalLevel.requiredPickups, 'bootstrap level must expose the required pickup count');
assert.equal(bootstrapLevel.checkpoints?.length, canonicalLevel.checkpoints.length, 'bootstrap level must retain checkpoint count');
assert.deepStrictEqual(bootstrapLevel.powerups, [], 'bootstrap must not reintroduce retired speed/shield/magnet/jump pickups');
assert.ok(bootstrapLevel.platforms?.length > 0, 'bootstrap level needs traversable ground');
assert.ok(bootstrapLevel.finish?.x > bootstrapLevel.spawn.x, 'bootstrap finish must remain ahead of spawn');
assert.match(bootstrapLevel.name, /Seed Man/i, 'bootstrap level must expose current Seed Man identity');

assert.doesNotMatch(app, /^\s*import\s/m, 'public app.js must be self-contained');
assert.doesNotMatch(app, /fetch\s*\(/i, 'public app.js must not fetch runtime data');
assert.match(app, /doubleJumpSpeed:\s*590/, 'public runtime must contain the stronger double jump');
assert.match(app, /groundAcceleration:\s*2600/, 'public runtime must include progressive ground acceleration');
assert.match(app, /jumpCutGravityMultiplier:\s*2\.35/, 'public runtime must include variable jump-height gravity');
assert.match(app, /maxAirJumps:\s*1/, 'public runtime must preserve one mid-air jump');
assert.match(app, /function\s+approach\s*\(/, 'public runtime must include acceleration/deceleration helper');
assert.match(app, /function\s+guardedReset\s*\(/, 'active runs should guard destructive restart');
assert.match(app, /function\s+drawProgressRail\s*\(/, 'expanded level needs visible course progress');
assert.match(app, /function\s+readEmbeddedLevel\s*\(/, 'public runtime should read embedded level data');
assert.match(app, /function\s+writeBest\s*\(/, 'public runtime should guard best-time persistence');
assert.match(app, /function\s+focusCanvas\s*\(/, 'public runtime should guard canvas focus');
assert.match(app, /function\s+cameraBlend\s*\(/, 'camera smoothing must be time-based rather than frame-count based');
assert.match(app, /Math\.exp\(-CAMERA_FOLLOW_RATE/, 'camera smoothing should use elapsed frame time');
assert.match(app, /jumpHeld:\s*input\.jumpHeld/, 'held jump state must reach the fixed-step physics runtime');
assert.match(app, /lostpointercapture/, 'touch controls should clear held input when pointer capture actually ends');
assert.doesNotMatch(app, /addEventListener\(['"]pointerleave['"]/, 'touch controls must not cancel movement merely because a captured pointer drifts outside the button');
assert.match(app, /window\.drawSeedManProduction/, 'public app must delegate character rendering to approved production art');
assert.match(app, /function\s+combatSnapshot\s*\(/, 'public HUD must read phenotype state from combat runtime');
assert.doesNotMatch(app, /function\s+collectPowerup\s*\(/, 'retired prototype powerup collection must stay removed');
assert.doesNotMatch(app, /function\s+drawPowerup\s*\(/, 'retired prototype powerup rendering must stay removed');
for (const retired of ['speedBoostMultiplier','jumpBoostMultiplier','magnetRadius','shieldInvulnerability','speedTimer','jumpTimer','magnetTimer','shieldCharges','collectedPowerups','shield-bounce']) {
  assert.doesNotMatch(app, new RegExp(retired), `retired prototype runtime token must stay removed: ${retired}`);
}
assert.match(css, /position:sticky/, 'mobile touch controls should remain reachable during the longer run');
assert.match(css, /min-height:72px/, 'mobile touch targets should remain large enough for repeated double-jump input');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'public styling must preserve reduced-motion support');

assert.match(productionArt, /seed-man-approved-atlas-renderer-v4/, 'production renderer version must be current');
assert.match(productionArt, /approved-showcase-2026-09-08/, 'production renderer must identify the approved showcase source');
assert.match(productionArt, /green-armored-plant-hero/, 'production renderer must preserve the approved character contract');
assert.match(productionArt, /function\s+drawSeedManProduction\s*\(/, 'production renderer must expose the approved Seed Man draw path');
assert.match(productionArt, /character\.seedman\.atlas/, 'production renderer must resolve the approved character atlas key');
assert.match(productionArt, /fallbackAllowed:false/, 'production renderer must keep fallback disabled');
assert.match(productionArt, /window\.__SEED_MAN_PRODUCTION_ART__/, 'production renderer must publish its diagnostic contract');
assert.match(productionArt, /const FRAME_COLS = 5;/, 'production renderer must use the atlas five-column grid');
assert.match(productionArt, /const FRAME_ROWS = 2;/, 'production renderer must use the atlas two-row grid');
assert.match(productionArt, /naturalWidth\/FRAME_COLS/, 'production renderer must derive source width from the decoded atlas');
assert.match(productionArt, /naturalHeight\/FRAME_ROWS/, 'production renderer must derive source height from the decoded atlas');
assert.match(approvedRuntime, /window\.drawSeedManProduction/, 'compatibility runtime must detect the production renderer');
assert.match(approvedRuntime, /delegated-to-production/, 'compatibility runtime must delegate ownership deterministically');
assert.doesNotMatch(productionArt, /function\s+installSproutRunShellV2\s*\(/, 'renderer must not reclaim retired DOM shell ownership');

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

console.log('Seed Man clean v20 public runtime, approved renderer, and bootstrap regression checks passed.');
