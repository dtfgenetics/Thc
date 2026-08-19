import assert from 'node:assert/strict';
import { startFleetBattleServer } from '../server/server.mjs';

const placementsA = [
  { shipId: 'glass-rig', row: 0, col: 0, orientation: 'H' },
  { shipId: 'water-pipe', row: 2, col: 0, orientation: 'H' },
  { shipId: 'rolling-tray', row: 4, col: 0, orientation: 'H' },
  { shipId: 'grinder', row: 6, col: 0, orientation: 'H' },
  { shipId: 'vape-pen', row: 8, col: 0, orientation: 'H' },
  { shipId: 'dugout', row: 10, col: 0, orientation: 'H' }
];
const placementsB = [
  { shipId: 'glass-rig', row: 0, col: 10, orientation: 'V' },
  { shipId: 'water-pipe', row: 0, col: 8, orientation: 'V' },
  { shipId: 'rolling-tray', row: 6, col: 10, orientation: 'V' },
  { shipId: 'grinder', row: 6, col: 8, orientation: 'V' },
  { shipId: 'vape-pen', row: 11, col: 10, orientation: 'V' },
  { shipId: 'dugout', row: 11, col: 8, orientation: 'V' }
];

const { server, address } = await startFleetBattleServer({
  port: 0,
  host: '127.0.0.1',
  allowedOrigin: 'https://dtfseeds.com',
  rateLimit: 500,
  bodyLimit: 4096
});
const base = `http://127.0.0.1:${address.port}`;

async function request(path, { method = 'GET', token, body, origin } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (origin) headers.origin = origin;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let payload = null;
  const text = await response.text();
  if (text) payload = JSON.parse(text);
  return { response, payload };
}

try {
  let result = await request('/health');
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.ok, true);

  result = await request('/api/rooms', { method: 'POST', body: { playerName: 'Alpha' }, origin: 'https://dtfseeds.com' });
  assert.equal(result.response.status, 201);
  const roomCode = result.payload.roomCode;
  const tokenA = result.payload.playerToken;
  assert.match(roomCode, /^[A-Z0-9]{6}$/);
  assert.ok(tokenA.length >= 20);
  assert.equal(result.payload.state.phase, 'lobby');
  assert.equal(result.payload.state.opponent, null);
  assert.equal(result.response.headers.get('access-control-allow-origin'), 'https://dtfseeds.com');

  result = await request(`/api/rooms/${roomCode}`);
  assert.equal(result.response.status, 401, 'room code alone must not authenticate a player');

  result = await request(`/api/rooms/${roomCode}`, { token: 'not-a-real-player-token-12345' });
  assert.equal(result.response.status, 401);

  result = await request(`/api/rooms/${roomCode}/join`, { method: 'POST', body: { playerName: 'Beta' } });
  assert.equal(result.response.status, 200);
  const tokenB = result.payload.playerToken;
  assert.ok(tokenB && tokenB !== tokenA);
  assert.equal(result.payload.state.phase, 'placement');

  result = await request(`/api/rooms/${roomCode}/join`, { method: 'POST', body: { playerName: 'Third' } });
  assert.equal(result.response.status, 400, 'a two-player room must reject a third player');

  result = await request(`/api/rooms/${roomCode}/fleet`, { method: 'POST', token: tokenA, body: { placements: placementsA } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.state.you.fleetLocked, true);
  assert.equal(result.payload.state.phase, 'placement');

  result = await request(`/api/rooms/${roomCode}/fleet`, { method: 'POST', token: tokenB, body: { placements: placementsB } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.state.phase, 'battle');

  result = await request(`/api/rooms/${roomCode}/state`, { token: tokenA });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.state.you.ships[0].cells.length, 5);
  assert.equal('cells' in result.payload.state.opponent.ships[0], false, 'opponent coordinates must stay private during battle');
  assert.equal('orientation' in result.payload.state.opponent.ships[0], false);

  result = await request(`/api/rooms/${roomCode}/attack`, { method: 'POST', token: tokenB, body: { row: 0, col: 0 } });
  assert.equal(result.response.status, 400, 'second player cannot attack first');

  result = await request(`/api/rooms/${roomCode}/attack`, { method: 'POST', token: tokenA, body: { row: 0, col: 10 } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.event.result, 'hit');
  assert.equal(result.payload.state.currentTurnPlayerId, result.payload.state.opponent.id);

  result = await request(`/api/rooms/${roomCode}/attack`, { method: 'POST', token: tokenB, body: { row: 14, col: 14 } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.event.result, 'miss');

  result = await request(`/api/rooms/${roomCode}/attack`, { method: 'POST', token: tokenA, body: { row: 0, col: 10 } });
  assert.equal(result.response.status, 400, 'duplicate attacks must be rejected');

  result = await request(`/api/rooms/${roomCode}/connection`, { method: 'POST', token: tokenB, body: { connected: false } });
  assert.equal(result.response.status, 200);
  const turnBeforeReconnect = result.payload.state.currentTurnPlayerId;
  assert.equal(result.payload.state.you.connected, false);

  result = await request(`/api/rooms/${roomCode}/connection`, { method: 'POST', token: tokenB, body: { connected: true } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.state.you.connected, true);
  assert.equal(result.payload.state.currentTurnPlayerId, turnBeforeReconnect, 'connection changes must not mutate turn authority');

  result = await request(`/api/rooms/${roomCode}/state`, { token: tokenA, origin: 'https://evil.example' });
  assert.equal(result.response.status, 403, 'unexpected browser origins must be rejected when an origin policy is configured');

  const hugeName = 'x'.repeat(5000);
  result = await request('/api/rooms', { method: 'POST', body: { playerName: hugeName } });
  assert.equal(result.response.status, 413, 'oversized bodies must be rejected before parsing into game state');

  result = await request(`/api/rooms/${roomCode}/state`, { token: tokenA });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.state.phase, 'battle');
  assert.equal('cells' in result.payload.state.opponent.ships[0], false);

  console.log('Cannabis Fleet Battle HTTP transport tests passed', { roomCode });
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
