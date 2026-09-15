import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'../../..');
const source=fs.readFileSync(path.join(repoRoot,'site/public-route-patch/games/seed-man-platformer/seed-man-production-art.js'),'utf8');

const dataset={};
const fakeWindow={
  __SEED_MAN_APPROVED_IMAGES__:{'character.seedman.atlas':'./fake-character.webp'},
  __SPROUT_COMBAT_BROWSER__:{snapshot:()=>({activePhenotype:'plant'})}
};
const fakeDocument={
  documentElement:{dataset},
  createElement(){return{dataset:{}};},
  head:{appendChild(){}}
};
class FakeImage{
  constructor(){this.decoding='';this.onload=null;this.onerror=null;this.naturalWidth=1600;this.naturalHeight=640;this._src='';}
  set src(value){this._src=value;}
  get src(){return this._src;}
}

const context=vm.createContext({
  window:fakeWindow,
  document:fakeDocument,
  Image:FakeImage,
  console,
  performance:{now:()=>0},
  player:null,
  cameraX:0,
  ctx:null
});
vm.runInContext(source,context,{filename:'seed-man-production-art.js'});

const api=fakeWindow.__SEED_MAN_PRODUCTION_ART__;
assert.ok(api,'production art API must install');
assert.equal(api.version,'seed-man-approved-atlas-renderer-v4');
assert.equal(api.actionFeedbackVersion,'seed-man-approved-action-feedback-v2');
assert.equal(api.motionRigVersion,'seed-man-character-motion-rig-v1');
assert.equal(dataset.seedManMotionRig,'seed-man-character-motion-rig-v1');
for(const pose of ['idle','run','jump','fall','attack','ability','hurt','victory'])assert.ok(api.supportedPoses.includes(pose),`missing supported pose ${pose}`);

const finite=(sample)=>{
  for(const key of ['x','y','rotation','scaleX','scaleY','alpha'])assert.ok(Number.isFinite(sample[key]),`${key} must stay finite`);
};

const idle=api.motionSample('idle',{vx:0,vy:0,grounded:true},250,Infinity);finite(idle);
const run=api.motionSample('run',{vx:340,vy:0,grounded:true},250,Infinity);finite(run);
assert.ok(run.y<0,'run rig must create a readable stride bob');
assert.ok(Math.abs(run.rotation)>.01,'run rig must create body lean/stride rotation');

const jump=api.motionSample('jump',{vx:180,vy:-700,grounded:false},200,Infinity);finite(jump);
assert.ok(jump.scaleY>1&&jump.scaleX<1,'jump rig must stretch upward');
const fall=api.motionSample('fall',{vx:180,vy:700,grounded:false},200,Infinity);finite(fall);
assert.ok(fall.scaleX>1&&fall.scaleY<1,'fall rig must widen/compress to distinguish descent');

const attack=api.motionSample('attack',{vx:0,vy:0,grounded:true},220,Infinity);finite(attack);
assert.ok(attack.x>4,'attack rig must lunge forward');
const ability=api.motionSample('ability',{vx:0,vy:0,grounded:true},220,Infinity);finite(ability);
assert.ok(ability.scaleX>1.05&&ability.y<0,'ability rig must pulse forward/upward');
const hurt=api.motionSample('hurt',{vx:0,vy:0,grounded:false},220,Infinity);finite(hurt);
assert.ok(hurt.x<0&&hurt.alpha<1,'hurt rig must recoil and flicker');
const victory=api.motionSample('victory',{vx:0,vy:0,grounded:true},300,Infinity);finite(victory);
assert.ok(victory.y<=0,'victory rig must bounce upward, never sink below the feet anchor');

const landing=api.motionSample('idle',{vx:0,vy:0,grounded:true},250,0);finite(landing);
assert.ok(landing.scaleX>idle.scaleX,'landing must squash wider than idle');
assert.ok(landing.scaleY<idle.scaleY,'landing must compress vertically');

assert.match(source,/Number\(player\.vy\|\|0\)<-20\?'jump':'fall'/,'production pose resolver must distinguish jump from fall');
assert.match(source,/SPROUT_MOTION_RIG = 'seed-man-character-motion-rig-v1'/);
console.log(JSON.stringify({ok:true,renderer:api.version,motionRig:api.motionRigVersion,poses:api.supportedPoses.length},null,2));
