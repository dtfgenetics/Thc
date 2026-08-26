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
    try { const res = await fetch(`${base}/index.html`); if (res.ok) return; } catch {}
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
  const res = await fetch(`${base}/api-v2.php?${qs}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${action}: ${data.error || res.status}`);
  return data;
}

try {
  await waitForServer();
  const host = await json('create', { method: 'POST', body: { name: 'Host', rounds: 8, voteSeconds: 24, revealSeconds: 9, autoAdvance: false } });
  const sessions = [host];
  for (let i = 2; i <= 9; i++) sessions.push(await json('join', { method: 'POST', body: { code: host.code, name: `Player ${i}` } }));

  let state = await json('lock', { method: 'POST', body: {}, session: host });
  assert.equal(state.joinLocked, true, 'host should be able to lock the lobby');
  await assert.rejects(() => json('join', { method: 'POST', body: { code: host.code, name: 'Blocked Player' } }));
  state = await json('lock', { method: 'POST', body: {}, session: host });
  assert.equal(state.joinLocked, false, 'host should be able to reopen the lobby');
  sessions.push(await json('join', { method: 'POST', body: { code: host.code, name: 'Player 10' } }));

  state = await json('settings', { method: 'POST', body: { rounds: 8, voteSeconds: 35, revealSeconds: 12, autoAdvance: false }, session: host });
  assert.equal(state.voteSeconds, 35);
  assert.equal(state.revealSeconds, 12);
  assert.equal(state.autoAdvance, false);
  assert.equal(state.players.filter(p => p.active).length, 10);

  state = await json('start', { method: 'POST', body: {}, session: host });
  assert.equal(state.status, 'voting');
  assert.equal(state.joinLocked, true);
  assert.ok(state.card?.name);
  assert.equal('answer' in state.card, false, 'answer must remain hidden during voting');

  await Promise.all(sessions.map((session, index) => json('vote', {
    method: 'POST',
    body: { vote: index % 2 === 0 ? 'BUD' : 'BLUFF', double: index === 0 },
    session,
  })));

  state = await json('state', { session: host });
  assert.equal(state.status, 'reveal');
  assert.equal(state.players.filter(p => p.hasVoted).length, 10, 'all simultaneous votes must survive locking');
  assert.equal(state.roundSummary.budVotes + state.roundSummary.bluffVotes, 10);
  assert.equal(state.roundSummary.active, 10);
  assert.ok(['BUD', 'BLUFF'].includes(state.card.answer));
  assert.ok(state.players.every(p => Object.hasOwn(p, 'vote')), 'votes become public only after reveal');

  await assert.rejects(() => json('next', { method: 'POST', body: {}, session: host }), /moment/i);
  await delay(2100);
  state = await json('next', { method: 'POST', body: {}, session: host });
  assert.equal(state.status, 'voting');
  assert.equal(state.round, 2);
  assert.equal('answer' in state.card, false);

  state = await json('end', { method: 'POST', body: {}, session: host });
  assert.equal(state.status, 'finished');
  state = await json('rematch', { method: 'POST', body: {}, session: host });
  assert.equal(state.status, 'lobby');
  assert.equal(state.joinLocked, false);
  assert.ok(state.players.every(p => p.score === 0 && p.doubleAvailable), 'rematch should reset scores and Double Hit');

  await json('leave', { method: 'POST', body: {}, session: host });
  state = await json('state', { session: sessions[1] });
  assert.equal(state.players.filter(p => p.active).length, 9);
  assert.equal(state.hostId, sessions[1].playerId, 'host should transfer when the host leaves');

  console.log(`Bud or Bluff v2 OK: ${host.code}, 10-player concurrent vote, host controls, reveal stats, rematch, host transfer.`);
} finally {
  php.kill('SIGTERM');
}
