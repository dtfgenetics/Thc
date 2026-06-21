import { randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type LobbyPlayer = {
  id: string;
  name: string;
  color: string;
  token: string;
  connected: boolean;
  joinedAt: number;
};

type InternalRoom = {
  gameId: string;
  status: 'lobby' | 'playing' | 'finished';
  hostPlayerId: string;
  players: LobbyPlayer[];
  gameState: Record<string, unknown> | null;
  version: number;
  updatedAt: number;
  maxPlayers: number;
  auth: Record<string, string>;
  lastSeen: Record<string, number>;
};

const colors = ['#f43f5e', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#38bdf8'];
const tokenNames = ['tokenA', 'tokenB', 'tokenC', 'tokenD', 'tokenE', 'tokenF', 'tokenG', 'tokenH', 'tokenI', 'tokenJ'];
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function roomApiPlugin(): Plugin {
  const rooms = new Map<string, InternalRoom>();

  const handle = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const pathname = request.url?.split('?')[0] ?? '';
    if (!['/api/', '/api', '/games/high-land/api/', '/games/high-land/api'].includes(pathname)) {
      next();
      return;
    }

    if (request.method !== 'POST') {
      send(response, 405, { code: 'method_not_allowed', message: 'POST required.' });
      return;
    }

    try {
      const body = await readJson(request);
      const action = String(body.action ?? '');

      if (action === 'create') {
        let gameId = createCode();
        while (rooms.has(gameId)) gameId = createCode();
        const player = createPlayer(body.name, 0);
        const playerToken = createToken();
        const now = Date.now();
        const room: InternalRoom = {
          gameId,
          status: 'lobby',
          hostPlayerId: player.id,
          players: [player],
          gameState: null,
          version: 1,
          updatedAt: now,
          maxPlayers: 10,
          auth: { [player.id]: playerToken },
          lastSeen: { [player.id]: now }
        };
        rooms.set(gameId, room);
        send(response, 200, { room: publicRoom(room), credentials: credentials(room, player.id) });
        return;
      }

      const gameId = normalizeGameId(body.gameId);
      const room = gameId ? rooms.get(gameId) : undefined;
      if (!room) {
        send(response, 404, { code: 'not_found', message: 'This game invite could not be found. Create a new High Land game.' });
        return;
      }

      if (action === 'inspect') {
        if (room.players.length >= room.maxPlayers) {
          send(response, 409, { code: 'room_full', message: 'This High Land game is full.', room: publicRoom(room) });
          return;
        }
        send(response, 200, { room: publicRoom(room) });
        return;
      }

      if (action === 'join') {
        if (room.status !== 'lobby') {
          send(response, 409, { code: 'game_started', message: 'This High Land game has already started.', room: publicRoom(room) });
          return;
        }
        if (room.players.length >= room.maxPlayers) {
          send(response, 409, { code: 'room_full', message: 'This High Land game is full.', room: publicRoom(room) });
          return;
        }
        const player = createPlayer(body.name, room.players.length, room.players.map((entry) => entry.name));
        const playerToken = createToken();
        room.players.push(player);
        room.auth[player.id] = playerToken;
        room.lastSeen[player.id] = Date.now();
        room.version += 1;
        room.updatedAt = Date.now();
        send(response, 200, { room: publicRoom(room), credentials: credentials(room, player.id) });
        return;
      }

      const playerId = String(body.playerId ?? '');
      const playerToken = String(body.playerToken ?? '');
      if (!playerId || !playerToken || room.auth[playerId] !== playerToken) {
        send(response, 401, { code: 'reconnect_failed', message: 'Your player session could not be restored. Rejoin the lobby.', room: publicRoom(room) });
        return;
      }
      room.lastSeen[playerId] = Date.now();

      if (action === 'sync') {
        send(response, 200, { room: publicRoom(room) });
        return;
      }

      if (action === 'start') {
        if (playerId !== room.hostPlayerId) {
          send(response, 403, { code: 'host_only', message: 'Only the host can start this High Land game.', room: publicRoom(room) });
          return;
        }
        if (room.players.length < 2) {
          send(response, 409, { code: 'not_enough_players', message: 'At least 2 players are needed to start.', room: publicRoom(room) });
          return;
        }
        if (room.status === 'lobby') {
          room.gameState = createGameState(room.players);
          room.status = 'playing';
          room.version += 1;
          room.updatedAt = Date.now();
        }
        send(response, 200, { room: publicRoom(room) });
        return;
      }

      if (action === 'commit') {
        if (room.status !== 'playing' || !room.gameState) {
          send(response, 409, { code: 'not_playing', message: 'This High Land game is not accepting moves.', room: publicRoom(room) });
          return;
        }
        if (Number(body.expectedVersion) !== room.version) {
          send(response, 409, { code: 'conflict', message: 'The board changed before your move was saved. The latest turn has been restored.', room: publicRoom(room) });
          return;
        }
        const currentPlayers = room.gameState.players as Array<{ id: string }>;
        const currentIndex = Number(room.gameState.currentPlayerIndex);
        if (currentPlayers[currentIndex]?.id !== playerId) {
          send(response, 403, { code: 'not_your_turn', message: 'Only the active player can make this move.', room: publicRoom(room) });
          return;
        }
        if (!isValidGameState(body.gameState, room.players)) {
          send(response, 422, { code: 'invalid_state', message: 'The submitted board state was invalid.', room: publicRoom(room) });
          return;
        }
        room.gameState = body.gameState as Record<string, unknown>;
        room.status = room.gameState.winnerId ? 'finished' : 'playing';
        room.version += 1;
        room.updatedAt = Date.now();
        send(response, 200, { room: publicRoom(room) });
        return;
      }

      send(response, 400, { code: 'invalid_action', message: 'Unknown room action.' });
    } catch {
      send(response, 400, { code: 'invalid_request', message: 'The multiplayer request was invalid.' });
    }
  };

  return {
    name: 'high-land-room-api',
    configureServer(server) {
      server.middlewares.use((request, response, next) => void handle(request, response, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => void handle(request, response, next));
    }
  };
}

function createPlayer(nameValue: unknown, index: number, existingNames: string[] = []): LobbyPlayer {
  const fallback = `Player ${index + 1}`;
  const baseName = String(nameValue ?? '').trim().replace(/\s+/g, ' ').slice(0, 24) || fallback;
  let name = baseName;
  let suffix = 2;
  while (existingNames.some((entry) => entry.toLowerCase() === name.toLowerCase())) {
    name = `${baseName} ${suffix}`.slice(0, 24);
    suffix += 1;
  }
  return {
    id: `player-${randomUUID()}`,
    name,
    color: colors[index],
    token: tokenNames[index],
    connected: true,
    joinedAt: Date.now()
  };
}

function createGameState(players: LobbyPlayer[]): Record<string, unknown> {
  return {
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      token: player.token,
      color: player.color,
      positionIndex: 0,
      skipTurns: 0,
      protectedFromBackward: 0
    })),
    currentPlayerIndex: 0,
    phase: 'ready',
    turnDirection: 1,
    reverseTurnsRemaining: 0,
    lastRoll: null,
    lastCard: null,
    message: `${players[0]?.name ?? 'Player 1'}'s turn.`,
    winnerId: null,
    cardCursor: 0,
    pendingChoice: null
  };
}

