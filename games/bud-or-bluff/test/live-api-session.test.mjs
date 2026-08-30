import assert from 'node:assert/strict';

const site = String(process.env.BOB_SITE || 'https://dtfseeds.com').replace(/\/+$/, '');
const api = `${site}/games/bud-or-bluff/api-v2.php`;
const probe = `BrowserRepair${Date.now().toString().slice(-6)}`;

async function request(action, { method = 'GET', body, session } = {}) {
  const url = new URL(api);
  url.searchParams.set('action', action);
  url.searchParams.set('dtf_bob_live_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  if (session?.code) url.searchParams.set('code', session.code);

  const headers = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache, no-store, max-age=0',
    Pragma: 'no-cache',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session?.playerId) headers['X-Player-Id'] = session.playerId;
  if (session?.token) headers['X-Player-Token'] = session.token;

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (response.status !== 200) {
    throw new Error(`${action} returned HTTP ${response.status}: ${data.error || text.slice(0, 300)}`);
  }
  assert.equal(response.headers.get('location'), null, `${action} unexpectedly redirected`);
  return { data, headers: response.headers };
}

let host;
try {
  const created = await request('create', {
    method: 'POST',
    body: { name: probe, rounds: 8, voteSeconds: 24, revealSeconds: 9, autoAdvance: false },
  });
  host = created.data;
  assert.match(host.code || '', /^[A-Z0-9]{6}$/, `create returned invalid room code: ${host.code}`);
  assert.ok(host.playerId, 'create did not return playerId');
  assert.ok(host.token, 'create did not return token');
  assert.equal(created.headers.get('x-dtf-bud-or-bluff-storage'), 'durable-v3', 'production API is not using the durable storage bootstrap');

  const recovered = await request('state', { session: host });
  const state = recovered.data;
  assert.equal(state.code, host.code, 'state could not recover the newly created room');
  assert.equal(state.status, 'lobby');
  assert.equal(state.me?.name, probe);
  assert.equal(state.players?.filter((player) => player.active).length, 1);
  assert.equal(recovered.headers.get('x-dtf-bud-or-bluff-storage'), 'durable-v3');

  console.log(JSON.stringify({
    ok: true,
    route: '/games/bud-or-bluff/',
    roomCode: host.code,
    create: true,
    immediateStateRecovery: true,
    storage: 'durable-v3',
  }, null, 2));
} finally {
  if (host?.code && host?.playerId && host?.token) {
    await request('leave', { method: 'POST', body: {}, session: host }).catch(() => {});
  }
}
