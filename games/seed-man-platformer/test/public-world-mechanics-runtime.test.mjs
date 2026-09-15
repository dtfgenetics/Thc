import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const publicRoot=new URL('../../../site/public-route-patch/games/seed-man-platformer/',import.meta.url);
const [html,runtime]=await Promise.all([
  readFile(new URL('index.html',publicRoot),'utf8'),
  readFile(new URL('world-mechanics-browser-v1.js',publicRoot),'utf8')
]);

assert.match(html,/world-mechanics-browser-v1\.js\?v=20260915-world-mechanics-v1/,'public route must load world mechanics as an explicit dependency');
assert.ok(html.indexOf('app.js?v=20260909-v20-runtime-v5')<html.indexOf('world-mechanics-browser-v1.js'),'world mechanics must load after the base platformer runtime');
assert.ok(html.indexOf('world-mechanics-browser-v1.js')<html.indexOf('campaign-v20-runtime.js'),'world mechanics must install before campaign level selection begins');

new vm.Script(runtime,{filename:'world-mechanics-browser-v1.js'});
for(const marker of [
  'seed-man-world-mechanics-browser-v1',
  'moving-platforms',
  'collapsing-platforms',
  'wind-zones',
  'heat-updraft',
  'slippery-ground',
  'conveyor',
  'crystal-bounce',
  'phenotypeImmuneToHazard',
  'electric-floor',
  'laser-grid',
  'energy-beam',
  'resolvePlatforms',
  'frameLevel'
])assert.match(runtime,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`public world mechanics runtime missing marker: ${marker}`);

assert.match(runtime,/stepPlayer\s*=\s*function\s+seedManWorldMechanicsStep/,'public mechanics runtime must wrap the canonical physics step instead of replacing app ownership');
assert.match(runtime,/const\s+baseStep=typeof\s+stepPlayer/,'public mechanics runtime must retain canonical physics as its base');
assert.match(runtime,/drawPlatforms\s*=\s*function\s+seedManWorldMechanicsDraw/,'runtime must render resolved moving and breakaway geometry');
assert.match(runtime,/render\s*=\s*function\s+seedManWorldMechanicsRender/,'runtime must expose environmental visibility effects without moving HUD into canvas ownership');
assert.doesNotMatch(runtime,/document\.createElement\(['"]script['"]\)|loadScript\s*\(/,'world mechanics must be an explicit dependency, not a dynamic script loader');

console.log('Seed Man public world mechanics runtime contract OK');
