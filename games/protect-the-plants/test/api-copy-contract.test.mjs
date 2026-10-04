import assert from 'node:assert/strict';
import fs from 'node:fs';

const root='site/public-route-patch/games/protect-the-plants';
const api=fs.readFileSync(`${root}/api.php`,'utf8');
const gameplay=fs.readFileSync(`${root}/gameplay-v3.js`,'utf8');

assert.match(api,/function find_wp_bootstrap\(\): \?string/,'API must locate WordPress from the deployed document root or an ancestor.');
assert.match(api,/function store_set\(string \$key, array \$value, int \$ttl = PTP_TTL\): bool/,'Storage writes must report whether persistence succeeded.');
assert.match(api,/!store_set\(\$roomKey, \$room\) \|\| !is_array\(store_get\(\$roomKey\)\)/,'Room creation must verify an immediate storage read-back.');
assert.ok(api.includes('Game storage is temporarily unavailable. Please try again.'),'Storage failures must return an actionable player-facing error.');
assert.ok(api.includes('DTF_BURN_BUDS_MAINTENANCE_MODE'),'Burn Buds API must expose maintenance control.');
assert.ok(api.includes('DTF_BURN_BUDS_MULTIPLAYER_ENABLED'),'Burn Buds API must expose multiplayer kill switch.');
assert.ok(api.includes("'service' => 'burn-buds'"),'Burn Buds health response must identify the service.');
assert.ok(api.includes("'metrics' => ops_snapshot()"),'Burn Buds health response must expose operational metrics.');
assert.ok(api.includes('Burn Buds is temporarily under maintenance.'),'Burn Buds API must expose maintenance failure state.');
assert.ok(api.includes('Burn Buds multiplayer is temporarily disabled.'),'Burn Buds API must expose multiplayer-disabled state.');
assert.match(api,/const PTP_PROTOCOL_VERSION = 1;/,'Burn Buds must expose explicit protocol v1.');
assert.match(api,/HTTP_X_DTF_GAME_PROTOCOL/,'Burn Buds API must read the protocol header.');
assert.ok(api.includes('Client protocol is incompatible with this Burn Buds server.'),'Explicit incompatible clients must receive a clear protocol error.');
assert.ok(api.includes("'protocolVersion' => PTP_PROTOCOL_VERSION"),'Burn Buds API responses must expose protocolVersion.');

for(const marker of [
  'All bud formations are required.',
  'Invalid bud formation.',
  'Formation is outside the stash grid.',
  'Bud formations cannot overlap.',
  'created the Burn Buds room.',
  'This room already has two players.',
  'joined the Burn Buds room.',
  'locked their stash.',
  'Both stashes are locked.',
  'Target is outside the battle grid.',
  'You already fired at that cell.',
  'burned a full bud formation.',
  'burned every opposing bud and won round'
]){
  assert.ok(api.includes(marker),`Missing Burn Buds API copy marker: ${marker}`);
}

for(const legacy of [
  'All plant formations are required.',
  'Invalid plant formation.',
  'Formation is outside the garden.',
  'Plant formations cannot overlap.',
  'created the garden.',
  'This garden already has two players.',
  'joined the garden.',
  'locked their garden.',
  'Both gardens are locked.',
  'Plot is outside the garden.',
  'You already scouted that plot.',
  'found an entire plant formation.',
  'protected their garden and won round'
]){
  assert.ok(!api.includes(legacy),`Legacy player-facing API copy remains: ${legacy}`);
}

assert.ok(api.includes("'type' => 'scout'"),'Internal scout event type must remain for saved-session/client compatibility.');
assert.ok(gameplay.includes(".replace('created the garden.','created the Burn Buds room.')"),'Browser migration shim must keep translating legacy room history during the transition window.');
assert.ok(gameplay.includes(".replace('You already scouted that plot.','You already fired at that cell.')"),'Browser migration shim must keep translating legacy error copy during the transition window.');

const app=fs.readFileSync(`${root}/app.js`,'utf8');
assert.ok(app.includes("btn.setAttribute('aria-busy','true')"),'Network actions must expose a busy state and reject accidental double submission.');
assert.ok(app.includes("{error:true}"),'Network failures must remain visible as explicit error feedback.');
assert.match(app,/error\?6000:2200/,'Error feedback must remain visible long enough to read.');
assert.match(app,/const PROTOCOL_VERSION=1;/,'Burn Buds client must pin protocol v1.');
assert.ok(app.includes("'X-DTF-Game-Protocol':String(PROTOCOL_VERSION)"),'Burn Buds client must send protocol version.');
assert.match(app,/client is out of date/i,'Burn Buds client must reject mismatched server protocol responses.');

console.log('Burn Buds API copy and legacy-session compatibility contract passed.');
