import { addLocalTestPlayerToRoom, createLocalTestPlayer } from '../game/multiplayer/localRoomFlow';
import { createLocalRoom, joinLocalRoom } from '../game/multiplayer/localRoomRepository';
import { createInviteLink } from '../game/multiplayer/inviteLinks';
import { startRoomSession } from '../game/multiplayer/roomSessionController';
import type { HighLandRoomState } from '../game/multiplayer/roomState';
import type { GameState } from '../game/types/gameTypes';

export type RoomModeResult = {
  room: HighLandRoomState;
  localPlayerId: string;
  localPlayerName: string;
  inviteUrl: string;
  playerCount: number;
};

export type StartRoomModeResult = {
  gameState: GameState;
  playerCount: number;
  leadPlayerName: string;
  message: string;
};

export function createLocalRoomMode(playerName: string, playerCount: number, storage?: Storage): RoomModeResult {
  const hostPlayer = createNamedLocalPlayer(playerName, 0);
  const room = createLocalRoom(hostPlayer, storage);
  return createRoomModeResult(room, hostPlayer.id, hostPlayer.name, playerCount);
}

export function joinLocalRoomMode(roomCode: string, playerName: string, storage?: Storage): RoomModeResult {
  const joiningPlayer = createNamedLocalPlayer(playerName, 1);
  const room = joinLocalRoom(roomCode, joiningPlayer, storage);
  return createRoomModeResult(room, joiningPlayer.id, joiningPlayer.name, Math.max(2, room.players.length));
}

export function addLocalTestPlayerMode(room: HighLandRoomState, storage?: Storage): RoomModeResult {
  const updatedRoom = addLocalTestPlayerToRoom(room, storage);
  const host = updatedRoom.players.find((player) => player.host) ?? updatedRoom.players[0];
  return createRoomModeResult(updatedRoom, host?.id ?? '', host?.name ?? 'Player 1', Math.max(2, updatedRoom.players.length));
}

export function startLocalRoomMode(room: HighLandRoomState): StartRoomModeResult {
  const result = startRoomSession(room);
  return {
    ...result,
    message: `${result.leadPlayerName}, roll to begin.`
  };
}

function createNamedLocalPlayer(playerName: string, index: number) {
  const player = createLocalTestPlayer(index);
  const name = playerName.trim().replace(/\s+/g, ' ') || player.name;
  return { ...player, name };
}

function createRoomModeResult(
  room: HighLandRoomState,
  localPlayerId: string,
  localPlayerName: string,
  playerCount: number
): RoomModeResult {
  return {
    room,
    localPlayerId,
    localPlayerName,
    inviteUrl: createInviteLink(room.code).url,
    playerCount
  };
}
