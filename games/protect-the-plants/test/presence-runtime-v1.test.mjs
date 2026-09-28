import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtimePath='site/public-route-patch/games/protect-the-plants/gameplay-v3.js';
const runtime=fs.readFileSync(runtimePath,'utf8');

assert.match(
  runtime,
  /const escapeHtml=value=>String\(value\?\?''\)\.replace/,
  'Burn Buds presence/runtime copy must own its HTML escaping helper instead of relying on another script scope'
);

assert.match(
  runtime,
  /title="\$\{escapeHtml\(formatLastSeen\(lastPresence\.opponent\.lastSeenAt\)\)\}"/,
  'offline/reconnecting presence title must use the local escape helper'
);

assert.doesNotMatch(
  runtime,
  /\besc\(formatLastSeen\(/,
  'gameplay-v3 must not call the private esc helper from v2-extras.js'
);

console.log('Burn Buds reconnect presence runtime dependency regression contract passed.');
