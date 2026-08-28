import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPlayer, overlaps, stepPlayer } from '../src/physics.mjs';
const level = JSON.parse(fs.readFileSync(new URL('../data/level-01.json', import.meta.url)));

assert.equal(level.worldWidth, 2600);
assert.equal(level.pickups.length, 8);
assert.equal(level.requiredPickups, 8);
assert.equal(overlaps({x:0,y:0,width:10,height:10},{x:9,y:9,width:10,height:10}), true);
assert.equal(overlaps({x:0,y:0,width:10,height:10},{x:10,y:0,width:10,height:10}), false);

let player = createPlayer(level.spawn);
for (let i = 0; i < 60; i += 1) player = stepPlayer(player, {left:false,right:false,jumpPressed:false}, level, 1/60);
assert.equal(player.grounded, true);
assert.ok(player.y < 440 && player.y > 420, `unexpected ground y ${player.y}`);

const beforeX = player.x;
for (let i = 0; i < 30; i += 1) player = stepPlayer(player, {left:false,right:true,jumpPressed:false}, level, 1/60);
assert.ok(player.x > beforeX + 80, 'right movement should advance player');

player = createPlayer({x:100,y:390});
for (let i=0;i<60;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.grounded,true);
const groundY = player.y;
player = stepPlayer(player,{left:false,right:false,jumpPressed:true},level,1/60);
assert.ok(player.vy < 0, 'jump should create upward velocity');
for (let i=0;i<120;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.ok(Math.abs(player.y-groundY)<1.5, 'player should return to ground after jump');

player = createPlayer({x:530,y:450});
player.checkpoint = {x:80,y:390};
for(let i=0;i<10;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.deaths,1);
assert.equal(player.x,80);

player=createPlayer({x:1380,y:400});
for(let i=0;i<20;i+=1) player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.checkpoint.x,1380);

player=createPlayer({x:2515,y:400});
player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.finished,false,'finish must stay locked while sprouts are missing');
assert.equal(player.finishBlocked,true);
assert.equal(player.missingPickups,8);
assert.equal(player.state,'finish-blocked');
assert.ok(player.x <= level.finish.x-player.width,'blocked player must remain before the finish gate');

player=createPlayer({x:2515,y:400});
player.collected=level.pickups.map(pickup=>pickup.id);
player=stepPlayer(player,{left:false,right:false,jumpPressed:false},level,1/60);
assert.equal(player.missingPickups,0);
assert.equal(player.finishBlocked,false);
assert.equal(player.finished,true,'finish must unlock after all required sprouts are collected');
assert.equal(player.state,'finish');

console.log('Seed Man platformer physics tests passed');
