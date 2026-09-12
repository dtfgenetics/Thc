import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);
const [html, bridge, polish] = await Promise.all([
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('touch-combat-controls-v1.js', publicRoot), 'utf8'),
  readFile(new URL('gameplay-polish-v1.css', publicRoot), 'utf8')
]);

assert.match(html, /gameplay-polish-v1\.css\?v=20260912-v20-touch-combat-v1/, 'gameplay polish must be cache-busted in the production route');
assert.match(html, /touch-combat-controls-v1\.js\?v=20260912-v20-touch-combat-v1/, 'touch combat bridge must be loaded by the production route');
assert.ok(html.indexOf('combat-browser-v2.js') < html.indexOf('touch-combat-controls-v1.js'), 'combat runtime must load before the touch bridge');
assert.match(polish, /data-combat-feedback=["']fired["']/, 'touch combat must provide immediate fired feedback');
assert.match(polish, /data-seed-pheno-active/, 'visual polish must expose active phenotype state');
assert.match(polish, /@media\(max-width:680px\)/, 'gameplay polish must contain a phone layout');

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
const canvas = { focus() { focusCount += 1; } };
const documentElement = { dataset: {} };
const document = {
  documentElement,
  querySelector(selector) {
    if (selector === '#combat-attack-button') return attackButton;
    if (selector === '#combat-ability-button') return abilityButton;
    if (selector === '#game') return canvas;
    return null;
  }
};
const window = {
  __SPROUT_COMBAT_BROWSER__: {
    installed: true,
    fireWeapon() { attackCount += 1; return true; },
    fireAbility() { abilityCount += 1; return true; }
  },
  setTimeout(callback) { callback(); }
};
const sandbox = { window, document, console };
vm.createContext(sandbox);
vm.runInContext(bridge, sandbox, { filename: 'touch-combat-controls-v1.js' });

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

console.log('Seed Man touch combat and gameplay polish checks passed.');
