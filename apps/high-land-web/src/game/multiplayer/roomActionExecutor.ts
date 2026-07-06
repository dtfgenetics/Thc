import { rollRoomGameplay, startRoomGameplay } from './roomGameActions';
import { canPlayerRoll, canStartRoom, type HighLandRoomState } from './roomState';
import type { RoomTransport } from './roomTransport';

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

  for (const event of result.events) {
    await transport.appendEvent(room.code, event);
  }

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

  for (const event of result.events) {
    await transport.appendEvent(room.code, event);
  }

  return {
    ...updatedRoom,
    status: result.room.status,
    gameState: result.room.gameState
  };
}
