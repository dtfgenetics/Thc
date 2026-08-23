const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'games.json');
const GRID_SIZE = 15;
const FLEET = [
  { id: 'king-cola', name: 'King Cola', size: 5 },
  { id: 'fat-bud', name: 'Fat Bud', size: 4 },
  { id: 'top-shelf', name: 'Top Shelf', size: 3 },
  { id: 'sticky-nug', name: 'Sticky Nug', size: 3 },
  { id: 'little-leaf', name: 'Little Leaf', size: 2 }
];

fs.mkdirSync(DATA_DIR, { recursive: true });
let store = { games: {} };
try {
  if (fs.existsSync(STORE_FILE)) store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
} catch (err) {
  console.error('Could not read game store:', err.message);
}

const subscribers = new Map();

function saveStore() {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function id() {
  return crypto.randomUUID();
}

function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  do {
    out = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (store.games[out]);
  return out;
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24) || 'Grower';
}

function cleanChat(value) {
  return String(value || '').trim().slice(0, 280);
}

function ensureGame(code) {
  return store.games[String(code || '').toUpperCase()] || null;
}

function ensurePlayer(game, playerId) {
  return game.players.find(p => p.id === playerId) || null;
}

function playerIndex(game, playerId) {
  return game.players.findIndex(p => p.id === playerId);
}

function now() { return new Date().toISOString(); }

function pushSystem(game, text) {
  game.chat.push({ id: id(), kind: 'system', text, at: now() });
  if (game.chat.length > 150) game.chat = game.chat.slice(-150);
}

function broadcast(game) {
  const set = subscribers.get(game.code);
  if (!set) return;
  for (const client of set) {
    try {
      const view = sanitizeGame(game, client.playerId);
      client.res.write(`event: state\ndata: ${JSON.stringify(view)}\n\n`);
    } catch {}
  }
}

function sanitizeGame(game, viewerId) {
  const meIdx = playerIndex(game, viewerId);
  const oppIdx = meIdx === 0 ? 1 : meIdx === 1 ? 0 : -1;
  const me = meIdx >= 0 ? game.players[meIdx] : null;
  const opp = oppIdx >= 0 ? game.players[oppIdx] : null;
  const revealOpponentFleet = game.status === 'finished';

  return {
    code: game.code,
    status: game.status,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    winnerId: game.winnerId,
    turnPlayerId: game.turnPlayerId,
    gridSize: GRID_SIZE,
    fleetSpec: FLEET,
    me: me ? {
      id: me.id,
      name: me.name,
      ready: me.ready,
      fleet: me.fleet,
      shotsReceived: me.shotsReceived,
      connectedAt: me.connectedAt
    } : null,
    opponent: opp ? {
      id: opp.id,
      name: opp.name,
      ready: opp.ready,
      fleet: revealOpponentFleet ? opp.fleet : undefined,
      shotsReceived: opp.shotsReceived,
      connectedAt: opp.connectedAt
    } : null,
    players: game.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
    chat: game.chat.slice(-100),
    lastEvent: game.lastEvent || null
  };
}

