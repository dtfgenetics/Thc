import { createRoomTransport } from '../game/multiplayer/roomTransportFactory';
import { rollRoomWithTransport, startRoomWithTransport } from '../game/multiplayer/roomActionExecutor';
import type { HighLandRoomState } from '../game/multiplayer/roomState';
import type { RoomTransport } from '../game/multiplayer/roomTransport';

export type RoomRuntimeResult = {
  room: HighLandRoomState;
  playerCount: number;
  leadPlayerName: string;
  message: string;
};

export async function startRoomRuntime(
  room: HighLandRoomState,
  requestingPlayerId: string,
  transport: RoomTransport = createRoomTransport()
): Promise<RoomRuntimeResult> {
  const updatedRoom = await startRoomWithTransport(room, transport, requestingPlayerId);
  const leadPlayerName = updatedRoom.gameState?.players[0]?.name ?? 'Player 1';

  return {
    room: updatedRoom,
    playerCount: updatedRoom.gameState?.players.length ?? Math.max(2, updatedRoom.players.length),
    leadPlayerName,
    message: `${leadPlayerName}, roll to begin.`
  };
}

export async function rollRoomRuntime(
  room: HighLandRoomState,
  requestingPlayerId: string,
  transport: RoomTransport = createRoomTransport(),
  random: () => number = Math.random
): Promise<RoomRuntimeResult> {
  const updatedRoom = await rollRoomWithTransport(room, transport, requestingPlayerId, random);
  const currentPlayer = updatedRoom.gameState?.players[updatedRoom.gameState.currentPlayerIndex];
  const leadPlayerName = updatedRoom.gameState?.players[0]?.name ?? 'Player 1';
  const winner = updatedRoom.gameState?.players.find((player) => player.id === updatedRoom.gameState?.winnerId) ?? null;

  return {
    room: updatedRoom,
    playerCount: updatedRoom.gameState?.players.length ?? Math.max(2, updatedRoom.players.length),
    leadPlayerName,
    message: winner ? `${winner.name} wins!` : updatedRoom.gameState?.message ?? `${currentPlayer?.name ?? leadPlayerName}, roll to begin.`
  };
}
