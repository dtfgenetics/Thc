import express, { type Express } from 'express';
import type { RoomService } from '../domain/RoomService.js';
import { registerRoomApi } from './registerRoomApi.js';

export function createHttpApp(roomService: RoomService): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'high-land-multiplayer',
      apiVersion: '1.0.0',
      persistence: process.env.ROOM_DATA_FILE ? 'json-file' : 'memory'
    });
  });

  registerRoomApi(app, roomService);
  return app;
}
