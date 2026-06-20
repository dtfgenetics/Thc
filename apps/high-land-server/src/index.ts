import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './rooms/GameRoom.js';

const port = Number(process.env.PORT || 2567);
const app = express();
const server = createServer(app);

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define('game_room', GameRoom);

gameServer.listen(port).then(() => {
  console.log(`Game server listening on ${port}`);
});
