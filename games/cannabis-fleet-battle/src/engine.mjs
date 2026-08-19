export const BOARD_SIZE = 15;
export const PHASES = Object.freeze({ LOBBY: 'lobby', PLACEMENT: 'placement', BATTLE: 'battle', COMPLETE: 'complete' });

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function coordKey({ row, col }) { return `${row},${col}`; }
function inBounds({ row, col }) { return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0 && row < BOARD_SIZE && col < BOARD_SIZE; }

function newPlayer(id, name) {
  assert(typeof id === 'string' && id.trim(), 'Player id is required.');
  return {
    id: id.trim(),
    name: String(name || 'Player').trim().slice(0, 32) || 'Player',
    connected: true,
    fleetLocked: false,
    ships: [],
    shots: [],
    hitsReceived: []
  };
}

export function createMatch({ matchId, roomCode, hostPlayerId, hostName = 'Host' } = {}) {
  assert(typeof matchId === 'string' && matchId.trim(), 'matchId is required.');
  assert(typeof roomCode === 'string' && /^[A-Z0-9]{4,10}$/.test(roomCode), 'roomCode must be 4-10 uppercase letters/numbers.');
  const host = newPlayer(hostPlayerId, hostName);
  return {
    schemaVersion: 1,
    matchId: matchId.trim(),
    roomCode,
    boardSize: BOARD_SIZE,
    phase: PHASES.LOBBY,
    players: [host],
    currentTurnPlayerId: null,
    winnerPlayerId: null,
    attackCount: 0,
    eventLog: [{ type: 'room-created', playerId: host.id }]
  };
}

function playerIndex(match, playerId) { return match.players.findIndex((player) => player.id === playerId); }
function requirePlayer(match, playerId) {
  const index = playerIndex(match, playerId);
  assert(index >= 0, 'Player is not part of this match.');
  return { index, player: match.players[index] };
}
function opponentOf(match, playerId) {
  assert(match.players.length === 2, 'Two players are required.');
  const opponent = match.players.find((player) => player.id !== playerId);
  assert(opponent, 'Opponent not found.');
  return opponent;
}

export function joinMatch(inputMatch, { playerId, playerName = 'Player' } = {}) {
  const match = clone(inputMatch);
  assert(match.phase === PHASES.LOBBY, 'Match is not accepting players.');
  assert(match.players.length === 1, 'Match already has two players.');
  assert(playerIndex(match, playerId) < 0, 'Player is already in the match.');
  const player = newPlayer(playerId, playerName);
  match.players.push(player);
  match.phase = PHASES.PLACEMENT;
  match.eventLog.push({ type: 'room-joined', playerId: player.id });
  return match;
}

function cellsForPlacement(placement, length) {
  assert(placement && typeof placement === 'object', 'Placement is required.');
  assert(['H', 'V'].includes(placement.orientation), 'Orientation must be H or V.');
  const start = { row: placement.row, col: placement.col };
  assert(inBounds(start), 'Ship start is outside the board.');
  const cells = [];
  for (let offset = 0; offset < length; offset += 1) {
    const cell = {
      row: start.row + (placement.orientation === 'V' ? offset : 0),
      col: start.col + (placement.orientation === 'H' ? offset : 0)
    };
    assert(inBounds(cell), 'Ship extends outside the board.');
    cells.push(cell);
  }
  return cells;
}

export function validateFleetPlacements(placements, fleet) {
  assert(Array.isArray(fleet) && fleet.length > 0, 'Fleet schema is required.');
  assert(Array.isArray(placements), 'Placements must be an array.');
  assert(placements.length === fleet.length, `Expected ${fleet.length} ship placements.`);
  const byId = new Map(placements.map((placement) => [placement.shipId, placement]));
  assert(byId.size === placements.length, 'Duplicate ship placements are not allowed.');
  const occupied = new Set();
  const normalized = [];

  for (const ship of fleet) {
    const placement = byId.get(ship.id);
    assert(placement, `Missing placement for ${ship.id}.`);
    const cells = cellsForPlacement(placement, ship.length);
    for (const cell of cells) {
      const key = coordKey(cell);
      assert(!occupied.has(key), `Ships overlap at ${key}.`);
      occupied.add(key);
    }
    normalized.push({
      id: ship.id,
      name: ship.name,
      length: ship.length,
      orientation: placement.orientation,
      row: placement.row,
      col: placement.col,
      cells,
      hits: [],
      sunk: false
    });
  }
  return normalized;
}

