import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAuthoredLayoutIndex } from '../src/systems/authored-layout-compiler.mjs';
import {
  WORLD_MECHANIC_DEFS,
  mechanicsAtX,
  phenotypeImmuneToHazard,
  resolvePlatformAtTime,
  resolvePlatformsAtTime,
  activeHazardsForPhysics,
  environmentEffectsAtPlayer,
  materializeFrameLevel,
  applyWorldMotion
} from '../src/systems/world-mechanics-system.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const read=(name)=>JSON.parse(fs.readFileSync(path.resolve(here,'../data',name),'utf8'));
const recipes=read('authored-level-recipes-v1.json');
const levels=read('levels-20-v1.json');
const layouts=buildAuthoredLayoutIndex(recipes,levels);

assert.ok(WORLD_MECHANIC_DEFS['moving-platforms']);
assert.ok(WORLD_MECHANIC_DEFS['collapsing-platforms']);
assert.ok(WORLD_MECHANIC_DEFS['wind-zones']);
assert.ok(WORLD_MECHANIC_DEFS['slippery-ground']);

const moving=layouts.get('1-2-sunny-glade');
assert.ok(moving,'Sunny Glade recipe should compile');
const movingPlatform=moving.platforms.find((platform)=>platform.motion);
assert.ok(movingPlatform,'moving-platforms section should author a moving platform');
const movedA=resolvePlatformAtTime(movingPlatform,moving,0);
const movedB=resolvePlatformAtTime(movingPlatform,moving,700);
assert.notDeepEqual({x:movedA.x,y:movedA.y},{x:movedB.x,y:movedB.y},'moving platform should occupy different runtime positions');

const bridge=layouts.get('2-2-broken-bridges');
const breakaway=bridge.platforms.find((platform)=>platform.breakaway);
assert.ok(breakaway,'collapsing-platforms should author breakaway metadata');
const activeSamples=Array.from({length:12},(_,index)=>resolvePlatformAtTime(breakaway,bridge,index*260));
assert.ok(activeSamples.some(Boolean),'breakaway platform must be present during part of its cycle');
assert.ok(activeSamples.some((entry)=>entry===null),'breakaway platform must disappear during part of its cycle');

const crystal=layouts.get('4-2-crystal-caverns');
assert.ok(crystal.platforms.some((platform)=>platform.bounce?.multiplier===1.28),'crystal-bounce should author stronger bounce surfaces');

const toxic=layouts.get('5-1-toxic-outskirts');
assert.ok(toxic.platforms.some((platform)=>platform.conveyor?.speed),'conveyor sections must author directional conveyor surfaces');

const wind=layouts.get('3-3-dusty-winds');
const windZone=wind.encounterZones.find((zone)=>zone.mechanics.includes('wind-zones'));
assert.ok(windZone,'wind level must retain section-local mechanics metadata');
assert.ok(mechanicsAtX(wind,(windZone.startX+windZone.endX)/2).includes('wind-zones'));
const windEffects=environmentEffectsAtPlayer(wind,{x:(windZone.startX+windZone.endX)/2,y:400,width:34,height:46,grounded:false},{elapsedMs:600});
assert.notEqual(windEffects.forceX,0,'wind zones should produce a horizontal force');

const updraft=layouts.get('3-1-red-rock-run');
const updraftZone=updraft.encounterZones.find((zone)=>zone.mechanics.includes('heat-updraft'));
const updraftEffects=environmentEffectsAtPlayer(updraft,{x:(updraftZone.startX+updraftZone.endX)/2,y:320,width:34,height:46,grounded:false},{elapsedMs:500});
assert.ok(updraftEffects.gravityMultiplier<1,'heat updraft should reduce effective gravity');
assert.ok(updraftEffects.liftPerSecond>0,'heat updraft should provide lift');

assert.equal(phenotypeImmuneToHazard('fire','lava'),true);
assert.equal(phenotypeImmuneToHazard('electric','electric-floor'),true);
assert.equal(phenotypeImmuneToHazard('ice','freeze-floor'),true);
assert.equal(phenotypeImmuneToHazard('plant','lava'),false);

const hazardFixture={
  platforms:[{id:'ground',x:0,y:480,width:1000,height:60,surface:'metal'}],
  hazards:[
    {id:'laser',type:'laser-grid',x:100,y:430,width:90,height:70},
    {id:'slime',type:'toxic-slime',x:260,y:430,width:90,height:70},
    {id:'sand',type:'sandstorm',x:400,y:0,width:300,height:540}
  ],
  mechanics:[],encounterZones:[]
};
assert.equal(activeHazardsForPhysics(hazardFixture,{elapsedMs:100,phenotype:'plant'}).length,2,'active lethal hazards should feed physics while force hazards stay out');
assert.equal(activeHazardsForPhysics(hazardFixture,{elapsedMs:1100,phenotype:'plant'}).some((hazard)=>hazard.type==='laser-grid'),false,'cycle hazard should turn off outside active window');
const sandEffects=environmentEffectsAtPlayer(hazardFixture,{x:450,y:400,width:34,height:46,grounded:true},{elapsedMs:0});
assert.ok(sandEffects.forceX<0,'sandstorm should push player horizontally instead of acting as instant death');

const materialized=materializeFrameLevel(hazardFixture,{elapsedMs:100,phenotype:'plant'});
assert.ok(Object.isFrozen(materialized));
assert.equal(materialized.hazards.some((hazard)=>hazard.type==='sandstorm'),false);
assert.equal(materialized.platforms.length,1);

const carriedLevel={
  platforms:[{id:'lift',x:100,y:350,width:180,height:22,motion:{axis:'x',distance:90,durationMs:1800}}],
  hazards:[],mechanics:['moving-platforms'],encounterZones:[]
};
const carried=applyWorldMotion({x:130,y:304,width:34,height:46,vx:0,vy:0,grounded:true,groundPlatformId:'lift'},carriedLevel,{elapsedMs:900,dt:1/60});
assert.notEqual(carried.player.x,130,'standing player should inherit moving-platform delta');
assert.equal(resolvePlatformsAtTime(carriedLevel,900).length,1);

console.log(JSON.stringify({ok:true,layouts:layouts.size,mechanics:Object.keys(WORLD_MECHANIC_DEFS).length},null,2));
