import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const publicDir = path.join(root, 'site/public-route-patch/games/bud-or-bluff');
const fsPromises = await import('node:fs/promises');
const appSource = await fsPromises.readFile(path.join(publicDir, 'app-v2.js'), 'utf8');
const htmlSource = await fsPromises.readFile(path.join(publicDir, 'index.html'), 'utf8');
const cssSource = await fsPromises.readFile(path.join(publicDir, 'styles.css'), 'utf8');
const visualCss = await import('node:fs/promises').then(fs => fs.readFile(path.join(publicDir, 'visual-state-v3.css'), 'utf8'));
const visualJs = await import('node:fs/promises').then(fs => fs.readFile(path.join(publicDir, 'visual-state-v3.js'), 'utf8'));
assert.match(appSource, /async function copyText/);
assert.match(appSource, /document\.execCommand\?\.\('copy'\)/);
assert.match(appSource, /Copy failed\. Use Share invite or copy the room code\./);
assert.match(visualCss, /@media\(forced-colors:active\)/);
assert.match(htmlSource, /visual-state-v3\.css\?v=20260921-mobile-player-rail-v1/, 'mobile player rail CSS must be cache-versioned');
assert.match(htmlSource, /visual-state-v3\.js\?v=20260921-mobile-player-rail-v1/, 'mobile player rail JS must be cache-versioned');
assert.match(visualJs, /mobilePlayerRail/, 'mobile player score rail runtime missing');
assert.match(visualJs, /observe\(scoreboard,syncMobilePlayerRail\)/, 'mobile player rail must stay synchronized with the authoritative scoreboard');
assert.match(visualJs, /aria-label','Player scores'/, 'mobile player rail must expose an accessible score list');
assert.match(visualCss, /mobile player rail v1/, 'mobile player rail presentation layer missing');
assert.match(visualCss, /@media\(max-width:720px\)[\s\S]*\.mobile-player-rail\{[\s\S]*display:flex/, 'mobile player rail must activate on phone/tablet play surfaces');
assert.match(visualCss, /@media\(max-width:720px\)[\s\S]*\.score-panel\{[\s\S]*display:none/, 'full scoreboard must yield to the compact mobile rail');
assert.match(htmlSource, /id="timerText" role="timer" aria-label="Seconds remaining"/, 'rapid countdown must not be an aria-live region');
assert.doesNotMatch(htmlSource, /id="timerText"[^>]*aria-live=/, 'timer must stay non-live');
assert.doesNotMatch(htmlSource, /id="chatMessages"[^>]*aria-live=/, 'visible chat history must not be re-announced wholesale');
assert.match(htmlSource, /id="chatAnnounce" class="sr-only" aria-live="polite" aria-atomic="true"/, 'chat needs a dedicated incremental live announcer');
assert.match(appSource, /let lastAnnouncedChatId = null;/, 'chat announcer must track the last announced server message id');
assert.match(appSource, /announceNewChat\(messages\)/, 'chat render must announce only new messages');
assert.match(appSource, /messages\.findIndex\(message=>message\.id===lastAnnouncedChatId\)/, 'chat announcer must use stable message ids');
assert.match(cssSource, /\.sr-only\{[\s\S]*clip:rect\(0,0,0,0\)/, 'chat announcer must remain visually hidden');

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
