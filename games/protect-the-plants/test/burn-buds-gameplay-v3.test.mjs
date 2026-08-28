import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('site/public-route-patch/games/protect-the-plants');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const gameplay = read('gameplay-v3.js');
const combatA11y = read('combat-a11y-v1.js');
const css = read('gameplay-v3.css');
const presence = read('presence.php');
const sw = read('sw.js');

for (const asset of ['gameplay-v3.js', 'gameplay-v3.css', 'combat-a11y-v1.js', 'presence.php']) {
  assert.ok(fs.existsSync(path.join(root, asset)), `Missing Burn Buds gameplay asset: ${asset}`);
}

assert.ok(index.includes('./gameplay-v3.css'));
assert.ok(index.includes('./gameplay-v3.js'));
assert.ok(index.includes('./combat-a11y-v1.js'));
assert.ok(sw.includes('./gameplay-v3.css'));
assert.ok(sw.includes('./gameplay-v3.js'));
assert.ok(sw.includes('./combat-a11y-v1.js'));
assert.ok(sw.includes("url.pathname.endsWith('/presence.php')"));
assert.ok(sw.includes('ptp-shell-v3-burn-buds-a11y-20260828'));

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
  'function shotStats(shots)',
  'function remainingOwnFormations()',
  'function remainingOpponentFormations()',
  'className=\'burn-telemetry\'',
  'Live battle statistics',
  '% accuracy',
  "replace('You already scouted that plot.','You already fired at that cell.')"
]) {
  assert.ok(gameplay.includes(marker), `Missing Burn Buds gameplay marker: ${marker}`);
}

for (const marker of [
  "className='burn-live-announcer'",
  "setAttribute('aria-live','polite')",
  "['scout','formation-lost','game-finished']",
  'lastEventId',
  'lastTurnKey',
  'Your turn. Pick a cell and fire.',
  'Opponent turn. Your stash is under fire.',
  'Round won.',
  'Round lost.',
  "if(typeof eventText==='function')return eventText(event)"
]) {
  assert.ok(combatA11y.includes(marker), `Missing Burn Buds combat accessibility marker: ${marker}`);
}

for (const forbidden of [
  'state.opponent.fleet',
  'state?.opponent?.fleet',
  'shotsReceived',
  'fleetMap('
]) {
  assert.ok(!combatA11y.includes(forbidden), `Combat announcer must not inspect hidden opponent fleet data: ${forbidden}`);
}

for (const marker of [
  '.burn-presence.online',
  '.burn-turn-banner.fire',
  '.burn-telemetry',
  '.burn-live-announcer',
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

console.log('Burn Buds gameplay v3 presence, telemetry, combat accessibility, targeting, and burn feedback checks passed.');
