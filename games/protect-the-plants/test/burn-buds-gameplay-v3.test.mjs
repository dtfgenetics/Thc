import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('site/public-route-patch/games/protect-the-plants');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const gameplay = read('gameplay-v3.js');
const css = read('gameplay-v3.css');
const presence = read('presence.php');
const sw = read('sw.js');

for (const asset of ['gameplay-v3.js', 'gameplay-v3.css', 'presence.php']) {
  assert.ok(fs.existsSync(path.join(root, asset)), `Missing Burn Buds gameplay asset: ${asset}`);
}

assert.ok(index.includes('./gameplay-v3.css'));
assert.ok(index.includes('./gameplay-v3.js'));
assert.ok(sw.includes('./gameplay-v3.css'));
assert.ok(sw.includes('./gameplay-v3.js'));
assert.ok(sw.includes("url.pathname.endsWith('/presence.php')"));
assert.ok(sw.includes('ptp-shell-v3-burn-buds-presence-20260827'));

for (const marker of [
  "fetch(`./presence.php?${query}`",
  "'X-Player-Id':identity.playerId",
  "'X-Player-Token':identity.token",
  'burn-presence online',
  'burn-presence away',
  'YOUR TURN',
  'OPPONENT TURN',
  'Pick a cell and fire.',
  'Your stash is under fire.',
  'BURNED!',
  "replace('You already scouted that plot.','You already fired at that cell.')"
]) {
  assert.ok(gameplay.includes(marker), `Missing Burn Buds gameplay marker: ${marker}`);
}

for (const marker of [
  '.burn-presence.online',
  '.burn-turn-banner.fire',
  '.burn-my-turn',
  '.burn-opponent-turn',
  '.burn-burst',
  '.burn-screen-shock',
  '@keyframes burn-spark-flight',
  '@media(prefers-reduced-motion:reduce)'
]) {
  assert.ok(css.includes(marker), `Missing Burn Buds gameplay style marker: ${marker}`);
}

for (const marker of [
  'BURN_BUDS_PRESENCE_TTL',
  'BURN_BUDS_ONLINE_WINDOW_MS',
  "'ptp_player_' . $playerId",
  "'ptp_room_' . $code",
  "'ptp_presence_' . $playerId",
  "'online' => $opponentOnline",
  "'lastSeenAt' => $opponentSeenAt"
]) {
  assert.ok(presence.includes(marker), `Missing presence endpoint marker: ${marker}`);
}

for (const forbidden of [
  'Access-Control-Allow-Origin: *',
  'playerToken',
  "'token' => $token"
]) {
  assert.ok(!presence.includes(forbidden), `Presence endpoint leaks or weakens auth: ${forbidden}`);
}

console.log('Burn Buds gameplay v3 presence, targeting, and burn feedback checks passed.');