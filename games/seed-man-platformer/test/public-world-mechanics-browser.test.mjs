import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'../../..');
const publicDir=path.join(repoRoot,'site/public-route-patch/games/seed-man-platformer');
const source=fs.readFileSync(path.join(publicDir,'world-mechanics-browser-v1.js'),'utf8');
const compat=fs.readFileSync(path.join(publicDir,'canvas-compat-v1.js'),'utf8');
const index=fs.readFileSync(path.join(publicDir,'index.html'),'utf8');
const entry=fs.readFileSync(path.join(here,'../src/render/three-world-public-entry.mjs'),'utf8');
const dynamicRenderer=fs.readFileSync(path.join(here,'../src/render/three-world-dynamic.mjs'),'utf8');

assert.match(source,/seed-man-world-mechanics-browser-v2/);
assert.match(source,/seed-man-world-mechanics-runtime-v1/);
for(const marker of ['moving-platforms','collapsing-platforms','conveyor-platforms','crystal-bounce','slippery-ground','wind-zones','heat-updraft','dark-zones','teleport-roots','timed-doors']){
  assert.match(source,new RegExp(marker),`public mechanics runtime missing ${marker}`);
}
for(const phenotype of ['fire','electric','ice']) assert.match(source,new RegExp(`${phenotype}:`));
assert.match(compat,/world-mechanics-browser-v1\.js/,'runtime health bridge must declare public world mechanics');
assert.doesNotMatch(compat,/stepPlayer\s*=\s*function/,'canvas compatibility layer must not own gameplay mechanics');
const mechanicsScriptIndex=index.indexOf('world-mechanics-browser-v1.js');
const adapterScriptIndex=index.indexOf('three-world-adapter-v1.js');
assert.ok(mechanicsScriptIndex>=0,'public HTML must load world mechanics directly');
assert.ok(adapterScriptIndex>mechanicsScriptIndex,'world mechanics must install before the Three adapter begins syncing dynamic geometry');
assert.match(entry,/three-world-dynamic\.mjs/,'public Three entry must use dynamic renderer wrapper');
assert.match(dynamicRenderer,/seed-man-three-dynamic-platforms-v1/);
assert.match(dynamicRenderer,/dynamicPlatformCount/);

const listeners=new Map();
const dataset={};
const fakeWindow={
  addEventListener(name,handler){listeners.set(name,handler);},
  dispatchEvent(){},
  __SPROUT_COMBAT_BROWSER__:{snapshot:()=>({activePhenotype:'fire'})}
};
const fakeDocument={documentElement:{dataset},head:{appendChild(){}}};
class FakeCustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
const baseStep=(player)=>({...player});
const context=vm.createContext({
  window:fakeWindow,
  document:fakeDocument,
  CustomEvent:FakeCustomEvent,
  console,
  stepPlayer:baseStep,
  fetch:async()=>({ok:true,json:async()=>({levels:{}})}),
  setTimeout,
  clearTimeout
});
vm.runInContext(source,context,{filename:'world-mechanics-browser-v1.js'});

assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.version,'seed-man-world-mechanics-browser-v2');
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.installed(),true);
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.phenotypeImmuneToHazard('fire','lava'),true);
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.phenotypeImmuneToHazard('electric','energy-beam'),true);
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.phenotypeImmuneToHazard('ice','freeze-floor'),true);
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.phenotypeImmuneToHazard('plant','lava'),false);
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.hazardIsActive('laser-grid',100),true);
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.hazardIsActive('laser-grid',1200),false);

const rootZone={id:'root-zone',startX:0,endX:1000,mechanics:['teleport-roots']};
const rootPair=fakeWindow.__SEED_MAN_WORLD_MECHANICS__.teleportRootPair(rootZone);
assert.equal(Math.round(rootPair.entry.x),220,'teleport roots should derive a deterministic entry portal from the zone');
assert.equal(Math.round(rootPair.exit.x),780,'teleport roots should derive a deterministic exit portal from the zone');

const doorZone={id:'door-zone',startX:0,endX:1000,mechanics:['timed-doors']};
const doors=fakeWindow.__SEED_MAN_WORLD_MECHANICS__.timedDoorsForZone(doorZone);
assert.equal(doors.length,2,'timed door zones should materialize two readable gate beats');
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.timedDoorIsOpen(doors[0],100),true,'first timed door should begin open');
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.timedDoorIsOpen(doors[0],1800),false,'first timed door should close during the blocked phase');
assert.match(source,/createRadialGradient\(px,py,40,px,py,radius\)/,'dark zones should render a player-centered visibility falloff');
assert.match(source,/seedman:teleport-root/,'teleport roots should emit a gameplay event');
assert.match(source,/applyTimedDoors\(next,prior,levelData\)/,'timed doors should participate in player collision resolution');

const level={
  id:'vm-moving-platform',worldWidth:1800,worldHeight:540,mechanics:['moving-platforms'],encounterZones:[],
  platforms:[{id:'lift',x:300,y:380,width:180,height:22,surface:'metal',motion:{axis:'x',distance:110,durationMs:2200}}],
  hazards:[{id:'lava',type:'lava',x:800,y:480,width:90,height:42}],pickups:[],checkpoints:[],finish:{x:1700,y:390,width:50,height:90}
};
const player={x:320,y:334,width:34,height:46,vx:0,vy:0,grounded:true,finished:false,collected:[],checkpoint:{x:80,y:390,id:'start'},power:{invulnerableTimer:0}};
const beforeX=level.platforms[0].x;
const next=context.stepPlayer(player,{left:false,right:false,jumpPressed:false,jumpHeld:false},level,1/60,{});
assert.notEqual(level.platforms[0].x,beforeX,'browser mechanics must move authored motion platforms');
assert.ok(Number.isFinite(next.x)&&Number.isFinite(next.y),'browser mechanics step must preserve finite player coordinates');
assert.equal(dataset.seedManWorldMechanics,'seed-man-world-mechanics-browser-v2');

const teleportLevel={
  id:'vm-root-portals',worldWidth:1200,worldHeight:540,mechanics:['teleport-roots'],
  encounterZones:[rootZone],platforms:[],hazards:[],pickups:[],checkpoints:[],finish:{x:1140,y:390,width:50,height:90}
};
const teleportPlayer={...player,x:203,y:434,grounded:true};
const teleported=context.stepPlayer(teleportPlayer,{left:false,right:true,jumpPressed:false,jumpHeld:false},teleportLevel,1/60,{});
assert.ok(teleported.x>700,'stepping into the first root portal should move the player to the far side of the zone');
assert.equal(teleported.grounded,false,'root teleport should launch the player out of the destination portal');
assert.equal(fakeWindow.__SEED_MAN_WORLD_MECHANICS__.snapshot().lastTeleportEvent?.levelId,'vm-root-portals');

console.log(JSON.stringify({ok:true,version:fakeWindow.__SEED_MAN_WORLD_MECHANICS__.version,dynamicRenderer:'seed-man-three-dynamic-platforms-v1'},null,2));
