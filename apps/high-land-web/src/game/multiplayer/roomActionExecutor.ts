import { rollRoomGameplay, startRoomGameplay } from './roomGameActions';
import type { HighLandRoomState } from './roomState';
import type { RoomTransport } from './roomTransport';

export async function startRoomWithTransport(room: HighLandRoomState, transport: RoomTransport): Promise<HighLandRoomState> {
  const result = startRoomGameplay(room);
  const updatedRoom = await transport.updateGameState(room.code, result.room.gameState!);

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
  random: () => number = Math.random
): Promise<HighLandRoomState> {
  const result = rollRoomGameplay(room, random);
  const updatedRoom = await transport.updateGameState(room.code, result.room.gameState!);

  for (const event of result.events) {
    await transport.appendEvent(room.code, event);
  }

  return {
    ...updatedRoom,
    status: result.room.status,
    gameState: result.room.gameState
  };
}
