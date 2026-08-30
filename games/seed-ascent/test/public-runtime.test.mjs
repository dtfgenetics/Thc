import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path = new URL('../../../site/public-route-patch/games/seed-ascent/index.html', import.meta.url);
const html = fs.readFileSync(path, 'utf8');

assert.match(html, /<canvas[^>]+id="c"/i, 'game canvas is missing');
assert.match(html, /id="start"/i, 'start control is missing');
assert.match(html, /id="left"/i, 'left control is missing');
assert.match(html, /id="right"/i, 'right control is missing');
assert.match(html, /id="jump"/i, 'jump control is missing');
assert.match(html, /localStorage\.seedAscentBest/, 'best-score persistence is missing');
assert.match(html, /p\.jumps<2/, 'double-jump guard is missing');
assert.match(html, /H\*\.6-p\.y-cam/, 'corrected camera tracking is missing');
assert.match(html, /p\.y\+cam>H\+110/, 'camera-relative fall detection is missing');
assert.match(html, /prevBottom<=q\.y\+2/, 'crossing-based landing collision is missing');
assert.match(html, /pointerdown/, 'pointer controls are missing');
assert.match(html, /https:\/\/dtfseeds\.com\/games\/seed-ascent\//, 'canonical production URL is missing');

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
assert.equal(scripts.length, 1, `expected one inline runtime script, found ${scripts.length}`);
new vm.Script(scripts[0], { filename: 'seed-ascent-inline.js' });

console.log('Seed Ascent public runtime validated');
