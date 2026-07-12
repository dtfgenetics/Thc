import { createServer } from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RoomService } from './domain/RoomService.js';
import { createHttpApp } from './http/createHttpApp.js';
import { GameRoom } from './rooms/GameRoom.js';
import { createRoomStoreFromEnvironment } from './storage/RoomStore.js';

const port = Number(process.env.PORT || 2567);
const roomStore = createRoomStoreFromEnvironment();
const roomService = new RoomService(roomStore);
const app = createHttpApp(roomService);
const server = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define('game_room', GameRoom);

gameServer.listen(port).then(() => {
  console.log(`High Land multiplayer server listening on ${port}`);
});
