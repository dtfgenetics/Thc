import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('site/public-route-patch/games/protect-the-plants/app.js','utf8');

assert.match(
  source,
  /function roomFromUrl\(\)\{const value=new URLSearchParams\(location\.search\)\.get\('room'\)\?\.trim\(\)\.toUpperCase\(\)\|\|'';return \/\^\[A-Z0-9\]\{6\}\$\/.test\(value\)\?value:''\}/,
  'invite room parsing must normalize and validate six-character room codes'
);

assert.match(
  source,
  /id="joinCode"[^>]+value="\$\{esc\(inviteRoom\)\}"/,
  'invite room code must be prefilled into the join field for new players'
);

assert.match(
  source,
  /if\(inviteRoom\)\{const joinName=document\.querySelector\('#joinName'\);if\(joinName&&!joinName\.value\)joinName\.focus\(\{preventScroll:true\}\)\}/,
  'invite flow should focus the missing player-name field without scrolling the lobby'
);

assert.match(
  source,
  /\(async\(\)=>\{const room=roomFromUrl\(\);if\(room&&identity\.playerId&&identity\.token\)/,
  'startup auto-resume and new-player lobby flow must share the same validated room parser'
);

console.log('Burn Buds invite deep-link handoff contract passed.');
