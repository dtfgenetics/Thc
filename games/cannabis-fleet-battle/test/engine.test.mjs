import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOARD_SIZE, PHASES, createMatch, joinMatch, lockFleet, publicView, setPlayerConnection, submitAttack, validateFleetPlacements } from '../src/engine.mjs';

const fleet = JSON.parse(fs.readFileSync(new URL('../data/fleet.json', import.meta.url)));
const placementsA = [
  { shipId: 'glass-rig', row: 0, col: 0, orientation: 'H' },
  { shipId: 'water-pipe', row: 2, col: 0, orientation: 'H' },
  { shipId: 'rolling-tray', row: 4, col: 0, orientation: 'H' },
  { shipId: 'grinder', row: 6, col: 0, orientation: 'H' },
  { shipId: 'vape-pen', row: 8, col: 0, orientation: 'H' },
  { shipId: 'dugout', row: 10, col: 0, orientation: 'H' }
];
const placementsB = [
  { shipId: 'glass-rig', row: 0, col: 10, orientation: 'V' },
  { shipId: 'water-pipe', row: 0, col: 8, orientation: 'V' },
  { shipId: 'rolling-tray', row: 6, col: 10, orientation: 'V' },
  { shipId: 'grinder', row: 6, col: 8, orientation: 'V' },
  { shipId: 'vape-pen', row: 11, col: 10, orientation: 'V' },
  { shipId: 'dugout', row: 11, col: 8, orientation: 'V' }
];

assert.equal(BOARD_SIZE, 15);
assert.equal(fleet.reduce((sum, ship) => sum + ship.length, 0), 21);
assert.equal(validateFleetPlacements(placementsA, fleet).length, fleet.length);
assert.throws(() => validateFleetPlacements([{...placementsA[0], col: 13}, ...placementsA.slice(1)], fleet), /outside/);
assert.throws(() => validateFleetPlacements([{...placementsA[0]}, {...placementsA[1], row: 0, col: 2}, ...placementsA.slice(2)], fleet), /overlap/);

let match = createMatch({ matchId: 'm1', roomCode: 'GROW42', hostPlayerId: 'p1', hostName: 'Alpha' });
assert.equal(match.phase, PHASES.LOBBY);
match = joinMatch(match, { playerId: 'p2', playerName: 'Beta' });
assert.equal(match.phase, PHASES.PLACEMENT);
match = lockFleet(match, { playerId: 'p1', placements: placementsA, fleet });
assert.equal(match.phase, PHASES.PLACEMENT);
match = lockFleet(match, { playerId: 'p2', placements: placementsB, fleet });
assert.equal(match.phase, PHASES.BATTLE);
assert.equal(match.currentTurnPlayerId, 'p1');

const view = publicView(match, 'p1');
assert.equal(view.you.ships[0].cells.length, 5);
assert.equal('cells' in view.opponent.ships[0], false, 'opponent cells must remain secret');

assert.throws(() => submitAttack(match, { playerId: 'p2', row: 0, col: 0 }), /not this player/);
let attack = submitAttack(match, { playerId: 'p1', row: 0, col: 10 });
match = attack.match;
assert.equal(attack.event.result, 'hit');
assert.equal(match.currentTurnPlayerId, 'p2');
assert.throws(() => submitAttack(match, { playerId: 'p1', row: 1, col: 10 }), /not this player/);

attack = submitAttack(match, { playerId: 'p2', row: 14, col: 14 });
match = attack.match;
assert.equal(attack.event.result, 'miss');
attack = submitAttack(match, { playerId: 'p1', row: 1, col: 10 });
match = attack.match;
attack = submitAttack(match, { playerId: 'p2', row: 14, col: 13 });
match = attack.match;
assert.throws(() => submitAttack(match, { playerId: 'p1', row: 0, col: 10 }), /already been attacked/);

const beforeTurn = match.currentTurnPlayerId;
match = setPlayerConnection(match, { playerId: 'p2', connected: false });
assert.equal(match.currentTurnPlayerId, beforeTurn, 'disconnect must not change turn authority');
match = setPlayerConnection(match, { playerId: 'p2', connected: true });
assert.equal(match.players.find((p) => p.id === 'p2').connected, true);

const targets = validateFleetPlacements(placementsB, fleet).flatMap((ship) => ship.cells);
const attacked = new Set(match.players.find((p) => p.id === 'p1').shots.map((cell) => `${cell.row},${cell.col}`));
let missCursor = 0;
const p1Cells = new Set(validateFleetPlacements(placementsA, fleet).flatMap((ship) => ship.cells).map((cell) => `${cell.row},${cell.col}`));
const p2Attacked = new Set(match.players.find((p) => p.id === 'p2').shots.map((cell) => `${cell.row},${cell.col}`));
const safeMisses = [];
for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
  for (let col = BOARD_SIZE - 1; col >= 0; col -= 1) {
    const key = `${row},${col}`;
    if (!p1Cells.has(key) && !p2Attacked.has(key)) safeMisses.push({ row, col });
  }
}

for (const target of targets) {
  if (match.phase === PHASES.COMPLETE) break;
  const key = `${target.row},${target.col}`;
  if (!attacked.has(key)) {
    if (match.currentTurnPlayerId !== 'p1') {
      const miss = safeMisses[missCursor++];
      match = submitAttack(match, { playerId: 'p2', ...miss }).match;
    }
    const result = submitAttack(match, { playerId: 'p1', ...target });
    match = result.match;
    attacked.add(key);
  }
  if (match.phase !== PHASES.COMPLETE && match.currentTurnPlayerId === 'p2') {
    const miss = safeMisses[missCursor++];
    match = submitAttack(match, { playerId: 'p2', ...miss }).match;
  }
}

assert.equal(match.phase, PHASES.COMPLETE);
assert.equal(match.winnerPlayerId, 'p1');
const finalView = publicView(match, 'p1');
assert.equal('cells' in finalView.opponent.ships[0], true, 'fleets may be revealed after completion');
assert.ok(finalView.opponent.ships.every((ship) => ship.sunk));
console.log('Cannabis Fleet Battle engine tests passed', { attacks: match.attackCount });
