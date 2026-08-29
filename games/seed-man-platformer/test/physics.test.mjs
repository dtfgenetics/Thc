import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPlayer, overlaps, stepPlayer, DEFAULTS } from '../src/physics.mjs';
const level = JSON.parse(fs.readFileSync(new URL('../data/level-01.json', import.meta.url)));

assert.equal(level.schemaVersion, 2);
assert.equal(level.worldWidth, 7800, 'expanded course must stay exactly 3x the original 2600px width');
assert.equal(level.pickups.length, 24);
assert.equal(level.requiredPickups, 24);
assert.equal(level.checkpoints.length, 3);
assert.ok(level.powerups.length >= 7, 'expanded course should include its power-up set');
assert.ok(DEFAULTS.jumpSpeed >= 620, 'base jump must remain materially higher than the original 520');
assert.equal(DEFAULTS.maxAirJumps, 1, 'one air jump creates a true double jump');
assert.equal(overlaps({x:0,y:0,width:10,height:10},{x:9,y:9,width:10,height:10}), true);
assert.equal(overlaps({x:0,y:0,width:10,height:10},{x:10,y:0,width:10,height:10}), false);

let player = createPlayer(level.spawn);
for (let i = 0; i < 60; i += 1) player = stepPlayer(player, {left:false,right:false,jumpPressed:false}, level, 1/60);
assert.equal(player.grounded, true);
assert.ok(player.y < 440 && player.y > 420, `unexpected ground y ${player.y}`);
assert.equal(player.airJumpsRemaining, 1);

const beforeX = player.x;
for (let i = 0; i < 30; i += 1) player = stepPlayer(player, {left:false,right:true,jumpPressed:false}, level, 1/60);
assert.ok(player.x > beforeX + 100, 'right movement should advance player at the expanded run speed');

player = createPlayer({x:100,y:390});
for (let i=0;i<60;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.grounded,true);
const groundY = player.y;
player = stepPlayer(player,{left:false,right:false,jumpPressed:true},level,1/60);
assert.ok(player.vy < -580, 'normal jump should create a substantially stronger upward velocity');
let apexY = player.y;
for (let i=0;i<42;i+=1) {
  player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
  apexY=Math.min(apexY,player.y);
}
assert.ok(apexY < groundY - 120, `base jump should clear tall obstacles; apex ${apexY}, ground ${groundY}`);
for (let i=0;i<100;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.ok(Math.abs(player.y-groundY)<1.5, 'player should return to ground after jump');
assert.equal(player.airJumpsRemaining,1,'landing restores the air jump');

player = createPlayer({x:100,y:390});
for (let i=0;i<60;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
player = stepPlayer(player,{left:false,right:false,jumpPressed:true},level,1/60);
for (let i=0;i<10;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
const vyBeforeDouble = player.vy;
player = stepPlayer(player,{left:false,right:false,jumpPressed:true},level,1/60);
assert.equal(player.airJumpsRemaining,0,'second press in air must consume the one air jump');
assert.ok(player.vy < vyBeforeDouble,'double jump must renew upward velocity');
assert.ok(player.vy < -530,'double jump must have meaningful height');

player = createPlayer({x:1128,y:255});
player = stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.ok(player.collectedPowerups.includes('power-speed-1'),'speed power-up must be collectible');
assert.ok(player.power.speedTimer > 7.9,'speed power-up should start its timer');

player = createPlayer({x:1535,y:434});
player.power.shieldCharges = 1;
player = stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.deaths,0,'shield should absorb a hazard hit');
assert.equal(player.power.shieldCharges,0,'absorbing a hit consumes one shield');
assert.ok(player.power.invulnerableTimer > 0,'shield hit should provide a brief escape window');
assert.ok(player.vy < 0,'shield hit should bounce Seed Man away from the hazard');

player = createPlayer({x:610,y:500});
player.checkpoint = {x:80,y:390,id:'start'};
for(let i=0;i<10;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.deaths,1);
assert.equal(player.x,80);

player=createPlayer({x:2485,y:434});
player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.checkpoint.id,'checkpoint-1');
assert.equal(player.checkpoint.x,2460);

player=createPlayer({x:7725,y:434});
player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.finished,false,'finish must stay locked while sprouts are missing');
assert.equal(player.finishBlocked,true);
assert.equal(player.missingPickups,24);
assert.equal(player.state,'finish-blocked');
assert.ok(player.x <= level.finish.x-player.width,'blocked player must remain before the finish gate');

player=createPlayer({x:7725,y:434});
player.collected=level.pickups.map(pickup=>pickup.id);
player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.missingPickups,0);
assert.equal(player.finishBlocked,false);
assert.equal(player.finished,true,'finish must unlock after all required sprouts are collected');
assert.equal(player.state,'finish');

console.log('Seed Man expanded platformer physics tests passed');
