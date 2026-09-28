import fs from 'node:fs';
import assert from 'node:assert/strict';

const canonical=fs.readFileSync('games/protect-the-plants/premium-lobby-v1.css','utf8');
const publicCss=fs.readFileSync('site/public-route-patch/games/protect-the-plants/premium-lobby-v1.css','utf8');

assert.equal(publicCss,canonical,'canonical and public premium lobby CSS must stay in sync');
assert.match(publicCss,/@media\(max-width:760px\)[\s\S]*\.create-row,.join-row\{grid-template-columns:1fr!important\}/,'mobile create/join actions must collapse to one column');
assert.match(publicCss,/\.create-row>\.btn,.join-row>\.btn\{width:100%;min-height:48px\}/,'mobile lobby primary actions must preserve a 48px touch target');
assert.match(publicCss,/\.create-row>\.input,.join-row>\.input\{min-height:48px\}/,'mobile lobby inputs must preserve a 48px touch target');
assert.match(publicCss,/\.active-card>\.btn,.active-card>\[role="group"\]\{grid-column:1\/-1;width:100%\}/,'mobile resume/invite actions must span the active-room card');
assert.match(publicCss,/@media\(max-width:420px\)/,'narrow-phone premium lobby layout must remain explicit');

console.log('Burn Buds premium mobile lobby regression passed.');