function publicRoom(room: InternalRoom) {
  const now = Date.now();
  return {
    gameId: room.gameId,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map((player) => ({
      ...player,
      connected: now - (room.lastSeen[player.id] ?? 0) < 15_000
    })),
    gameState: room.gameState,
    version: room.version,
    updatedAt: room.updatedAt,
    maxPlayers: room.maxPlayers
  };
}

function credentials(room: InternalRoom, playerId: string) {
  return { gameId: room.gameId, playerId, playerToken: room.auth[playerId] };
}

function normalizeGameId(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  return /^[A-Z2-9]{6}$/.test(normalized) ? normalized : null;
}

function createCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function createToken(): string {
  return randomBytes(24).toString('hex');
}

function isValidGameState(value: unknown, roomPlayers: LobbyPlayer[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const gameState = value as Record<string, unknown>;
  if (!Array.isArray(gameState.players) || gameState.players.length !== roomPlayers.length) return false;
  const expectedIds = roomPlayers.map((player) => player.id);
  const statePlayers = gameState.players as Array<Record<string, unknown>>;
  if (!statePlayers.every((player, index) => player.id === expectedIds[index] && Number(player.positionIndex) >= 0 && Number(player.positionIndex) <= 110)) return false;
  const currentIndex = Number(gameState.currentPlayerIndex);
  return Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < statePlayers.length;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 256_000) reject(new Error('Request too large'));
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}') as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function send(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}