export function lockFleet(inputMatch, { playerId, placements, fleet } = {}) {
  const match = clone(inputMatch);
  assert(match.phase === PHASES.PLACEMENT, 'Match is not in placement phase.');
  const { index, player } = requirePlayer(match, playerId);
  assert(!player.fleetLocked, 'Fleet is already locked.');
  const ships = validateFleetPlacements(placements, fleet);
  match.players[index].ships = ships;
  match.players[index].fleetLocked = true;
  match.eventLog.push({ type: 'fleet-locked', playerId });

  if (match.players.length === 2 && match.players.every((candidate) => candidate.fleetLocked)) {
    match.phase = PHASES.BATTLE;
    match.currentTurnPlayerId = match.players[0].id;
    match.eventLog.push({ type: 'battle-started', playerId: match.currentTurnPlayerId });
  }
  return match;
}

function shipAt(player, target) {
  const key = coordKey(target);
  return player.ships.find((ship) => ship.cells.some((cell) => coordKey(cell) === key)) || null;
}

export function submitAttack(inputMatch, { playerId, row, col } = {}) {
  const match = clone(inputMatch);
  assert(match.phase === PHASES.BATTLE, 'Match is not in battle phase.');
  assert(match.currentTurnPlayerId === playerId, 'It is not this player’s turn.');
  const target = { row, col };
  assert(inBounds(target), 'Attack target is outside the board.');
  const { index: attackerIndex } = requirePlayer(match, playerId);
  const defender = opponentOf(match, playerId);
  const defenderIndex = playerIndex(match, defender.id);
  const key = coordKey(target);
  assert(!match.players[attackerIndex].shots.some((shot) => coordKey(shot) === key), 'That cell has already been attacked.');

  match.players[attackerIndex].shots.push(target);
  match.attackCount += 1;
  const ship = shipAt(match.players[defenderIndex], target);
  let result = 'miss';
  let sunkShipId = null;

  if (ship) {
    result = 'hit';
    const shipIndex = match.players[defenderIndex].ships.findIndex((candidate) => candidate.id === ship.id);
    const liveShip = match.players[defenderIndex].ships[shipIndex];
    liveShip.hits.push(target);
    match.players[defenderIndex].hitsReceived.push(target);
    if (liveShip.hits.length === liveShip.length) {
      liveShip.sunk = true;
      result = 'sunk';
      sunkShipId = liveShip.id;
    }
  }

  const allSunk = match.players[defenderIndex].ships.every((candidate) => candidate.sunk);
  if (allSunk) {
    match.phase = PHASES.COMPLETE;
    match.winnerPlayerId = playerId;
    match.currentTurnPlayerId = null;
  } else {
    match.currentTurnPlayerId = defender.id;
  }

  const event = {
    type: allSunk ? 'game-complete' : 'attack-result',
    playerId,
    target,
    result,
    sunkShipId,
    nextTurnPlayerId: match.currentTurnPlayerId,
    winnerPlayerId: match.winnerPlayerId
  };
  match.eventLog.push(event);
  return { match, event };
}

export function setPlayerConnection(inputMatch, { playerId, connected } = {}) {
  const match = clone(inputMatch);
  const { index } = requirePlayer(match, playerId);
  match.players[index].connected = Boolean(connected);
  match.eventLog.push({ type: connected ? 'player-reconnected' : 'player-disconnected', playerId });
  return match;
}

function publicShip(ship, revealAll) {
  return {
    id: ship.id,
    name: ship.name,
    length: ship.length,
    sunk: ship.sunk,
    hits: clone(ship.hits),
    ...(revealAll ? { cells: clone(ship.cells), orientation: ship.orientation, row: ship.row, col: ship.col } : {})
  };
}

export function publicView(match, viewerPlayerId) {
  requirePlayer(match, viewerPlayerId);
  const own = match.players.find((player) => player.id === viewerPlayerId);
  const opponent = opponentOf(match, viewerPlayerId);
  const revealOpponent = match.phase === PHASES.COMPLETE;
  return {
    schemaVersion: match.schemaVersion,
    matchId: match.matchId,
    roomCode: match.roomCode,
    boardSize: match.boardSize,
    phase: match.phase,
    currentTurnPlayerId: match.currentTurnPlayerId,
    winnerPlayerId: match.winnerPlayerId,
    attackCount: match.attackCount,
    you: {
      id: own.id,
      name: own.name,
      connected: own.connected,
      fleetLocked: own.fleetLocked,
      ships: own.ships.map((ship) => publicShip(ship, true)),
      shots: clone(own.shots),
      hitsReceived: clone(own.hitsReceived)
    },
    opponent: {
      id: opponent.id,
      name: opponent.name,
      connected: opponent.connected,
      fleetLocked: opponent.fleetLocked,
      ships: opponent.ships.map((ship) => publicShip(ship, revealOpponent)),
      shots: clone(opponent.shots),
      hitsReceived: clone(opponent.hitsReceived)
    }
  };
}
