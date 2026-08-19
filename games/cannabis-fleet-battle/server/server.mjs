import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fleet from '../data/fleet.json' with { type: 'json' };
import {
  PHASES,
  createMatch,
  joinMatch,
  lockFleet,
  publicView,
  setPlayerConnection,
  submitAttack
} from '../src/engine.mjs';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_BODY_LIMIT = 16 * 1024;
const DEFAULT_RATE_WINDOW_MS = 10_000;
const DEFAULT_RATE_LIMIT = 80;

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  });
  res.end(body);
}

function secureId(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function createRoomCode(existing) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const bytes = crypto.randomBytes(6);
    let code = '';
    for (let index = 0; index < 6; index += 1) code += ROOM_ALPHABET[bytes[index] % ROOM_ALPHABET.length];
    if (!existing.has(code)) return code;
  }
  throw new Error('Could not allocate a room code.');
}

function requestIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function bearerToken(req) {
  const value = req.headers.authorization || '';
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(value);
  return match?.[1] || null;
}

async function readJson(req, limit = DEFAULT_BODY_LIMIT) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Request body too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected an object.');
    return parsed;
  } catch {
    const error = new Error('Invalid JSON body.');
    error.statusCode = 400;
    throw error;
  }
}

function publicLobbyView(match, viewerPlayerId) {
  const viewer = match.players.find((player) => player.id === viewerPlayerId);
  if (!viewer) throw new Error('Player is not part of this match.');
  if (match.players.length === 2) return publicView(match, viewerPlayerId);
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
      id: viewer.id,
      name: viewer.name,
      connected: viewer.connected,
      fleetLocked: viewer.fleetLocked,
      ships: viewer.ships,
      shots: viewer.shots,
      hitsReceived: viewer.hitsReceived
    },
    opponent: null
  };
}

function sanitizePlayerName(value) {
  return String(value || 'Player').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 32) || 'Player';
}

function corsHeaders(req, allowedOrigin) {
  if (!allowedOrigin) return {};
  const origin = req.headers.origin;
  if (origin === allowedOrigin) {
    return {
      'access-control-allow-origin': allowedOrigin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-max-age': '600',
      vary: 'Origin'
    };
  }
  return {};
}

