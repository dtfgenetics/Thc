import { spawn } from 'node:child_process';
import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(appRoot, 'public', 'api');
const routerPath = path.join(appRoot, 'scripts', 'room-api-test-router.php');
const port = 19000 + (process.pid % 1000);
const origin = `http://127.0.0.1:${port}`;
const apiBase = origin;
const hostCredential = 'h'.repeat(64);
const guestCredential = 'g'.repeat(64);

await Promise.all([
  access(routerPath),
  access(path.join(apiRoot, 'index.php')),
  access(path.join(apiRoot, 'create-room.php')),
  access(path.join(apiRoot, 'join-room.php')),
  access(path.join(apiRoot, 'get-room.php')),
  access(path.join(apiRoot, 'update-room.php')),
  access(path.join(apiRoot, 'append-event.php'))
]);

const server = spawn('php', ['-S', `127.0.0.1:${port}`, routerPath], {
  cwd: appRoot,
  stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
server.stderr.on('data', (chunk) => { stderr += String(chunk); });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${apiBase}/${endpoint}`, options);
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

async function post(endpoint, body) {
  return request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function gameState(currentPlayerIndex) {
  return {
    players: [
      { id: 'host-1', name: 'Host', token: 'tokenA', color: '#ef4444', positionIndex: 0, skipTurns: 0, protectedFromBackward: 0 },
      { id: 'guest-1', name: 'Guest', token: 'tokenB', color: '#22c55e', positionIndex: 0, skipTurns: 0, protectedFromBackward: 0 }
    ],
    currentPlayerIndex,
    phase: 'ready',
    turnDirection: 1,
    reverseTurnsRemaining: 0,
    lastRoll: null,
    lastMove: null,
    lastCard: null,
    message: 'Security verification',
    winnerId: null,
    cardCursor: 0
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/create-room.php`);
      if (response.status === 405) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`PHP room API did not start through ${routerPath}. ${stderr}`);
}

let roomCode = '';
try {
  await waitForServer();

  const created = await post('create-room.php', {
    game: 'high-land',
    maxPlayers: 10,
    playerId: 'host-1',
    playerName: 'Host',
    token: 'tokenA',
    color: '#ef4444',
    credential: hostCredential,
    state: null
  });
  assert(created.status === 200 && created.payload?.ok, `Room create failed: ${created.status}`);
  roomCode = created.payload.room?.code ?? '';
  assert(roomCode, 'Room create returned no room code.');
  const createdText = JSON.stringify(created.payload);
  assert(!createdText.includes('authHash'), 'Create response leaked authHash.');
  assert(!createdText.includes(hostCredential), 'Create response leaked credential.');

  const joined = await post('join-room.php', {
    roomCode,
    playerId: 'guest-1',
    playerName: 'Guest',
    token: 'tokenB',
    color: '#22c55e',
    credential: guestCredential
  });
  assert(joined.status === 200 && joined.payload?.ok, `Room join failed: ${joined.status}`);
  assert(joined.payload.room?.players?.length === 2, 'Guest was not added to the room.');
  const joinedText = JSON.stringify(joined.payload);
  assert(!joinedText.includes('authHash'), 'Join response leaked authHash.');
  assert(!joinedText.includes(guestCredential), 'Join response leaked credential.');

  const wrongRejoin = await post('join-room.php', {
    roomCode,
    playerId: 'guest-1',
    playerName: 'Guest',
    token: 'tokenB',
    color: '#22c55e',
    credential: 'x'.repeat(64)
  });
  assert(wrongRejoin.status === 403, `Existing-player rejoin accepted wrong credential: ${wrongRejoin.status}`);

  const publicRoom = await request(`get-room.php?room=${encodeURIComponent(roomCode)}`);
  assert(publicRoom.status === 200 && publicRoom.payload?.ok, 'Public room read failed.');
  const publicText = JSON.stringify(publicRoom.payload);
  assert(!publicText.includes('authHash'), 'Public room read leaked authHash.');
  assert(!publicText.includes(hostCredential) && !publicText.includes(guestCredential), 'Public room read leaked a credential.');

  const forgedHost = await post('update-room.php', {
    roomCode,
    playerId: 'host-1',
    credential: 'z'.repeat(64),
    status: 'playing',
    state: gameState(0)
  });
  assert(forgedHost.status === 403, `Forged host credential was accepted: ${forgedHost.status}`);

  const guestStart = await post('update-room.php', {
    roomCode,
    playerId: 'guest-1',
    credential: guestCredential,
    status: 'playing',
    state: gameState(0)
  });
  assert(guestStart.status === 403, `Guest was allowed to start the room: ${guestStart.status}`);

  const hostStart = await post('update-room.php', {
    roomCode,
    playerId: 'host-1',
    credential: hostCredential,
    status: 'playing',
    state: gameState(0)
  });
  assert(hostStart.status === 200 && hostStart.payload?.ok, `Valid host could not start: ${hostStart.status}`);

  const guestOutOfTurn = await post('update-room.php', {
    roomCode,
    playerId: 'guest-1',
    credential: guestCredential,
    status: 'playing',
    state: gameState(1)
  });
  assert(guestOutOfTurn.status === 409, `Guest mutated host turn: ${guestOutOfTurn.status}`);

  const hostPassesTurn = await post('update-room.php', {
    roomCode,
    playerId: 'host-1',
    credential: hostCredential,
    status: 'playing',
    state: gameState(1)
  });
  assert(hostPassesTurn.status === 200 && hostPassesTurn.payload?.ok, `Host could not complete own turn: ${hostPassesTurn.status}`);

  const hostOutOfTurn = await post('update-room.php', {
    roomCode,
    playerId: 'host-1',
    credential: hostCredential,
    status: 'playing',
    state: gameState(0)
  });
  assert(hostOutOfTurn.status === 409, `Host bypassed guest turn authority: ${hostOutOfTurn.status}`);

  const guestTurn = await post('update-room.php', {
    roomCode,
    playerId: 'guest-1',
    credential: guestCredential,
    status: 'playing',
    state: gameState(0)
  });
  assert(guestTurn.status === 200 && guestTurn.payload?.ok, `Guest could not complete own turn: ${guestTurn.status}`);

  const forgedEvent = await post('append-event.php', {
    roomCode,
    playerId: 'host-1',
    credential: 'q'.repeat(64),
    event: { id: 'event-forged', name: 'dice_rolled', roomCode, playerId: 'host-1', createdAt: new Date().toISOString(), payload: { roll: 6 } }
  });
  assert(forgedEvent.status === 403, `Event endpoint accepted forged credential: ${forgedEvent.status}`);

  const validEvent = await post('append-event.php', {
    roomCode,
    playerId: 'guest-1',
    credential: guestCredential,
    event: { id: 'event-valid', name: 'dice_rolled', roomCode, playerId: 'guest-1', createdAt: new Date().toISOString(), payload: { roll: 4 } }
  });
  assert(validEvent.status === 200 && validEvent.payload?.ok, `Authenticated event append failed: ${validEvent.status}`);

  console.log(`High Land room API security verification passed for room ${roomCode}.`);
} finally {
  if (roomCode) {
    const roomBase = path.join(apiRoot, '_rooms', roomCode);
    await rm(`${roomBase}.json`, { force: true });
    await rm(`${roomBase}.json.lock`, { force: true });
  }
  server.kill('SIGTERM');
}
