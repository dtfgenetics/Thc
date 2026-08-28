import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGame, legalPlay, playCard, attack, endTurn, chooseCpuAction } from "../src/engine.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const dataRoot=path.join(root,"data");
const manifest=JSON.parse(fs.readFileSync(path.join(dataRoot,"roster-manifest.json"),"utf8"));
const cards=manifest.files.flatMap((file)=>JSON.parse(fs.readFileSync(path.join(dataRoot,file),"utf8")));
assert.equal(cards.length,96);assert.equal(new Set(cards.map((c)=>c.id)).size,96);assert.equal(new Set(cards.map((c)=>c.name)).size,96);
for(const family of ["kush","haze","skunk","gas","cookies","fruit","purple","frost"]){const subset=cards.filter((c)=>c.family===family);assert.equal(subset.length,12);assert.equal(subset.filter((c)=>c.stage===1).length,6);assert.equal(subset.filter((c)=>c.stage===2).length,4);assert.equal(subset.filter((c)=>c.stage===3).length,2)}
const state=createGame({cards,playerFamily:"fruit",cpuFamily:"gas",seed:42});assert.equal(state.player.hand.length,6);assert.equal(state.player.deck.length,6);assert.equal(state.cpu.hand.length,6);const baseIndex=state.player.hand.findIndex((c)=>c.stage===1);assert.ok(baseIndex>=0);assert.equal(legalPlay(state,"player",baseIndex,0).ok,true);assert.equal(playCard(state,"player",baseIndex,0).ok,true);assert.ok(state.player.lanes[0]);assert.equal(attack(state,"player",0).ok,true);assert.equal(endTurn(state,"player").ok,true);assert.equal(state.turn,"cpu");let steps=0;while(state.turn==="cpu"&&!state.winner&&steps<20){const action=chooseCpuAction(state);if(action.type==="play")playCard(state,"cpu",action.cardIndex,action.lane);else if(action.type==="attack")attack(state,"cpu",action.lane);else{endTurn(state,"cpu");break}steps++}assert.ok(steps<20);
const cpuFirst=createGame({cards,playerFamily:"fruit",cpuFamily:"gas",seed:43,startingActor:"cpu"});assert.equal(cpuFirst.turn,"cpu");assert.throws(()=>createGame({cards,playerFamily:"fruit",cpuFamily:"gas",startingActor:"spectator"}),/Unknown starting actor/);
const skunkState=createGame({cards,playerFamily:"skunk",cpuFamily:"fruit",seed:44});const skunkBase=skunkState.player.hand.findIndex((c)=>c.stage===1);assert.equal(playCard(skunkState,"player",skunkBase,0).ok,true);assert.equal(skunkState.cpu.nextFocusPenalty,1);assert.equal(endTurn(skunkState,"player").ok,true);assert.equal(skunkState.cpu.focus,2);assert.equal(skunkState.cpu.nextFocusPenalty,0);
const hazeState=createGame({cards,playerFamily:"haze",cpuFamily:"fruit",seed:45});const hazeBase=hazeState.player.hand.findIndex((c)=>c.stage===1);assert.equal(playCard(hazeState,"player",hazeBase,0).ok,true);assert.equal(attack(hazeState,"player",0).ok,true);assert.equal(hazeState.player.focus,1);
console.log("Strain Showdown engine tests passed.");