function validFleet(fleet) {
  if (!Array.isArray(fleet) || fleet.length !== FLEET.length) return false;
  const occupied = new Set();
  for (const spec of FLEET) {
    const ship = fleet.find(s => s.id === spec.id);
    if (!ship || !Array.isArray(ship.cells) || ship.cells.length !== spec.size) return false;
    const cells = ship.cells.map(c => ({ row: Number(c.row), col: Number(c.col) }));
    if (cells.some(c => !Number.isInteger(c.row) || !Number.isInteger(c.col) || c.row < 0 || c.col < 0 || c.row >= GRID_SIZE || c.col >= GRID_SIZE)) return false;
    const rows = new Set(cells.map(c => c.row));
    const cols = new Set(cells.map(c => c.col));
    if (rows.size !== 1 && cols.size !== 1) return false;
    if (rows.size === 1) {
      const sorted = cells.map(c => c.col).sort((a,b)=>a-b);
      for (let i=1;i<sorted.length;i++) if (sorted[i] !== sorted[i-1] + 1) return false;
    } else {
      const sorted = cells.map(c => c.row).sort((a,b)=>a-b);
      for (let i=1;i<sorted.length;i++) if (sorted[i] !== sorted[i-1] + 1) return false;
    }
    for (const c of cells) {
      const key = `${c.row}:${c.col}`;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return true;
}

function shipAt(player, row, col) {
  return player.fleet.find(ship => ship.cells.some(c => c.row === row && c.col === col));
}

function isShipSunk(player, ship) {
  return ship.cells.every(cell => player.shotsReceived.some(s => s.row === cell.row && s.col === cell.col && s.hit));
}

function allSunk(player) {
  return player.fleet.length && player.fleet.every(ship => isShipSunk(player, ship));
}

function startIfReady(game) {
  if (game.players.length === 2 && game.players.every(p => p.ready) && game.status === 'placement') {
    game.status = 'playing';
    game.turnPlayerId = game.players[Math.floor(Math.random() * 2)].id;
    pushSystem(game, `${ensurePlayer(game, game.turnPlayerId).name} fires first.`);
  }
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const safe = path.normalize(rel).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8'
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, name: 'Burn Buds' });

  if (req.method === 'POST' && pathname === '/api/games') {
    try {
      const body = await readBody(req);
      const player = { id: id(), name: cleanName(body.name), ready: false, fleet: [], shotsReceived: [], connectedAt: now() };
      const code = roomCode();
      const game = {
        code, status: 'waiting', createdAt: now(), updatedAt: now(), winnerId: null, turnPlayerId: null,
        players: [player], chat: [], lastEvent: null
      };
      pushSystem(game, `${player.name} created the burn room.`);
      store.games[code] = game;
      saveStore();
      return json(res, 201, { code, playerId: player.id, game: sanitizeGame(game, player.id) });
    } catch (err) { return json(res, 400, { error: err.message }); }
  }

  const joinMatch = pathname.match(/^\/api\/games\/([A-Z0-9]{6})\/join$/i);
  if (req.method === 'POST' && joinMatch) {
    try {
      const game = ensureGame(joinMatch[1]);
      if (!game) return json(res, 404, { error: 'Room not found' });
      if (game.players.length >= 2) return json(res, 409, { error: 'Room is full' });
      const body = await readBody(req);
      const player = { id: id(), name: cleanName(body.name), ready: false, fleet: [], shotsReceived: [], connectedAt: now() };
      game.players.push(player);
      game.status = 'placement';
      game.updatedAt = now();
      pushSystem(game, `${player.name} joined the room. Place your leaves.`);
      saveStore(); broadcast(game);
      return json(res, 200, { code: game.code, playerId: player.id, game: sanitizeGame(game, player.id) });
    } catch (err) { return json(res, 400, { error: err.message }); }
  }

  const gameMatch = pathname.match(/^\/api\/games\/([A-Z0-9]{6})$/i);
  if (req.method === 'GET' && gameMatch) {
    const game = ensureGame(gameMatch[1]);
    if (!game) return json(res, 404, { error: 'Room not found' });
    const playerId = url.searchParams.get('playerId');
    if (!ensurePlayer(game, playerId)) return json(res, 403, { error: 'Player not in this room' });
    return json(res, 200, sanitizeGame(game, playerId));
  }

  const placeMatch = pathname.match(/^\/api\/games\/([A-Z0-9]{6})\/place$/i);
  if (req.method === 'POST' && placeMatch) {
    try {
      const game = ensureGame(placeMatch[1]);
      if (!game) return json(res, 404, { error: 'Room not found' });
      const body = await readBody(req);
      const player = ensurePlayer(game, body.playerId);
      if (!player) return json(res, 403, { error: 'Player not in this room' });
      if (!['waiting','placement'].includes(game.status)) return json(res, 409, { error: 'Fleet placement is closed' });
      if (!validFleet(body.fleet)) return json(res, 400, { error: 'Invalid fleet placement' });
      player.fleet = body.fleet.map(ship => ({ id: ship.id, cells: ship.cells.map(c => ({ row: c.row, col: c.col })) }));
      player.ready = true;
      if (game.players.length === 2) game.status = 'placement';
      game.updatedAt = now();
      pushSystem(game, `${player.name} locked in their leaf fleet.`);
      startIfReady(game);
      saveStore(); broadcast(game);
      return json(res, 200, sanitizeGame(game, player.id));
    } catch (err) { return json(res, 400, { error: err.message }); }
  }

  const fireMatch = pathname.match(/^\/api\/games\/([A-Z0-9]{6})\/fire$/i);
  if (req.method === 'POST' && fireMatch) {
    try {
      const game = ensureGame(fireMatch[1]);
      if (!game) return json(res, 404, { error: 'Room not found' });
      const body = await readBody(req);
      const shooter = ensurePlayer(game, body.playerId);
      if (!shooter) return json(res, 403, { error: 'Player not in this room' });
      if (game.status !== 'playing') return json(res, 409, { error: 'Game is not active' });
      if (game.turnPlayerId !== shooter.id) return json(res, 409, { error: 'Not your turn' });
      const target = game.players.find(p => p.id !== shooter.id);
      if (!target) return json(res, 409, { error: 'Waiting for opponent' });
      const row = Number(body.row), col = Number(body.col);
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE) return json(res, 400, { error: 'Invalid target' });
      if (target.shotsReceived.some(s => s.row === row && s.col === col)) return json(res, 409, { error: 'You already fired there' });
      const ship = shipAt(target, row, col);
      const shot = { row, col, hit: !!ship, at: now(), by: shooter.id };
      target.shotsReceived.push(shot);
      let sunkShipId = null;
      if (ship && isShipSunk(target, ship)) sunkShipId = ship.id;
      const event = {
        id: id(), type: sunkShipId ? 'sunk' : ship ? 'hit' : 'miss', byPlayerId: shooter.id,
        targetPlayerId: target.id, row, col, shipId: sunkShipId, at: now()
      };
      game.lastEvent = event;
      if (sunkShipId) pushSystem(game, `🔥 ${shooter.name} BURNED ${target.name}'s ${FLEET.find(f => f.id === sunkShipId)?.name || 'bud'}!`);
      else if (ship) pushSystem(game, `${shooter.name} scored a hit.`);
      if (allSunk(target)) {
        game.status = 'finished';
        game.winnerId = shooter.id;
        game.turnPlayerId = null;
        pushSystem(game, `🏆 ${shooter.name} burned the whole garden and wins!`);
      } else {
        game.turnPlayerId = target.id;
      }
      game.updatedAt = now();
      saveStore(); broadcast(game);
      return json(res, 200, sanitizeGame(game, shooter.id));
    } catch (err) { return json(res, 400, { error: err.message }); }
  }

  const chatMatch = pathname.match(/^\/api\/games\/([A-Z0-9]{6})\/chat$/i);
  if (req.method === 'POST' && chatMatch) {
    try {
      const game = ensureGame(chatMatch[1]);
      if (!game) return json(res, 404, { error: 'Room not found' });
      const body = await readBody(req);
      const player = ensurePlayer(game, body.playerId);
      if (!player) return json(res, 403, { error: 'Player not in this room' });
      const text = cleanChat(body.text);
      if (!text) return json(res, 400, { error: 'Message is empty' });
      game.chat.push({ id: id(), kind: 'player', playerId: player.id, name: player.name, text, at: now() });
      game.chat = game.chat.slice(-150);
      game.updatedAt = now();
      saveStore(); broadcast(game);
      return json(res, 201, { ok: true });
    } catch (err) { return json(res, 400, { error: err.message }); }
  }

  const eventMatch = pathname.match(/^\/api\/games\/([A-Z0-9]{6})\/events$/i);
  if (req.method === 'GET' && eventMatch) {
    const game = ensureGame(eventMatch[1]);
    const playerId = url.searchParams.get('playerId');
    if (!game || !ensurePlayer(game, playerId)) return json(res, 404, { error: 'Game/player not found' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*', 'X-Accel-Buffering': 'no'
    });
    res.write(`event: state\ndata: ${JSON.stringify(sanitizeGame(game, playerId))}\n\n`);
    const client = { playerId, res };
    if (!subscribers.has(game.code)) subscribers.set(game.code, new Set());
    subscribers.get(game.code).add(client);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
    req.on('close', () => {
      clearInterval(ping);
      subscribers.get(game.code)?.delete(client);
      if (!subscribers.get(game.code)?.size) subscribers.delete(game.code);
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/active') {
    const playerId = url.searchParams.get('playerId');
    const games = Object.values(store.games)
      .filter(g => ['waiting','placement','playing'].includes(g.status) && g.players.some(p => p.id === playerId))
      .map(g => sanitizeGame(g, playerId));
    return json(res, 200, { games });
  }

  if (req.method === 'GET' && serveStatic(res, pathname)) return;
  if (req.method === 'GET') return serveStatic(res, '/index.html') || json(res, 404, { error: 'Not found' });
  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`Burn Buds running on http://localhost:${PORT}`));
