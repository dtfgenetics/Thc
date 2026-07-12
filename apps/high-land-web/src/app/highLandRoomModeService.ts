import { addLocalTestPlayerToRoom, createLocalTestPlayer } from '../game/multiplayer/localRoomFlow';
import { createLocalRoom, joinLocalRoom } from '../game/multiplayer/localRoomRepository';
import { getLocalRoom } from '../game/multiplayer/localRoomStorage';
import { createInviteLink } from '../game/multiplayer/inviteLinks';
import { startRoomSession } from '../game/multiplayer/roomSessionController';
import { createRoomTransport } from '../game/multiplayer/roomTransportFactory';
import type { RoomTransport } from '../game/multiplayer/roomTransport';
import { createLocalPlayerIdentity, validatePlayerName } from '../game/players/playerIdentity';
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
  const existingRoom = getLocalRoom(roomCode.trim().toUpperCase(), storage);
  const joiningPlayer = createNamedLocalPlayer(playerName, existingRoom?.players.length ?? 1);
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
  return { ...result, message: `${result.leadPlayerName}, roll to begin.` };
}

export async function createTransportRoomMode(
  playerName: string,
  playerCount: number,
  transport: RoomTransport = createRoomTransport(),
  identityStorage: Storage | undefined = browserSessionStorage()
): Promise<RoomModeResult> {
  const identity = createLocalPlayerIdentity(playerName, 0, identityStorage);
  const room = await transport.createRoom({
    ...identity,
    joinedAt: new Date().toISOString(),
    connected: true,
    host: true
  });
  const localPlayerId = transport.getLocalPlayerId?.(room.code) ?? identity.id;
  return createRoomModeResult(room, localPlayerId, identity.name, playerCount);
}

export async function joinTransportRoomMode(
  roomCode: string,
  playerName: string,
  transport: RoomTransport = createRoomTransport(),
  identityStorage: Storage | undefined = browserSessionStorage()
): Promise<RoomModeResult> {
  const identity = createLocalPlayerIdentity(playerName, 1, identityStorage);
  const room = await transport.joinRoom(roomCode, {
    ...identity,
    joinedAt: new Date().toISOString(),
    connected: true,
    host: false
  });
  const localPlayerId = transport.getLocalPlayerId?.(room.code) ?? identity.id;
  return createRoomModeResult(room, localPlayerId, identity.name, Math.max(2, room.players.length));
}

function createNamedLocalPlayer(playerName: string, index: number) {
  const validation = validatePlayerName(playerName);
  if (!validation.valid) throw new Error(validation.error ?? 'Invalid player name.');

  return { ...createLocalTestPlayer(index), name: validation.value };
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

function browserSessionStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.sessionStorage;
}
