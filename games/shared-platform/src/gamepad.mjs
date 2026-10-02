const DEFAULT_BUTTON_MAP = Object.freeze({
  0: ['confirm', 'primary-action'],
  1: ['cancel'],
  4: ['secondary-action'],
  5: ['secondary-action'],
  9: ['pause'],
  12: ['move-up'],
  13: ['move-down'],
  14: ['move-left'],
  15: ['move-right'],
});

const DEFAULT_AXIS_MAP = Object.freeze({
  0: { negative: 'move-left', positive: 'move-right' },
  1: { negative: 'move-up', positive: 'move-down' },
});

function normalizeButtonMap(input = {}) {
  const source = { ...DEFAULT_BUTTON_MAP, ...input };
  const result = new Map();
  for (const [index, actions] of Object.entries(source)) {
    const buttonIndex = Number(index);
    if (!Number.isInteger(buttonIndex) || buttonIndex < 0) continue;
    const normalized = [...new Set((Array.isArray(actions) ? actions : [actions])
      .filter((action) => typeof action === 'string' && action.length > 0))];
    if (normalized.length) result.set(buttonIndex, normalized);
  }
  return result;
}

function normalizeAxisMap(input = {}) {
  const source = { ...DEFAULT_AXIS_MAP, ...input };
  const result = new Map();
  for (const [index, mapping] of Object.entries(source)) {
    const axisIndex = Number(index);
    if (!Number.isInteger(axisIndex) || axisIndex < 0 || !mapping || typeof mapping !== 'object') continue;
    result.set(axisIndex, {
      negative: typeof mapping.negative === 'string' ? mapping.negative : null,
      positive: typeof mapping.positive === 'string' ? mapping.positive : null,
    });
  }
  return result;
}

export function createGamepadActionMap({
  navigatorObject = globalThis.navigator,
  buttonMap = {},
  axisMap = {},
  axisThreshold = 0.5,
  gamepadIndex = 0,
  onAction = null,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
} = {}) {
  if (!Number.isFinite(axisThreshold) || axisThreshold <= 0 || axisThreshold > 1) {
    throw new Error('axisThreshold must be greater than 0 and at most 1');
  }
  if (!Number.isInteger(gamepadIndex) || gamepadIndex < 0) throw new Error('gamepadIndex must be a non-negative integer');

  const buttons = normalizeButtonMap(buttonMap);
  const axes = normalizeAxisMap(axisMap);
  const pressed = new Set();
  let running = false;
  let frameId = null;

  function emit(action, phase, detail = {}) {
    onAction?.(action, {
      phase,
      repeat: false,
      source: 'gamepad',
      gamepadIndex,
      ...detail,
    });
  }

  function desiredActions(gamepad) {
    const desired = new Map();
    if (!gamepad) return desired;

    for (const [index, actions] of buttons) {
      const button = gamepad.buttons?.[index];
      if (!button?.pressed && !(Number(button?.value) > 0.5)) continue;
      for (const action of actions) desired.set(action, { control: 'button', index });
    }

    for (const [index, mapping] of axes) {
      const value = Number(gamepad.axes?.[index] ?? 0);
      if (value <= -axisThreshold && mapping.negative) {
        desired.set(mapping.negative, { control: 'axis', index, value });
      }
      if (value >= axisThreshold && mapping.positive) {
        desired.set(mapping.positive, { control: 'axis', index, value });
      }
    }

    return desired;
  }

  function poll() {
    const pads = navigatorObject?.getGamepads?.() ?? [];
    const gamepad = pads?.[gamepadIndex] ?? null;
    const desired = desiredActions(gamepad);

    for (const [action, detail] of desired) {
      if (!pressed.has(action)) {
        pressed.add(action);
        emit(action, 'press', detail);
      }
    }

    for (const action of [...pressed]) {
      if (!desired.has(action)) {
        pressed.delete(action);
        emit(action, 'release', { reason: gamepad ? 'control-release' : 'disconnect' });
      }
    }

    return { connected: Boolean(gamepad), pressed: [...pressed] };
  }

  function loop() {
    if (!running) return;
    poll();
    if (requestFrame) frameId = requestFrame(loop);
  }

  function start() {
    if (running) return false;
    running = true;
    if (requestFrame) frameId = requestFrame(loop);
    return true;
  }

  function stop(reason = 'stop') {
    if (!running && !pressed.size) return false;
    running = false;
    if (frameId != null && cancelFrame) cancelFrame(frameId);
    frameId = null;
    for (const action of [...pressed]) {
      pressed.delete(action);
      emit(action, 'release', { reason });
    }
    return true;
  }

  return {
    poll,
    start,
    stop,
    isRunning: () => running,
    pressedActions: () => [...pressed],
    supported: () => typeof navigatorObject?.getGamepads === 'function',
  };
}

export const DEFAULT_GAMEPAD_BUTTON_MAP = DEFAULT_BUTTON_MAP;
export const DEFAULT_GAMEPAD_AXIS_MAP = DEFAULT_AXIS_MAP;
