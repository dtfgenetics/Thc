import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('site/public-route-patch/games/protect-the-plants/app.js','utf8');
const css=fs.readFileSync('site/public-route-patch/games/protect-the-plants/styles.css','utf8');

assert.match(app,/data-board-tab="chat">Chat<\/button>/,'mobile battle rail must expose Chat as a first-class tab');
assert.match(app,/side-rail \$\{mobileBoard==='chat'\?'mobile-active':''\}/,'chat tab must activate the side rail');
assert.match(app,/boards \$\{mobileBoard==='chat'\?'mobile-chat-hidden':''\}/,'chat mode must hide the battle boards on narrow screens');
assert.match(css,/@media\(max-width:820px\)[\s\S]*\.side-rail\{display:none;grid-template-columns:1fr\}[\s\S]*\.side-rail\.mobile-active\{display:grid\}[\s\S]*\.boards\.mobile-chat-hidden\{display:none\}/,'mobile CSS must swap the tactical boards for the chat rail without affecting desktop');

console.log('Burn Buds mobile chat-tab contract passed.');
