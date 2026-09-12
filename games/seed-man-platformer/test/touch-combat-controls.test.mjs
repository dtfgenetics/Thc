import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);
const html = await readFile(new URL('index.html', publicRoot), 'utf8');

assert.doesNotMatch(html, /gameplay-polish-v1\.css/, 'gameplay polish must not depend on a file omitted by the dedicated publisher');
assert.doesNotMatch(html, /touch-combat-controls-v1\.js/, 'touch combat must not depend on a file omitted by the dedicated publisher');
assert.match(html, /data-seed-gameplay-polish=["']20260912-v20-touch-combat-v1["']/, 'release-safe inline gameplay polish marker missing');
assert.match(html, /data-seed-inline-touch-combat=["']seed-man-touch-combat-controls-v1["']/, 'release-safe inline touch combat marker missing');
assert.match(html, /data-combat-feedback=\"fired\"/, 'touch combat must provide immediate fired feedback');
assert.match(html, /data-seed-pheno-active=\"true\"/, 'visual polish must expose active phenotype state');
assert.match(html, /@media\(max-width:680px\)/, 'gameplay polish must contain a phone layout');
assert.match(html, /bind\(attackButton,'fireWeapon'\)/, 'ATTACK must bind to fireWeapon');
assert.match(html, /bind\(abilityButton,'fireAbility'\)/, 'PHENO must bind to fireAbility');

const inline = html.match(/<script data-seed-inline-touch-combat="seed-man-touch-combat-controls-v1">([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline, 'could not isolate inline touch-combat runtime');

function makeButton() {
  const listeners = new Map();
  return {
    disabled: false,
    dataset: {},
    addEventListener(type, listener) { listeners.set(type, listener); },
    click(event = { preventDefault() {} }) { listeners.get('click')?.(event); },
    listeners
  };
}

const attackButton = makeButton();
const abilityButton = makeButton();
let focusCount = 0;
let attackCount = 0;
let abilityCount = 0;
let domReady = null;
const gameCanvas = { focus() { focusCount += 1; } };
const documentElement = { dataset: {} };
const document = {
  documentElement,
  querySelector(selector) {
    if (selector === '#combat-attack-button') return attackButton;
    if (selector === '#combat-ability-button') return abilityButton;
    if (selector === '#game') return gameCanvas;
    return null;
  }
};
const window = {
  __SPROUT_COMBAT_BROWSER__: {
    installed: true,
    fireWeapon() { attackCount += 1; return true; },
    fireAbility() { abilityCount += 1; return true; }
  },
  addEventListener(type, listener) { if (type === 'DOMContentLoaded') domReady = listener; },
  setTimeout(callback) { callback(); }
};
const sandbox = { window, document, console, Object, Boolean };
vm.createContext(sandbox);
vm.runInContext(inline, sandbox, { filename: 'seed-man-inline-touch-combat.js' });
assert.equal(typeof domReady, 'function', 'touch combat should wait for deferred combat runtime before binding');
domReady();

assert.equal(documentElement.dataset.seedTouchCombat, 'ready', 'both touch combat controls must bind');
assert.equal(window.__SEED_MAN_TOUCH_COMBAT__.snapshot().combatReady, true, 'touch bridge must report the combat runtime ready');
attackButton.click();
abilityButton.click();
assert.equal(attackCount, 1, 'touch ATTACK must invoke fireWeapon exactly once');
assert.equal(abilityCount, 1, 'touch PHENO must invoke fireAbility exactly once');
assert.equal(focusCount, 2, 'combat taps should return focus to the game canvas');

attackButton.disabled = true;
attackButton.click();
assert.equal(attackCount, 1, 'disabled ATTACK must not fire');

console.log('Seed Man release-safe touch combat and gameplay polish checks passed.');
