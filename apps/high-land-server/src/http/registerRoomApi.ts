import type { Express, NextFunction, Request, Response } from 'express';
import { RoomService, RoomServiceError } from '../domain/RoomService.js';

export function registerRoomApi(app: Express, service: RoomService): void {
  app.use('/api/v1', corsGuard(), rateLimit(120, 60_000));

  app.post('/api/v1/rooms', (request, response) => {
    handle(response, () => {
      const result = service.createRoom({
        playerName: request.body?.playerName,
        token: request.body?.token,
        color: request.body?.color,
        maxPlayers: request.body?.maxPlayers
      });
      response.status(201).json({ ok: true, ...result });
    });
  });

  app.post('/api/v1/rooms/:code/join', (request, response) => {
    handle(response, () => {
      const result = service.joinRoom({
        roomCode: request.params.code,
        playerName: request.body?.playerName,
        token: request.body?.token,
        color: request.body?.color
      });
      response.status(201).json({ ok: true, ...result });
    });
  });

  app.get('/api/v1/rooms/:code', (request, response) => {
    handle(response, () => {
      const auth = readAuth(request);
      const room = service.getRoom(request.params.code, auth.playerId, auth.reconnectToken);
      response.json({ ok: true, room });
    });
  });

  app.post('/api/v1/rooms/:code/ready', (request, response) => {
    handle(response, () => {
      const auth = readAuth(request);
      const room = service.setReady(request.params.code, Boolean(request.body?.ready), {
        ...auth,
        expectedVersion: request.body?.expectedVersion
      });
      response.json({ ok: true, room });
    });
  });

  app.post('/api/v1/rooms/:code/start', (request, response) => {
    handle(response, () => {
      const auth = readAuth(request);
      const room = service.startGame(request.params.code, {
        ...auth,
        expectedVersion: request.body?.expectedVersion
      });
      response.json({ ok: true, room });
    });
  });

  app.post('/api/v1/rooms/:code/actions', (request, response) => {
    handle(response, () => {
      const auth = readAuth(request);
      const actionType = String(request.body?.type ?? '');
      if (actionType !== 'ROLL_DICE') {
        throw new RoomServiceError('UNKNOWN_ACTION', `Unsupported action: ${actionType || '(empty)'}.`, 400);
      }
      const room = service.rollDice(request.params.code, {
        ...auth,
        actionId: request.body?.actionId,
        expectedVersion: request.body?.expectedVersion
      });
      response.json({ ok: true, room });
    });
  });

  app.post('/api/v1/rooms/:code/reconnect', (request, response) => {
    handle(response, () => {
      const playerId = String(request.body?.playerId ?? '');
      const reconnectToken = String(request.body?.reconnectToken ?? '');
      const room = service.reconnect(request.params.code, playerId, reconnectToken);
      response.json({ ok: true, room, playerId, reconnectToken });
    });
  });

  app.post('/api/v1/rooms/:code/leave', (request, response) => {
    handle(response, () => {
      const auth = readAuth(request);
      const room = service.leaveRoom(request.params.code, {
        ...auth,
        expectedVersion: request.body?.expectedVersion
      });
      response.json({ ok: true, room });
    });
  });
}

function readAuth(request: Request): { playerId: string; reconnectToken: string } {
  const playerId = String(request.header('x-player-id') ?? '');
  const reconnectToken = String(request.header('x-session-token') ?? '');
  if (!playerId || !reconnectToken) {
    throw new RoomServiceError('SESSION_REQUIRED', 'x-player-id and x-session-token headers are required.', 401);
  }
  return { playerId, reconnectToken };
}

function handle(response: Response, operation: () => void): void {
  try {
    operation();
  } catch (error) {
    if (error instanceof RoomServiceError) {
      response.status(error.status).json({
        ok: false,
        error: { code: error.code, message: error.message }
      });
      return;
    }
    console.error(error);
    response.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected multiplayer server error.' }
    });
  }
}

function corsGuard() {
  const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,https://dtfseeds.com,https://www.dtfseeds.com,https://dtf420.com,https://www.dtf420.com')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.header('origin');
    if (origin && !allowedOrigins.has(origin)) {
      response.status(403).json({ ok: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin is not allowed.' } });
      return;
    }
    if (origin) response.header('Access-Control-Allow-Origin', origin);
    response.header('Vary', 'Origin');
    response.header('Access-Control-Allow-Headers', 'Content-Type, X-Player-Id, X-Session-Token');
    response.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }
    next();
  };
}

function rateLimit(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.header('X-RateLimit-Limit', String(maxRequests));
    response.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
    if (bucket.count > maxRequests) {
      response.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } });
      return;
    }
    next();
  };
}
