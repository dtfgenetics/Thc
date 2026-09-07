const DEFAULT_KEYS = Object.freeze({
  confirm: ['Enter', 'Space'],
  cancel: ['Escape'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
  'move-left': ['ArrowLeft', 'KeyA'],
  'move-right': ['ArrowRight', 'KeyD'],
  'move-up': ['ArrowUp', 'KeyW'],
  'move-down': ['ArrowDown', 'KeyS'],
  'primary-action': ['Space', 'Enter'],
  'secondary-action': ['ShiftLeft', 'ShiftRight'],
});

function normalizeCodes(codes) {
  if (!Array.isArray(codes)) return [];
  return [...new Set(codes.filter((code) => typeof code === 'string' && code.length > 0))];
}

export function normalizeActionMap(actionMap = {}) {
  const normalized = {};
  for (const [action, codes] of Object.entries({ ...DEFAULT_KEYS, ...actionMap })) {
    if (!action || typeof action !== 'string') continue;
    normalized[action] = normalizeCodes(codes);
  }
  return normalized;
}

export function createInputActionMap({
  actionMap = {},
  target = globalThis.document,
  enabled = true,
  preventDefault = true,
  ignoreEditable = true,
} = {}) {
  const map = normalizeActionMap(actionMap);
  const listeners = new Map();
  const pressed = new Set();
  let active = Boolean(enabled);
  let attached = false;

  function isEditableTarget(eventTarget) {
    if (!ignoreEditable || !eventTarget) return false;
    const tag = String(eventTarget.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(eventTarget.isContentEditable);
  }

  function actionsForCode(code) {
    return Object.entries(map)
      .filter(([, codes]) => codes.includes(code))
      .map(([action]) => action);
  }

  function emit(action, detail) {
    for (const listener of listeners.get(action) ?? []) listener(detail);
    for (const listener of listeners.get('*') ?? []) listener({ action, ...detail });
  }

  function keydown(event) {
    if (!active || isEditableTarget(event.target)) return;
    const actions = actionsForCode(event.code || event.key);
    if (!actions.length) return;
    if (preventDefault) event.preventDefault();
    const repeat = pressed.has(event.code) || event.repeat;
    pressed.add(event.code);
    for (const action of actions) emit(action, { phase: 'press', repeat, source: 'keyboard', originalEvent: event });
  }

  function keyup(event) {
    if (!active || isEditableTarget(event.target)) return;
    const actions = actionsForCode(event.code || event.key);
    if (!actions.length) return;
    if (preventDefault) event.preventDefault();
    pressed.delete(event.code);
    for (const action of actions) emit(action, { phase: 'release', repeat: false, source: 'keyboard', originalEvent: event });
  }

  function attach() {
    if (attached || !target?.addEventListener) return false;
    target.addEventListener('keydown', keydown);
    target.addEventListener('keyup', keyup);
    attached = true;
    return true;
  }

  function detach() {
    if (!attached || !target?.removeEventListener) return false;
    target.removeEventListener('keydown', keydown);
    target.removeEventListener('keyup', keyup);
    pressed.clear();
    attached = false;
    return true;
  }

  function subscribe(action, listener) {
    if (typeof listener !== 'function') throw new Error('input action listener must be a function');
    if (!listeners.has(action)) listeners.set(action, new Set());
    listeners.get(action).add(listener);
    return () => listeners.get(action)?.delete(listener);
  }

  function trigger(action, payload = {}) {
    if (!active) return false;
    if (!Object.prototype.hasOwnProperty.call(map, action)) throw new Error(`Unknown input action: ${action}`);
    emit(action, { phase: 'press', repeat: false, source: payload.source || 'virtual', ...payload });
    return true;
  }

  return {
    map,
    attach,
    detach,
    subscribe,
    trigger,
    setEnabled(value) { active = Boolean(value); if (!active) pressed.clear(); },
    isEnabled: () => active,
    isAttached: () => attached,
    pressedCodes: () => [...pressed],
  };
}

export { DEFAULT_KEYS as DEFAULT_GAME_ACTION_KEYS };
