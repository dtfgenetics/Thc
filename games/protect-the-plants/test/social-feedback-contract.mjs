import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const runtime=path.join(root,'site/public-route-patch/games/protect-the-plants');
const required=[
  'social-feedback-v1.js','social-feedback-v1.css',
  'assets/branding/burn-buds-cover-desktop-v1.svg','assets/branding/burn-buds-cover-mobile-v1.svg',
  'assets/ui/notifications/toast-player-joined-v1.svg','assets/ui/notifications/toast-player-left-v1.svg','assets/ui/notifications/toast-your-turn-v1.svg','assets/ui/notifications/toast-victory-v1.svg','assets/ui/notifications/toast-defeat-v1.svg',
  'assets/ui/reactions/reaction-fire-v1.svg','assets/ui/reactions/reaction-leaf-v1.svg','assets/ui/reactions/reaction-heart-v1.svg','assets/ui/reactions/reaction-smoke-v1.svg','assets/ui/reactions/reaction-trophy-v1.svg','assets/ui/reactions/reaction-gg-v1.svg','assets/ui/reactions/reaction-laugh-v1.svg','assets/ui/reactions/reaction-target-v1.svg'
];
for(const rel of required)assert.ok(fs.existsSync(path.join(runtime,rel)),`missing ${rel}`);
const index=fs.readFileSync(path.join(runtime,'index.html'),'utf8');
assert.match(index,/social-feedback-v1\.css/);
assert.match(index,/social-feedback-v1\.js/);
const js=fs.readFileSync(path.join(runtime,'social-feedback-v1.js'),'utf8');
assert.match(js,/data-bb-reaction/);
assert.match(js,/toast-player-joined-v1\.svg/);
assert.match(js,/toast-defeat-v1\.svg/);
const sw=fs.readFileSync(path.join(runtime,'sw.js'),'utf8');
assert.match(sw,/ptp-shell-v10-burn-buds-social-feedback-20260913/);
assert.match(sw,/social-feedback-v1\.js/);
console.log('Burn Buds social feedback contract OK');
