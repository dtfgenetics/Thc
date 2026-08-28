import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('site/public-route-patch/games/protect-the-plants');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('app.js');
const enhancements = read('enhancements.js');
const extras = read('v2-extras.js');
const branding = read('burn-buds-branding.js');
const css = read('burn-buds.css');
const index = read('index.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const serviceWorker = read('sw.js');
const game = JSON.parse(fs.readFileSync('games/protect-the-plants/game.json', 'utf8'));

assert.equal(game.title, 'Burn Buds');
assert.equal(game.board, '15x15');
assert.equal(game.players, 2);
assert.equal(game.status, 'playable-beta');
assert.equal(game.route, '/games/protect-the-plants/');
assert.equal(manifest.name, 'Burn Buds');
assert.equal(manifest.short_name, 'Burn Buds');

for (const marker of [
  "const PRODUCT='Burn Buds'",
  "const BUD_SVG=",
  "const SESSION_KEY='burnBudsSession'",
  "const LEGACY_SESSION_KEY='protectPlantsSession'",
  'Hide your buds. Burn theirs.',
  'Your Stash Preview',
  'Bud Formations',
  'Battle Grid',
  'Burn Log',
  'BUDS BURNED',
  'Place Your Buds',
  'Lock Stash',
  'Your Stash',
  'Fire on Opponent',
  'Shots</span>',
  "api('fire'",
  "api('place'",
  "ev.type==='scout'"
]) {
  assert.ok(app.includes(marker), `Missing native Burn Buds runtime marker: ${marker}`);
}

for (const forbidden of [
  '<strong>Protect the Plants</strong>',
  'Defend your garden. Scout theirs.',
  'Your Garden Preview',
  'Plant Formations',
  'Garden Locked',
  'Place Your Plants',
  'Garden Protected',
  'Garden Lost',
  'Scout Opponent',
  '<span>Scouts</span>'
]) {
  assert.ok(!app.includes(forbidden), `Legacy player-facing copy remains in base runtime: ${forbidden}`);
}

for (const marker of [
  "document.title = '● Your Turn · Burn Buds'",
  '<small>BURN BUDS</small>',
  'Confirm firing taps',
  'tap again to fire.',
  'BUDS BURNED',
  'Join my Burn Buds game'
]) {
  assert.ok(enhancements.includes(marker), `Missing Burn Buds enhancement marker: ${marker}`);
}

for (const forbidden of [
  '<small>PROTECT THE PLANTS</small>',
  'Confirm scouting taps',
  'tap again to scout.',
  'Join my Protect the Plants game',
  'Garden state updated.',
  'FORMATION FOUND'
]) {
  assert.ok(!enhancements.includes(forbidden), `Legacy enhancement copy remains: ${forbidden}`);
}

for (const marker of [
  "const HISTORY_KEY='burnBudsMatchHistoryV3'",
  "const LEGACY_HISTORY_KEY='ptpMatchHistoryV2'",
  'Opponent Buds Burned',
  'Your Buds Burned',
  'in Burn Buds'
]) {
  assert.ok(extras.includes(marker), `Missing Burn Buds history/share marker: ${marker}`);
}

for (const forbidden of ['Garden Protected', 'Garden Lost', 'in Protect the Plants']) {
  assert.ok(!extras.includes(forbidden), `Legacy history/share copy remains: ${forbidden}`);
}

for (const marker of [
  '.cell.can-fire',
  'burn-impact',
  'burn-miss-ring',
  'burn-bud-lost',
  '.burn-buds-meta'
]) {
  assert.ok(css.includes(marker), `Missing Burn Buds battle feedback marker: ${marker}`);
}

for (const feature of [
  'room-chat',
  'active-game-recovery',
  'burned-formation-animation',
  'cannabis-leaf-fleet-markers',
  'server-authoritative-turns',
  'two-player-rematch-consent'
]) {
  assert.ok(game.features.includes(feature), `Burn Buds feature contract missing: ${feature}`);
}

assert.ok(index.includes('>Burn Buds</h1>'));
assert.ok(index.includes('BUD BURNED!'));
assert.ok(index.includes('./burn-buds-branding.js'));
assert.ok(index.includes('./burn-buds.css'));
assert.ok(branding.includes("const PRODUCT='Burn Buds'"));
assert.ok(serviceWorker.includes('ptp-shell-v2-burn-buds-native-20260827'));

console.log('Burn Buds native branding, migration, cache, and multiplayer contract checks passed.');