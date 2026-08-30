import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const guardSource = await readFile(
  new URL('../../../site/public-route-patch/games/seed-man-platformer/input-guard-v1.js', import.meta.url),
  'utf8'
);

class FakeElement {
  constructor({ interactive = false, parent = null } = {}) {
    this.interactive = interactive;
    this.parent = parent;
  }

  closest() {
    let current = this;
    while (current) {
      if (current.interactive) return current;
      current = current.parent;
    }
    return null;
  }
}

const listeners = new Map();
const sandbox = {
  Element: FakeElement,
  window: {
    addEventListener(type, handler, options) {
      listeners.set(type, { handler, options });
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(guardSource, sandbox, { filename: 'input-guard-v1.js' });

assert.equal(listeners.has('keydown'), true, 'keydown guard must be installed');
assert.equal(listeners.has('keyup'), true, 'keyup guard must be installed');
assert.equal(listeners.get('keydown').options.capture, true, 'keydown guard must run in capture phase');
assert.equal(listeners.get('keyup').options.capture, true, 'keyup guard must run in capture phase');

function dispatch(type, target) {
  let stopped = false;
  let prevented = false;
  listeners.get(type).handler({
    target,
    stopImmediatePropagation() { stopped = true; },
    preventDefault() { prevented = true; }
  });
  return { stopped, prevented };
}

const button = new FakeElement({ interactive: true });
const nestedButtonContent = new FakeElement({ parent: button });
const canvas = new FakeElement();

assert.deepEqual(
  dispatch('keydown', button),
  { stopped: true, prevented: false },
  'focused buttons must keep native keyboard activation without reaching gameplay handlers'
);
assert.deepEqual(
  dispatch('keyup', nestedButtonContent),
  { stopped: true, prevented: false },
  'nested content inside an interactive control must also be protected'
);
assert.deepEqual(
  dispatch('keydown', canvas),
  { stopped: false, prevented: false },
  'canvas gameplay keys must continue through to the platformer runtime'
);

console.log('Seed Man keyboard focus guard regression checks passed.');