export function createFleetBattleService(options = {}) {
  const rooms = new Map();
  const tokens = new Map();
  const rate = new Map();
  const roomTtlMs = Number(options.roomTtlMs || process.env.FLEET_ROOM_TTL_MS || DEFAULT_ROOM_TTL_MS);
  const bodyLimit = Number(options.bodyLimit || process.env.FLEET_BODY_LIMIT || DEFAULT_BODY_LIMIT);
  const rateWindowMs = Number(options.rateWindowMs || DEFAULT_RATE_WINDOW_MS);
  const rateLimit = Number(options.rateLimit || DEFAULT_RATE_LIMIT);
  const allowedOrigin = options.allowedOrigin ?? process.env.FLEET_ALLOWED_ORIGIN ?? '';
  const now = options.now || (() => Date.now());

  function touch(room) {
    room.updatedAt = now();
  }

  function cleanup() {
    const cutoff = now() - roomTtlMs;
    for (const [code, room] of rooms) {
      if (room.updatedAt < cutoff) {
        rooms.delete(code);
        for (const token of room.tokens) tokens.delete(token);
      }
    }
    for (const [ip, entry] of rate) if (entry.windowStarted < now() - rateWindowMs * 2) rate.delete(ip);
  }

  function rateAllowed(ip) {
    const time = now();
    const entry = rate.get(ip);
    if (!entry || time - entry.windowStarted >= rateWindowMs) {
      rate.set(ip, { windowStarted: time, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= rateLimit;
  }

  function issuePlayer(room, playerId) {
    const token = secureId(24);
    room.tokens.add(token);
    tokens.set(token, { roomCode: room.match.roomCode, playerId });
    return token;
  }

  function authenticatedRoom(req, roomCode) {
    const token = bearerToken(req);
    if (!token) {
      const error = new Error('Authentication required.');
      error.statusCode = 401;
      throw error;
    }
    const session = tokens.get(token);
    if (!session || session.roomCode !== roomCode) {
      const error = new Error('Invalid player session.');
      error.statusCode = 401;
      throw error;
    }
    const room = rooms.get(roomCode);
    if (!room) {
      const error = new Error('Room not found or expired.');
      error.statusCode = 404;
      throw error;
    }
    return { room, playerId: session.playerId };
  }

  async function handler(req, res) {
    cleanup();
    const cors = corsHeaders(req, allowedOrigin);
    const origin = req.headers.origin;
    if (origin && allowedOrigin && origin !== allowedOrigin) return json(res, 403, { error: 'Origin not allowed.' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    if (!rateAllowed(requestIp(req))) return json(res, 429, { error: 'Rate limit exceeded.' }, cors);

    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { ok: true, service: 'cannabis-fleet-battle', rooms: rooms.size }, cors);
      }

      if (req.method === 'POST' && url.pathname === '/api/rooms') {
        const body = await readJson(req, bodyLimit);
        const code = createRoomCode(rooms);
        const playerId = secureId(12);
        const match = createMatch({ matchId: secureId(16), roomCode: code, hostPlayerId: playerId, hostName: sanitizePlayerName(body.playerName) });
        const room = { match, tokens: new Set(), createdAt: now(), updatedAt: now() };
        rooms.set(code, room);
        const token = issuePlayer(room, playerId);
        return json(res, 201, { roomCode: code, playerToken: token, state: publicLobbyView(match, playerId) }, cors);
      }

      const match = /^\/api\/rooms\/([A-Z0-9]{4,10})(?:\/(join|state|fleet|attack|connection))?$/.exec(url.pathname);
      if (!match) return json(res, 404, { error: 'Not found.' }, cors);
      const roomCode = match[1];
      const action = match[2] || 'state';

      if (req.method === 'POST' && action === 'join') {
        const room = rooms.get(roomCode);
        if (!room) return json(res, 404, { error: 'Room not found or expired.' }, cors);
        const body = await readJson(req, bodyLimit);
        const playerId = secureId(12);
        room.match = joinMatch(room.match, { playerId, playerName: sanitizePlayerName(body.playerName) });
        touch(room);
        const token = issuePlayer(room, playerId);
        return json(res, 200, { roomCode, playerToken: token, state: publicLobbyView(room.match, playerId) }, cors);
      }

      const auth = authenticatedRoom(req, roomCode);
      const { room, playerId } = auth;
      touch(room);

      if (req.method === 'GET' && action === 'state') {
        return json(res, 200, { state: publicLobbyView(room.match, playerId) }, cors);
      }

      if (req.method === 'POST' && action === 'fleet') {
        const body = await readJson(req, bodyLimit);
        room.match = lockFleet(room.match, { playerId, placements: body.placements, fleet });
        return json(res, 200, { state: publicLobbyView(room.match, playerId) }, cors);
      }

      if (req.method === 'POST' && action === 'attack') {
        const body = await readJson(req, bodyLimit);
        const result = submitAttack(room.match, { playerId, row: body.row, col: body.col });
        room.match = result.match;
        return json(res, 200, { event: result.event, state: publicLobbyView(room.match, playerId) }, cors);
      }

      if (req.method === 'POST' && action === 'connection') {
        const body = await readJson(req, bodyLimit);
        room.match = setPlayerConnection(room.match, { playerId, connected: body.connected !== false });
        return json(res, 200, { state: publicLobbyView(room.match, playerId) }, cors);
      }

      return json(res, 405, { error: 'Method not allowed.' }, cors);
    } catch (error) {
      const status = Number(error.statusCode) || 400;
      const safeStatus = status >= 400 && status < 600 ? status : 500;
      return json(res, safeStatus, { error: error.message || 'Request failed.' }, cors);
    }
  }

  return { handler, rooms, cleanup };
}

export async function startFleetBattleServer(options = {}) {
  const service = createFleetBattleService(options);
  const server = http.createServer(service.handler);
  const port = Number(options.port ?? process.env.PORT ?? 8787);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  return { server, service, address: server.address() };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const { address } = await startFleetBattleServer();
  const host = typeof address === 'object' && address ? address.address : 'unknown';
  const port = typeof address === 'object' && address ? address.port : process.env.PORT;
  console.log(`Cannabis Fleet Battle server listening on ${host}:${port}`);
}
