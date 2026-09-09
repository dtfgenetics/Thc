import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPlayer as createCanonicalPlayer, stepPlayer as stepCanonicalPlayer } from '../src/physics.mjs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [canonicalLevelText, html, app, css, productionArt, approvedRuntime, bootstrap, buildScript] = await Promise.all([
  readFile(new URL('data/level-01.json', root), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('app.js', publicRoot), 'utf8'),
  readFile(new URL('seed-man.css', publicRoot), 'utf8'),
  readFile(new URL('seed-man-production-art.js', publicRoot), 'utf8'),
  readFile(new URL('approved-art-runtime-v1.js', publicRoot), 'utf8'),
  readFile(new URL('canvas-compat-v1.js', publicRoot), 'utf8'),
  readFile(new URL('../scripts/build-three-public.mjs', import.meta.url), 'utf8')
]);
const canonicalLevel = JSON.parse(canonicalLevelText);

assert.doesNotMatch(html, /<script[^>]+id=["']seed-man-level["']/i, 'public page must not embed retired Sprout Run bootstrap data');
assert.doesNotMatch(html, /Greenhouse Gauntlet|Seed Man: Sprout Run/i, 'retired public identity must stay absent');
assert.match(html, /20-Level Campaign/, 'public page must identify the canonical 20-level campaign');
assert.match(html, /three-world-v1\.js\?v=/, 'public page must load the generated Three.js world bundle');
assert.doesNotMatch(html, /three-world-adapter-v1\.js\?v=/, 'Three.js adapter must be sequenced after campaign startup by the bootstrap runtime');
assert.match(html, /player-state-v20\.js\?v=/, 'player state must be an explicit production dependency');
assert.match(html, /JUMP ×2/, 'touch UI must advertise double jump');
assert.match(html, /id=["']combat-attack-button["']/, 'touch UI must expose attack');
assert.match(html, /id=["']combat-ability-button["']/, 'touch UI must expose phenotype ability');

await assert.rejects(access(new URL('data/level-01.json', publicRoot)), /ENOENT|no such file/i, 'retired public Level 1 compatibility fixture must stay deleted');
await assert.rejects(access(new URL('assets/approved/seed-man-approved-master-atlas-v1.webp', publicRoot)), /ENOENT|no such file/i, 'corrupt master atlas must stay deleted');
await assert.rejects(access(new URL('assets/approved/seed-man-cover-banner-approved-v1.webp', publicRoot)), /ENOENT|no such file/i, 'invalid cover banner must stay deleted');

assert.doesNotMatch(app, /^\s*import\s/m, 'public app.js must remain a self-contained classic script');
assert.doesNotMatch(app, /readEmbeddedLevel|validateLevel\s*\(/, 'public app must not own a legacy embedded level contract');
assert.doesNotMatch(app, /candidate\.id\s*!==\s*['"]sprout-run['"]|worldWidth\s*!==\s*7800|pickups\.length\s*!==\s*24/, 'Sprout Run boot assumptions must stay removed');
assert.match(app, /campaignAuthority:'campaign-v20-runtime\.js'/, 'v20 campaign runtime must be the only level authority');
assert.match(app, /seed-man-base-runtime-v20/, 'public base runtime marker must be current');
assert.match(app, /level\.boss\s*&&\s*!level\.boss\.defeated/, 'boss exits must remain locked until boss defeat');
assert.match(app, /doubleJumpSpeed:\s*590/, 'public runtime must contain the stronger double jump');
assert.match(app, /groundAcceleration:\s*2600/, 'public runtime must include progressive ground acceleration');
assert.match(app, /jumpCutGravityMultiplier:\s*2\.35/, 'public runtime must include variable jump-height gravity');
assert.match(app, /maxAirJumps:\s*1/, 'public runtime must preserve one mid-air jump');
assert.match(app, /function\s+approach\s*\(/, 'public runtime must include acceleration/deceleration helper');
assert.match(app, /function\s+guardedReset\s*\(/, 'active levels should guard destructive restart');
assert.match(app, /function\s+drawProgressRail\s*\(/, 'campaign levels need visible course progress');
assert.match(app, /function\s+writeBest\s*\(/, 'public runtime should guard best-time persistence');
assert.match(app, /function\s+focusCanvas\s*\(/, 'public runtime should guard canvas focus');
assert.match(app, /Math\.exp\(-CAMERA_FOLLOW_RATE/, 'camera smoothing should use elapsed frame time');
assert.match(app, /lostpointercapture/, 'touch controls should clear held input when pointer capture ends');
assert.doesNotMatch(app, /pointerleave/, 'captured touch input must not cancel on pointer drift');
assert.match(app, /window\.drawSeedManProduction/, 'public app must delegate character rendering to approved production art');
assert.match(app, /function\s+combatSnapshot\s*\(/, 'HUD must read phenotype state from combat runtime');
for (const retired of ['speedBoostMultiplier','jumpBoostMultiplier','magnetRadius','shieldInvulnerability','speedTimer','jumpTimer','magnetTimer','shieldCharges','collectedPowerups','shield-bounce']) {
  assert.doesNotMatch(app, new RegExp(retired), `retired prototype runtime token must stay removed: ${retired}`);
}

assert.match(bootstrap, /seed-man-runtime-bootstrap-v20/, 'bootstrap runtime marker must be current');
assert.match(bootstrap, /three-world-adapter-v1\.js/, 'bootstrap must install the world adapter after campaign startup');
assert.match(bootstrap, /window\.SeedManThreeWorld\?\.version===['"]seed-man-three-public-v3['"]/, 'bootstrap must require the generated Three.js API');
assert.match(buildScript, /publicRouteSynchronized:\s*true/, 'Three.js build must synchronize the generated bundle into the public route');
assert.match(buildScript, /copyFile\(outfile, publicOutfile\)/, 'Three.js build must copy canonical output into the deployable route');

assert.match(css, /position:sticky/, 'mobile touch controls should remain reachable');
assert.match(css, /min-height:72px/, 'mobile touch targets should remain at least 72px');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'public styling must preserve reduced-motion support');

assert.match(productionArt, /seed-man-approved-atlas-renderer-v4/, 'production character renderer version must stay current');
assert.match(productionArt, /approved-showcase-2026-09-08/, 'renderer must identify approved showcase source');
assert.match(productionArt, /green-armored-plant-hero/, 'renderer must preserve approved character contract');
assert.match(productionArt, /fallbackAllowed:false/, 'character fallback must remain disabled');
assert.match(approvedRuntime, /delegated-to-production/, 'compatibility art runtime must delegate to production renderer');

const runtimeEnd = app.indexOf("const BEST_KEY = 'dtf-seed-man-best-v20';");
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
  const input = { left:false, right:frame < 450, jumpPressed:jumpFrame, jumpHeld:jumpFrame || !releaseWindow };
  canonicalPlayer = stepCanonicalPlayer(canonicalPlayer, input, canonicalLevel, 1 / 60);
  publicPlayer = sandbox.stepPlayer(publicPlayer, input, canonicalLevel, 1 / 60);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(publicPlayer)), canonicalPlayer, `public physics diverged from canonical physics at frame ${frame}`);
}

const bossFixture={...canonicalLevel,boss:{id:'test-boss',name:'Test Boss',defeated:false},finish:{x:140,y:390,width:50,height:90},platforms:[{x:0,y:480,width:500,height:60}],hazards:[],pickups:[],requiredPickups:0,worldWidth:500};
let bossPlayer=createCanonicalPlayer({x:120,y:434});
bossPlayer.grounded=true;
bossPlayer=stepCanonicalPlayer(bossPlayer,{left:false,right:true,jumpPressed:false,jumpHeld:false},bossFixture,1/20);
assert.equal(bossPlayer.finished,false,'undefeated boss must block level completion');
assert.equal(bossPlayer.finishBlocked,true,'boss gate should expose blocked state');
bossFixture.boss.defeated=true;
bossPlayer.x=120;bossPlayer.vx=270;bossPlayer.grounded=true;
bossPlayer=stepCanonicalPlayer(bossPlayer,{left:false,right:true,jumpPressed:false,jumpHeld:false},bossFixture,1/20);
assert.equal(bossPlayer.finished,true,'defeated boss must unlock level completion');

console.log('Seed Man v20 public runtime ownership and regression checks passed.');
