import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { RoomStore } from '../storage/RoomStore.js';
import { rollHighLandTurn } from './highLandRules.js';
import {
  HIGH_LAND_MAX_PLAYERS,
  HIGH_LAND_MIN_PLAYERS,
  type AuthoritativeGameState,
  type PlayerSessionResult,
  type PublicRoom,
  type RoomMutationContext,
  type RoomPlayer,
  type StoredRoom
} from './roomTypes.js';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PROCESSED_ACTIONS = 200;
const MIN_PLAYER_NAME_LENGTH = 2;
const MAX_PLAYER_NAME_LENGTH = 24;
const DEFAULT_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
  '#84cc16'
];

export class RoomServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export type CreateRoomInput = {
  playerName: string;
  token?: string;
  color?: string;
  maxPlayers?: number;
};

export type JoinRoomInput = {
  roomCode: string;
  playerName: string;
  token?: string;
  color?: string;
};

export class RoomService {
  constructor(
    private readonly store: RoomStore,
    private readonly random: () => number = secureUnitRandom,
    private readonly now: () => Date = () => new Date()
  ) {}

  createRoom(input: CreateRoomInput): PlayerSessionResult {
    this.cleanupExpiredRooms();
    const maxPlayers = clampInteger(input.maxPlayers ?? HIGH_LAND_MAX_PLAYERS, HIGH_LAND_MIN_PLAYERS, HIGH_LAND_MAX_PLAYERS);
    const code = this.generateUniqueRoomCode();
    const createdAt = this.now().toISOString();
    const session = this.createPlayer(input.playerName, input.token, input.color, 0, true);
    const room: StoredRoom = {
      id: randomUUID(),
      code,
      gameSlug: 'high-land',
      status: 'waiting',
      hostPlayerId: session.player.id,
      maxPlayers,
      version: 1,
      players: [session.player],
      gameState: null,
      processedActionIds: [],
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(this.now().getTime() + ROOM_TTL_MS).toISOString()
    };
    this.store.set(room);
    return { room: toPublicRoom(room), playerId: session.player.id, reconnectToken: session.rawToken };
  }

  joinRoom(input: JoinRoomInput): PlayerSessionResult {
    this.cleanupExpiredRooms();
    const room = this.requireMutableRoom(input.roomCode);
    if (room.status !== 'waiting') throw new RoomServiceError('ROOM_STARTED', 'Room already started.', 409);
    if (room.players.length >= room.maxPlayers) throw new RoomServiceError('ROOM_FULL', 'Room is full.', 409);

    const session = this.createPlayer(input.playerName, input.token, input.color, room.players.length, false);
    room.players.push(session.player);
    this.touch(room);
    this.store.set(room);
    return { room: toPublicRoom(room), playerId: session.player.id, reconnectToken: session.rawToken };
  }

  getRoom(roomCode: string, playerId: string, reconnectToken: string): PublicRoom {
    const room = this.requireRoom(roomCode);
    this.authenticate(room, playerId, reconnectToken);
    return toPublicRoom(room);
  }

  setReady(roomCode: string, ready: boolean, context: RoomMutationContext): PublicRoom {
    const room = this.requireMutableRoom(roomCode);
    const player = this.authenticate(room, context.playerId, context.reconnectToken);
    this.assertVersion(room, context.expectedVersion);
    if (room.status !== 'waiting') throw new RoomServiceError('ROOM_STARTED', 'Ready state can only change in the lobby.', 409);
    player.ready = Boolean(ready);
    player.connected = true;
    player.lastSeenAt = this.now().toISOString();
    this.touch(room);
    this.store.set(room);
    return toPublicRoom(room);
  }

