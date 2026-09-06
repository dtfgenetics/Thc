import { rollRoomGameplay, startRoomGameplay } from './roomGameActions';
import { canPlayerRoll, canStartRoom, type HighLandRoomState } from './roomState';
import type { RoomTransport } from './roomTransport';
import type { HighLandGameEvent } from '../events/gameEvents';

const inFlightRolls = new Set<string>();

export async function startRoomWithTransport(
  room: HighLandRoomState,
  transport: RoomTransport,
  requestingPlayerId: string
): Promise<HighLandRoomState> {
  if (!canStartRoom(room, requestingPlayerId)) {
    throw new Error('Only the room host can start once at least 2 players have joined.');
  }

  const result = startRoomGameplay(room);
  const updatedRoom = await transport.updateGameState(room.code, result.room.gameState!, requestingPlayerId);
  await appendEventsBestEffort(room.code, result.events, transport, requestingPlayerId);

  return {
    ...updatedRoom,
    status: result.room.status,
    gameState: result.room.gameState
  };
}

export async function rollRoomWithTransport(
  room: HighLandRoomState,
  transport: RoomTransport,
  requestingPlayerId: string,
  random: () => number = Math.random
): Promise<HighLandRoomState> {
  if (!canPlayerRoll(room, requestingPlayerId)) {
    throw new Error('It is not this player’s turn.');
  }

  const rollKey = `${room.code}:${requestingPlayerId}`;
  if (inFlightRolls.has(rollKey)) {
    throw new Error('A roll is already in progress for this player.');
  }

  inFlightRolls.add(rollKey);
  try {
    const result = rollRoomGameplay(room, random);
    const updatedRoom = await transport.updateGameState(room.code, result.room.gameState!, requestingPlayerId);
    await appendEventsBestEffort(room.code, result.events, transport, requestingPlayerId);

    return {
      ...updatedRoom,
      status: result.room.status,
      gameState: result.room.gameState
    };
  } finally {
    inFlightRolls.delete(rollKey);
  }
}

async function appendEventsBestEffort(
  roomCode: string,
  events: HighLandGameEvent[],
  transport: RoomTransport,
  requestingPlayerId: string
): Promise<void> {
  for (const event of events) {
    try {
      await transport.appendEvent(roomCode, event, requestingPlayerId);
    } catch (error) {
      console.warn('High Land room event log failed after state sync.', error);
    }
  }
}
