import { rollRoomGameplay, startRoomGameplay } from './roomGameActions';
import { canPlayerRoll, canStartRoom, type HighLandRoomState } from './roomState';
import type { RoomTransport } from './roomTransport';
import type { HighLandGameEvent } from '../events/gameEvents';

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
  await appendEventsBestEffort(room.code, result.events, transport);

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

  const result = rollRoomGameplay(room, random);
  const updatedRoom = await transport.updateGameState(room.code, result.room.gameState!, requestingPlayerId);
  await appendEventsBestEffort(room.code, result.events, transport);

  return {
    ...updatedRoom,
    status: result.room.status,
    gameState: result.room.gameState
  };
}

async function appendEventsBestEffort(roomCode: string, events: HighLandGameEvent[], transport: RoomTransport): Promise<void> {
  for (const event of events) {
    try {
      await transport.appendEvent(roomCode, event);
    } catch (error) {
      console.warn('High Land room event log failed after state sync.', error);
    }
  }
}