  startGame(roomCode: string, context: RoomMutationContext): PublicRoom {
    const room = this.requireMutableRoom(roomCode);
    this.authenticate(room, context.playerId, context.reconnectToken);
    this.assertVersion(room, context.expectedVersion);
    if (room.hostPlayerId !== context.playerId) throw new RoomServiceError('HOST_REQUIRED', 'Only the host can start the game.', 403);
    if (room.status !== 'waiting') throw new RoomServiceError('ROOM_STARTED', 'Room has already started.', 409);
    if (room.players.length < HIGH_LAND_MIN_PLAYERS) throw new RoomServiceError('NOT_ENOUGH_PLAYERS', 'At least two players are required.', 409);
    if (room.players.some((player) => !player.ready)) throw new RoomServiceError('PLAYERS_NOT_READY', 'Every player must be ready.', 409);

    room.status = 'playing';
    room.gameState = createInitialGameState(room.players);
    this.touch(room);
    this.store.set(room);
    return toPublicRoom(room);
  }

  rollDice(roomCode: string, context: RoomMutationContext): PublicRoom {
    const room = this.requireMutableRoom(roomCode);
    this.authenticate(room, context.playerId, context.reconnectToken);
    if (!context.actionId?.trim()) throw new RoomServiceError('ACTION_ID_REQUIRED', 'actionId is required.', 400);
    if (room.processedActionIds.includes(context.actionId)) return toPublicRoom(room);
    this.assertVersion(room, context.expectedVersion);
    if (room.status !== 'playing' || !room.gameState) throw new RoomServiceError('ROOM_NOT_PLAYING', 'Room is not currently playing.', 409);

    const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== context.playerId) {
      throw new RoomServiceError('OUT_OF_TURN', 'It is not this player\'s turn.', 409);
    }

    room.gameState = rollHighLandTurn(room.gameState, this.random);
    if (room.gameState.winnerId) room.status = 'complete';

    room.processedActionIds.push(context.actionId);
    if (room.processedActionIds.length > MAX_PROCESSED_ACTIONS) {
      room.processedActionIds.splice(0, room.processedActionIds.length - MAX_PROCESSED_ACTIONS);
    }
    this.touch(room);
    this.store.set(room);
    return toPublicRoom(room);
  }

  reconnect(roomCode: string, playerId: string, reconnectToken: string): PublicRoom {
    const room = this.requireMutableRoom(roomCode);
    const player = this.authenticate(room, playerId, reconnectToken);
    player.connected = true;
    player.lastSeenAt = this.now().toISOString();
    this.touch(room);
    this.store.set(room);
    return toPublicRoom(room);
  }

  leaveRoom(roomCode: string, context: RoomMutationContext): PublicRoom {
    const room = this.requireMutableRoom(roomCode);
    const player = this.authenticate(room, context.playerId, context.reconnectToken);
    this.assertVersion(room, context.expectedVersion);

    if (room.status === 'waiting') {
      room.players = room.players.filter((candidate) => candidate.id !== player.id);
      if (room.players.length === 0) {
        room.status = 'abandoned';
      } else if (room.hostPlayerId === player.id) {
        const nextHost = room.players[0];
        room.hostPlayerId = nextHost.id;
        for (const candidate of room.players) candidate.host = candidate.id === nextHost.id;
      }
    } else {
      player.connected = false;
      player.lastSeenAt = this.now().toISOString();
      if (room.status === 'playing' && room.players.every((candidate) => !candidate.connected)) room.status = 'abandoned';
    }

    this.touch(room);
    this.store.set(room);
    return toPublicRoom(room);
  }

  cleanupExpiredRooms(): void {
    const now = this.now().getTime();
    for (const room of this.store.list()) {
      if (Date.parse(room.expiresAt) <= now) this.store.delete(room.code);
    }
  }

  private requireRoom(roomCode: string): StoredRoom {
    const code = normalizeRoomCode(roomCode);
    const room = this.store.get(code);
    if (!room) throw new RoomServiceError('ROOM_NOT_FOUND', 'Room not found.', 404);
    if (Date.parse(room.expiresAt) <= this.now().getTime()) {
      this.store.delete(code);
      throw new RoomServiceError('ROOM_EXPIRED', 'Room has expired.', 410);
    }
    return room;
  }

  private requireMutableRoom(roomCode: string): StoredRoom {
    return structuredClone(this.requireRoom(roomCode));
  }

  private authenticate(room: StoredRoom, playerId: string, reconnectToken: string): RoomPlayer {
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player || !reconnectToken || !hashesMatch(player.reconnectTokenHash, hashToken(reconnectToken))) {
      throw new RoomServiceError('INVALID_SESSION', 'Player session is invalid.', 401);
    }
    return player;
  }

  private assertVersion(room: StoredRoom, expectedVersion?: number): void {
    if (!Number.isInteger(expectedVersion)) throw new RoomServiceError('VERSION_REQUIRED', 'expectedVersion is required.', 400);
    if (expectedVersion !== room.version) {
      throw new RoomServiceError('STALE_VERSION', `Room version is ${room.version}; received ${expectedVersion}.`, 409);
    }
  }

  private createPlayer(
    name: string,
    token: string | undefined,
    color: string | undefined,
    index: number,
    host: boolean
  ): { player: RoomPlayer; rawToken: string } {
    const rawToken = randomBytes(32).toString('base64url');
    const now = this.now().toISOString();
    return {
      rawToken,
      player: {
        id: randomUUID(),
        name: sanitizeName(name),
        token: normalizePlayerToken(token, index),
        color: normalizeColor(color, index),
        host,
        ready: false,
        connected: true,
        joinedAt: now,
        lastSeenAt: now,
        reconnectTokenHash: hashToken(rawToken)
      }
    };
  }

  private generateUniqueRoomCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = '';
      for (let index = 0; index < 6; index += 1) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.store.get(code)) return code;
    }
    throw new RoomServiceError('ROOM_CODE_EXHAUSTED', 'Could not allocate a room code.', 503);
  }

  private touch(room: StoredRoom): void {
    room.version += 1;
    room.updatedAt = this.now().toISOString();
    room.expiresAt = new Date(this.now().getTime() + ROOM_TTL_MS).toISOString();
  }
}

