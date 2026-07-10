import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RoomService } from './domain/RoomService.js';
import { registerRoomApi } from './http/registerRoomApi.js';
import { GameRoom } from './rooms/GameRoom.js';
import { createRoomStoreFromEnvironment } from './storage/RoomStore.js';

const port = Number(process.env.PORT || 2567);
const app = express();
const server = createServer(app);
const roomStore = createRoomStoreFromEnvironment();
const roomService = new RoomService(roomStore);

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

const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define('game_room', GameRoom);

gameServer.listen(port).then(() => {
  console.log(`High Land multiplayer server listening on ${port}`);
});
