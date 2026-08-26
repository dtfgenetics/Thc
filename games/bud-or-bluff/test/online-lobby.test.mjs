import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const publicDir = path.join(root, 'site/public-route-patch/games/bud-or-bluff');

async function openPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

const port = await openPort();
const base = `http://127.0.0.1:${port}`;
const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', publicDir], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
php.stderr.on('data', chunk => { stderr += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${base}/index.html`);
      if (res.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`PHP test server did not start. ${stderr}`);
}

async function json(action, { method = 'GET', body, session } = {}) {
  const qs = new URLSearchParams({ action });
  if (session?.code) qs.set('code', session.code);
  const headers = { 'Content-Type': 'application/json' };
  if (session?.playerId) headers['X-Player-Id'] = session.playerId;
  if (session?.token) headers['X-Player-Token'] = session.token;
  const res = await fetch(`${base}/api.php?${qs}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${action}: ${data.error || res.status}`);
  return data;
}

try {
  await waitForServer();

  const host = await json('create', { method: 'POST', body: { name: 'Host', rounds: 6 } });
  const sessions = [host];
  for (let i = 2; i <= 10; i++) {
    sessions.push(await json('join', { method: 'POST', body: { code: host.code, name: `Player ${i}` } }));
  }

  let state = await json('state', { session: host });
  assert.equal(state.players.length, 10, 'room should contain 10 players');
  assert.equal(state.status, 'lobby');

  state = await json('start', { method: 'POST', body: {}, session: host });
  assert.equal(state.status, 'voting');
  assert.ok(state.card?.name, 'voting state should expose the strain name');
  assert.equal('answer' in state.card, false, 'answer must stay server-side while voting');

  await Promise.all(sessions.map((session, index) => json('vote', {
    method: 'POST',
    body: { vote: index % 2 === 0 ? 'BUD' : 'BLUFF', double: index === 0 },
    session,
  })));

  state = await json('state', { session: host });
  assert.equal(state.status, 'reveal', 'room should reveal after all 10 votes arrive');
  assert.equal(state.players.filter(player => player.hasVoted).length, 10, 'all concurrent votes must survive');
  assert.ok(['BUD', 'BLUFF'].includes(state.card.answer), 'answer should be exposed during reveal');
  assert.ok(state.players.every(player => Object.hasOwn(player, 'vote')), 'all votes may be public after reveal');

  const playerTwo = await json('state', { session: sessions[1] });
  assert.equal(playerTwo.status, 'reveal');
  assert.equal(playerTwo.players.length, 10);

  state = await json('next', { method: 'POST', body: {}, session: host });
  assert.equal(state.status, 'voting');
  assert.equal(state.round, 2);
  assert.equal(state.players.filter(player => player.hasVoted).length, 0, 'next round should clear prior votes');
  assert.equal('answer' in state.card, false, 'next answer must be hidden again');

  let rejected = false;
  try {
    await json('join', { method: 'POST', body: { code: host.code, name: 'Player 11' } });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, 'joining after the game starts must be rejected');

  console.log(`Bud or Bluff online lobby OK: room ${host.code}, 10 concurrent players, hidden answers, synchronized reveal.`);
} finally {
  php.kill('SIGTERM');
}