function createInitialGameState(players: RoomPlayer[]): AuthoritativeGameState {
  const gamePlayers = players.map((player) => ({
    id: player.id,
    name: player.name,
    token: player.token,
    color: player.color,
    positionIndex: 0,
    skipTurns: 0,
    protectedFromBackward: 0
  }));
  return {
    players: gamePlayers,
    currentPlayerIndex: 0,
    phase: 'ready',
    turnDirection: 1,
    reverseTurnsRemaining: 0,
    lastRoll: null,
    lastMove: null,
    lastCard: null,
    message: `${gamePlayers[0]?.name ?? 'Player 1'}, roll to begin.`,
    winnerId: null,
    cardCursor: 0
  };
}

function sanitizeName(value: string): string {
  const cleaned = String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PLAYER_NAME_LENGTH);

  if (cleaned.length < MIN_PLAYER_NAME_LENGTH) {
    throw new RoomServiceError('PLAYER_NAME_REQUIRED', 'Player name must be at least 2 characters.', 400);
  }

  return cleaned;
}

function normalizePlayerToken(value: string | undefined, index: number): string {
  const candidate = String(value ?? '');
  return /^token[A-J]$/.test(candidate) ? candidate : `token${String.fromCharCode(65 + (index % 10))}`;
}

function normalizeColor(value: string | undefined, index: number): string {
  const candidate = String(value ?? '');
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

function normalizeRoomCode(value: string): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function toPublicRoom(room: StoredRoom): PublicRoom {
  const { processedActionIds, players, ...publicRoom } = room;
  void processedActionIds;
  return {
    ...publicRoom,
    players: players.map(({ reconnectTokenHash, ...player }) => {
      void reconnectTokenHash;
      return player;
    })
  };
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function secureUnitRandom(): number {
  const value = randomInt(0, Number.MAX_SAFE_INTEGER);
  return value / Number.MAX_SAFE_INTEGER;
}
