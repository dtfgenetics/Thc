import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const runtime=path.join(root,'site/public-route-patch/games/protect-the-plants');
const required=[
  'premium-lobby-v1.css','social-feedback-v1.css','social-feedback-v1.js',
  'assets/ui/host-battle-frame-v1.svg','assets/ui/join-battle-frame-v1.svg','assets/ui/room-code-panel-v1.svg','assets/ui/chat-drawer-v1.svg','assets/ui/mobile-nav-v1.svg',
  'assets/ui/notifications/toast-player-joined-v1.svg','assets/ui/notifications/toast-player-left-v1.svg','assets/ui/notifications/toast-your-turn-v1.svg','assets/ui/notifications/toast-victory-v1.svg','assets/ui/notifications/toast-defeat-v1.svg',
  'assets/ui/reactions/reaction-fire-v1.svg','assets/ui/reactions/reaction-leaf-v1.svg','assets/ui/reactions/reaction-heart-v1.svg','assets/ui/reactions/reaction-smoke-v1.svg','assets/ui/reactions/reaction-trophy-v1.svg','assets/ui/reactions/reaction-gg-v1.svg','assets/ui/reactions/reaction-laugh-v1.svg','assets/ui/reactions/reaction-target-v1.svg'
];
for(const rel of required)assert.ok(fs.existsSync(path.join(runtime,rel)),`missing ${rel}`);
const index=fs.readFileSync(path.join(runtime,'index.html'),'utf8');
assert.match(index,/premium-lobby-v1\.css/);
assert.match(index,/social-feedback-v1\.css/);
assert.match(index,/social-feedback-v1\.js/);
assert.match(index,/gameplay-v4\.css/,'new presentation must preserve current gameplay-v4 layer');
const js=fs.readFileSync(path.join(runtime,'social-feedback-v1.js'),'utf8');
assert.match(js,/data-bb-reaction/);
assert.match(js,/BurnBudsSync/);
assert.match(js,/toast-player-joined-v1\.svg/);
assert.match(js,/toast-defeat-v1\.svg/);
const css=fs.readFileSync(path.join(runtime,'social-feedback-v1.css'),'utf8');
assert.match(css,/min-width:44px/);
assert.match(css,/prefers-reduced-motion:reduce/);
const sw=fs.readFileSync(path.join(runtime,'sw.js'),'utf8');
assert.match(sw,/ptp-shell-v11-burn-buds-premium-social-20260918/);
for(const rel of ['premium-lobby-v1.css','social-feedback-v1.css','social-feedback-v1.js','reaction-fire-v1.svg','toast-victory-v1.svg','gameplay-v4.css'])assert.ok(sw.includes(rel),`service worker missing ${rel}`);
const game=JSON.parse(fs.readFileSync(path.join(root,'games/protect-the-plants/game.json'),'utf8'));
for(const feature of ['premium-lobby-art','quick-chat-reactions','art-backed-notifications'])assert.ok(game.features.includes(feature),`game contract missing ${feature}`);
assert.equal(game.production?.storage,'wordpress-transients');
assert.ok(game.features.includes('server-authoritative-turns'));
console.log('Burn Buds premium social presentation contract OK');
