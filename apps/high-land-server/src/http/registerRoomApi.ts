import type { Express, NextFunction, Request, Response } from 'express';
import { RoomService, RoomServiceError } from '../domain/RoomService.js';

export function registerRoomApi(app: Express, service: RoomService): void {
  app.use('/api/v1', corsGuard(), rateLimit(120, 60_000));

  app.post('/api/v1/rooms', (request, response) => {
    handle(response, () => {
      const result = service.createRoom({
        playerName: readPlayerName(request.body?.playerName),
        token: readOptionalString(request.body?.token, 32),
        color: readOptionalString(request.body?.color, 16),
        maxPlayers: readOptionalInteger(request.body?.maxPlayers)
      });
      response.status(201).json({ ok: true, ...result });
    });
  });

  app.post('/api/v1/rooms/:code/join', (request, response) => {
    handle(response, () => {
      const result = service.joinRoom({
        roomCode: request.params.code,
        playerName: readPlayerName(request.body?.playerName),
        token: readOptionalString(request.body?.token, 32),
        color: readOptionalString(request.body?.color, 16)
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
      const room = service.setReady(request.params.code, readBoolean(request.body?.ready, 'ready'), {
        ...auth,
        expectedVersion: readExpectedVersion(request.body?.expectedVersion)
      });
      response.json({ ok: true, room });
    });
  });

  app.post('/api/v1/rooms/:code/start', (request, response) => {
    handle(response, () => {
      const auth = readAuth(request);
      const room = service.startGame(request.params.code, {
        ...auth,
        expectedVersion: readExpectedVersion(request.body?.expectedVersion)
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
        actionId: readActionId(request.body?.actionId),
        expectedVersion: readExpectedVersion(request.body?.expectedVersion)
      });
      response.json({ ok: true, room });
    });
  });

  app.post('/api/v1/rooms/:code/reconnect', (request, response) => {
    handle(response, () => {
      const playerId = readRequiredString(request.body?.playerId, 'playerId', 128);
      const reconnectToken = readRequiredString(request.body?.reconnectToken, 'reconnectToken', 256);
      const room = service.reconnect(request.params.code, playerId, reconnectToken);
      response.json({ ok: true, room, playerId });
    });
  });

  app.post('/api/v1/rooms/:code/leave', (request, response) => {
    handle(response, () => {
      const auth = readAuth(request);
      const room = service.leaveRoom(request.params.code, {
        ...auth,
        expectedVersion: readExpectedVersion(request.body?.expectedVersion)
      });
      response.json({ ok: true, room });
    });
  });
}

function readAuth(request: Request): { playerId: string; reconnectToken: string } {
  const playerId = readRequiredString(request.header('x-player-id'), 'x-player-id', 128);
  const reconnectToken = readRequiredString(request.header('x-session-token'), 'x-session-token', 256);
  return { playerId, reconnectToken };
}

function readPlayerName(value: unknown): string {
  const name = readRequiredString(value, 'playerName', 80).replace(/\s+/g, ' ').trim();
  if (!name) throw new RoomServiceError('INVALID_PLAYER_NAME', 'playerName cannot be empty.', 400);
  return name;
}

function readExpectedVersion(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new RoomServiceError('INVALID_VERSION', 'expectedVersion must be a positive integer.', 400);
  }
  return Number(value);
}

function readActionId(value: unknown): string {
  const actionId = readRequiredString(value, 'actionId', 128).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(actionId)) {
    throw new RoomServiceError('INVALID_ACTION_ID', 'actionId contains unsupported characters.', 400);
  }
  return actionId;
}

function readBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new RoomServiceError('INVALID_INPUT', `${fieldName} must be a boolean.`, 400);
  }
  return value;
}

function readOptionalInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!Number.isInteger(value)) throw new RoomServiceError('INVALID_INPUT', 'maxPlayers must be an integer.', 400);
  return Number(value);
}

function readOptionalString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return readRequiredString(value, 'value', maxLength);
}

function readRequiredString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new RoomServiceError('INVALID_INPUT', `${fieldName} must be a string.`, 400);
  }
  if (value.length === 0 || value.length > maxLength) {
    throw new RoomServiceError('INVALID_INPUT', `${fieldName} must contain between 1 and ${maxLength} characters.`, 400);
  }
  return value;
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
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.trim();
  if (process.env.NODE_ENV === 'production' && !configuredOrigins) {
    throw new Error('ALLOWED_ORIGINS is required when NODE_ENV=production.');
  }

  const allowedOrigins = new Set(
    (configuredOrigins ?? 'http://localhost:5173,http://127.0.0.1:5173')
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
  let requestsSinceCleanup = 0;

  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 500) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      requestsSinceCleanup = 0;
    }

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
