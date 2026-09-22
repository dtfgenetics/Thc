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
  lifecycleTarget = globalThis.window,
  visibilityTarget = globalThis.document,
  enabled = true,
  preventDefault = true,
  ignoreEditable = true,
  releaseOnBlur = true,
  releaseOnHidden = true,
} = {}) {
  const map = normalizeActionMap(actionMap);
  const listeners = new Map();
  const pressed = new Set();
  const virtualPressed = new Map();
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
    const code = event.code || event.key;
    const actions = actionsForCode(code);
    if (!actions.length) return;
    if (preventDefault) event.preventDefault();
    const repeat = pressed.has(code) || event.repeat;
    pressed.add(code);
    for (const action of actions) emit(action, { phase: 'press', repeat, source: 'keyboard', originalEvent: event });
  }

  function keyup(event) {
    if (!active) return;
    const code = event.code || event.key;
    if (isEditableTarget(event.target) && !pressed.has(code)) return;
    const actions = actionsForCode(code);
    if (!actions.length) return;
    if (preventDefault) event.preventDefault();
    pressed.delete(code);
    for (const action of actions) emit(action, { phase: 'release', repeat: false, source: 'keyboard', originalEvent: event });
  }

  function releaseAll(reason = 'reset') {
    if (!pressed.size && !virtualPressed.size) return 0;

    const releases = new Map();
    for (const code of pressed) {
      for (const action of actionsForCode(code)) {
        if (!releases.has(action)) releases.set(action, 'keyboard');
      }
    }
    for (const [action, source] of virtualPressed) {
      if (!releases.has(action)) releases.set(action, source);
    }

    pressed.clear();
    virtualPressed.clear();
    for (const [action, source] of releases) {
      emit(action, { phase: 'release', repeat: false, source, reason, originalEvent: null });
    }
    return releases.size;
  }

  function onBlur() {
    if (releaseOnBlur) releaseAll('blur');
  }

  function onVisibilityChange() {
    if (releaseOnHidden && visibilityTarget?.hidden) releaseAll('hidden');
  }

  function attach() {
    if (attached || !target?.addEventListener) return false;
    target.addEventListener('keydown', keydown);
    target.addEventListener('keyup', keyup);
    if (releaseOnBlur) lifecycleTarget?.addEventListener?.('blur', onBlur);
    if (releaseOnHidden) visibilityTarget?.addEventListener?.('visibilitychange', onVisibilityChange);
    attached = true;
    return true;
  }

  function detach() {
    if (!attached || !target?.removeEventListener) return false;
    target.removeEventListener('keydown', keydown);
    target.removeEventListener('keyup', keyup);
    if (releaseOnBlur) lifecycleTarget?.removeEventListener?.('blur', onBlur);
    if (releaseOnHidden) visibilityTarget?.removeEventListener?.('visibilitychange', onVisibilityChange);
    releaseAll('detach');
    attached = false;
    return true;
  }

  function subscribe(action, listener) {
    if (typeof listener !== 'function') throw new Error('input action listener must be a function');
    if (!listeners.has(action)) listeners.set(action, new Set());
    listeners.get(action).add(listener);
    return () => listeners.get(action)?.delete(listener);
  }

  function dispatchVirtual(action, phase, payload = {}) {
    if (!active) return false;
    if (!Object.prototype.hasOwnProperty.call(map, action)) throw new Error(`Unknown input action: ${action}`);
    const source = payload.source || 'virtual';
    if (phase === 'press') virtualPressed.set(action, source);
    else virtualPressed.delete(action);
    emit(action, { ...payload, phase, repeat: false, source });
    return true;
  }

  function trigger(action, payload = {}) {
    return dispatchVirtual(action, payload.phase === 'release' ? 'release' : 'press', payload);
  }

  function setEnabled(value) {
    const next = Boolean(value);
    if (active && !next) releaseAll('disabled');
    active = next;
  }

  return {
    map,
    attach,
    detach,
    subscribe,
    trigger,
    press: (action, payload = {}) => dispatchVirtual(action, 'press', payload),
    release: (action, payload = {}) => dispatchVirtual(action, 'release', payload),
    releaseAll,
    setEnabled,
    isEnabled: () => active,
    isAttached: () => attached,
    pressedCodes: () => [...pressed],
    pressedActions: () => [...new Set([
      ...[...pressed].flatMap(actionsForCode),
      ...virtualPressed.keys(),
    ])],
  };
}

export { DEFAULT_KEYS as DEFAULT_GAME_ACTION_KEYS };
