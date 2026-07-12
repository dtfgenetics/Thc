import express, { type Express } from 'express';
import type { RoomService } from '../domain/RoomService.js';
import { registerRoomApi } from './registerRoomApi.js';

export function createHttpApp(roomService: RoomService): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(buildDeploymentStatus());
  });

  app.get('/ready', (_request, response) => {
    const status = buildDeploymentStatus();
    const blockers = [
      ...(status.release === 'development' ? ['release-identity-missing'] : []),
      ...(status.persistence === 'memory' ? ['persistent-room-storage-missing'] : [])
    ];

    response.setHeader('Cache-Control', 'no-store');
    response.status(blockers.length === 0 ? 200 : 503).json({
      ...status,
      ready: blockers.length === 0,
      blockers
    });
  });

  registerRoomApi(app, roomService);
  return app;
}

function buildDeploymentStatus() {
  return {
    ok: true,
    service: 'high-land-multiplayer',
    apiVersion: '1.0.0',
    persistence: process.env.ROOM_DATA_FILE ? 'json-file' : 'memory',
    release: process.env.RELEASE_SHA || process.env.GITHUB_SHA || 'development',
    checkedAt: new Date().toISOString()
  } as const;
}
