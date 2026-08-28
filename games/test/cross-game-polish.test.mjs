import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const includes = (path, markers) => {
  const source = read(path);
  for (const marker of markers) assert.ok(source.includes(marker), `${path} is missing ${marker}`);
};

includes('site/public-route-patch/games/high-life/app.js', [
  "dtf-high-life-save-v1",
  'function resumeGame()',
  'function discardSave()',
  'saveGame();'
]);
includes('site/public-route-patch/games/high-life/index.html', [
  'id="resume-game"',
  'id="discard-save"',
  'id="save-status"'
]);

includes('site/public-route-patch/games/grower-conversations/app.js', [
  "dtf-grower-conversations-session-v1",
  'function restoreSession()',
  'progress saved on this device'
]);

includes('site/public-route-patch/games/seed-man-platformer/app.js', [
  "dtf-seed-man-best-v1",
  'function togglePause(',
  "document.addEventListener('visibilitychange'",
  'New personal best!'
]);
includes('site/public-route-patch/games/seed-man-platformer/index.html', [
  'id="best-count"',
  'id="pause"',
  'P to pause'
]);

includes('site/public-route-patch/games/strain-showdown/polish-v1.js', [
  "dtf-strain-showdown-sound-v1",
  "event.key !== 'Escape'",
  'cancelSelection.click()'
]);
includes('site/public-route-patch/games/strain-showdown/index.html', [
  'src="./polish-v1.js"'
]);

includes('site/public-route-patch/games/bud-or-bluff/player-pref-v1.js', [
  "dtf-bud-or-bluff-player-name-v1",
  'localStorage.setItem(PLAYER_NAME_KEY',
  "document.querySelector('#createForm')"
]);
includes('site/public-route-patch/games/bud-or-bluff/index.html', [
  'src="player-pref-v1.js"'
]);

includes('apps/high-land-web/src/overflowFixes.css', [
  ':focus-visible',
  '@media (prefers-reduced-motion: reduce)',
  'animation-duration: 0.01ms !important'
]);

includes('site/public-route-patch/games/dtf-route.css', [
  ':focus-visible',
  'scroll-margin-top:96px',
  '@media(prefers-reduced-motion:reduce)',
  '.card-action{display:inline-flex;min-height:44px'
]);

for (const path of [
  'site/public-route-patch/games/high-life/app.js',
  'site/public-route-patch/games/grower-conversations/app.js',
  'site/public-route-patch/games/seed-man-platformer/app.js',
  'site/public-route-patch/games/strain-showdown/polish-v1.js',
  'site/public-route-patch/games/bud-or-bluff/player-pref-v1.js'
]) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${path} failed syntax check:\n${result.stderr || result.stdout}`);
}

console.log('Cross-game polish regression checks passed.');
