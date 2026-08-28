import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('site/public-route-patch/games/protect-the-plants');
const branding = fs.readFileSync(path.join(root, 'burn-buds-branding.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'burn-buds.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = JSON.parse(fs.readFileSync('games/protect-the-plants/game.json', 'utf8'));

assert.equal(game.title, 'Burn Buds');
assert.equal(game.board, '15x15');
assert.equal(game.players, 2);
assert.equal(game.status, 'playable-beta');
assert.equal(game.route, '/games/protect-the-plants/');

for (const marker of [
  "const PRODUCT='Burn Buds'",
  'Hide your buds. Burn theirs.',
  'Your Stash Preview',
  'Bud Formations',
  'Battle Grid',
  'Burn Log',
  'BUDS BURNED',
  '15×15 Grid',
  'Live Rooms',
  'Room Chat'
]) {
  assert.ok(branding.includes(marker), `Missing Burn Buds branding marker: ${marker}`);
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

console.log('Burn Buds branding and multiplayer contract checks passed.');
