import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const publicApp = new URL('../../../site/public-route-patch/games/seed-man-platformer/app.js', import.meta.url);
const app = await readFile(publicApp, 'utf8');
const startMarker = '// BEGIN SEED MAN AGENT BRIDGE';
const endMarker = '// END SEED MAN AGENT BRIDGE';
const start = app.indexOf(startMarker);
const end = app.indexOf(endMarker);

assert.ok(start >= 0, 'Seed Man agent bridge start marker is required');
assert.ok(end > start, 'Seed Man agent bridge end marker is required');

const bridge = app.slice(start, end + endMarker.length);
assert.match(bridge, /seed-man-agent-bridge-v1/, 'agent bridge must expose a versioned contract');
assert.match(bridge, /__SEED_MAN_AGENT__/, 'agent bridge API must be installed');
assert.match(bridge, /__SEED_MAN_GAME_STATE__/, 'read-only game-state getter must be installed');
assert.match(bridge, /Object\.freeze\(/, 'agent surface must freeze its public API');
assert.doesNotMatch(bridge, /player\.(?:x|y|vx|vy)\s*=/, 'agent bridge must not teleport or directly mutate player motion state');

const harness = `
let level = {
  id:'level-01',
  levelNumber:1,
  worldId:'greenhouse-valley',
  worldWidth:4000,
  worldHeight:720,
  requiredPickups:3,
  finish:{x:3600},
  boss:{id:'guardian',name:'Guardian',defeated:false}
};
let player = {
  x:120,y:430,vx:0,vy:0,state:'idle',grounded:true,airJumpsRemaining:1,
  checkpoint:{id:'start'},collected:['seed-a'],deaths:0,health:3,maxHealth:3,
  finished:false,finishBlocked:false
};
let elapsed = 12.3456;
let cameraX = 25.25;
let running = true;
let paused = false;
const input = {left:false,right:false,jumpHeld:false,jumpQueued:false};
const gamepadInput = {connected:false};
let attacks = 0;
let phenotypes = 0;
let retries = 0;
let restarts = 0;
function combatSnapshot(){ return {phenotypeForm:'fire',phenotypeRemaining:18.2,installed:true}; }
function requiredSprouts(){ return Number(level.requiredPickups) || 0; }
function queueJump(){ if(!input.jumpHeld) input.jumpQueued=true; input.jumpHeld=true; }
function clearInput(){ input.left=false; input.right=false; input.jumpHeld=false; input.jumpQueued=false; }
function togglePause(force){ paused=Boolean(force); running=!paused; clearInput(); }
function retryCheckpoint(){ retries+=1; return true; }
function reset(){ restarts+=1; player={...player,x:0,y:0,collected:[],finished:false}; elapsed=0; running=true; paused=false; clearInput(); }
const document={documentElement:{dataset:{}}};
const window={
  __SPROUT_COMBAT_BROWSER__:{
    fireWeapon(){attacks+=1;return true;},
    fireAbility(){phenotypes+=1;return true;}
  }
};
${bridge}
globalThis.__HARNESS__={window,document,input,getState:()=>({paused,running,attacks,phenotypes,retries,restarts})};
`;

const sandbox = { console, Object, Number, Boolean, Math, Error };
vm.createContext(sandbox);
vm.runInContext(harness, sandbox, { filename:'seed-man-agent-bridge-v1.js' });

const { window, document, input, getState } = sandbox.__HARNESS__;
const api = window.__SEED_MAN_AGENT__;
assert.equal(api.version, 'seed-man-agent-bridge-v1');
assert.deepEqual(Array.from(api.actions), ['left','right','jump','attack','phenotype','pause','resume','retry','restart']);

let snapshot = api.snapshot();
assert.equal(snapshot.ready, true);
assert.equal(snapshot.level.id, 'level-01');
assert.equal(snapshot.level.requiredPickups, 3);
assert.equal(snapshot.player.collected, 1);
assert.equal(snapshot.player.missingPickups, 2);
assert.equal(snapshot.player.checkpointId, 'start');
assert.equal(snapshot.combat.phenotypeForm, 'fire');
assert.equal(snapshot.elapsedSeconds, 12.346);
assert.equal(document.documentElement.dataset.seedManAgentBridge, 'seed-man-agent-bridge-v1');

assert.equal(api.press('left'), true);
assert.equal(input.left, true);
assert.equal(api.release('left'), true);
assert.equal(input.left, false);
assert.equal(api.press('jump'), true);
assert.equal(input.jumpHeld, true);
assert.equal(input.jumpQueued, true);
assert.equal(api.release('jump'), true);
assert.equal(input.jumpHeld, false);

assert.equal(api.attack(), true);
assert.equal(api.phenotype(), true);
assert.equal(getState().attacks, 1);
assert.equal(getState().phenotypes, 1);

api.pause();
assert.equal(getState().paused, true);
assert.equal(getState().running, false);
assert.equal(api.press('right'), false, 'movement injection must be blocked while paused');
api.resume();
assert.equal(getState().paused, false);
assert.equal(getState().running, true);

api.retry();
assert.equal(getState().retries, 1);
api.restart();
assert.equal(getState().restarts, 1);
snapshot = window.__SEED_MAN_GAME_STATE__;
assert.equal(snapshot.player.x, 0);
assert.equal(snapshot.elapsedSeconds, 0);

assert.throws(() => api.press('teleport'), /Unsupported Seed Man agent control/);
console.log('Seed Man autonomous playtest bridge contract passed.');
