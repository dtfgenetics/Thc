/*
Adapted from ourcade/sidescrolling-platformer-template-phaser3
Copyright (c) 2019 ourcade
MIT License — see docs/THIRD_PARTY_NOTICES.md
*/

let machineId = 0;

export function createStateMachine({ id, context = null, logger = null } = {}) {
  const machineName = id || String(++machineId);
  const states = new Map();
  const queue = [];
  let previous = null;
  let current = null;
  let changing = false;

  function bind(fn) {
    return typeof fn === 'function' ? fn.bind(context) : null;
  }

  function addState(name, { onEnter, onUpdate, onExit } = {}) {
    if (!name || typeof name !== 'string') throw new Error('State name is required.');
    states.set(name, {
      name,
      onEnter: bind(onEnter),
      onUpdate: bind(onUpdate),
      onExit: bind(onExit),
    });
    return api;
  }

  function setState(name, payload) {
    if (!states.has(name)) return false;
    if (current?.name === name) return false;
    if (changing) {
      queue.push({ name, payload });
      return true;
    }

    changing = true;
    logger?.({ type: 'state-change', machineId: machineName, from: current?.name ?? null, to: name });

    current?.onExit?.({ from: current.name, to: name, payload });
    previous = current;
    current = states.get(name);
    current?.onEnter?.({ from: previous?.name ?? null, to: name, payload });
    changing = false;
    return true;
  }

  function update(dt, payload) {
    if (queue.length) {
      const next = queue.shift();
      setState(next.name, next.payload);
      return;
    }
    current?.onUpdate?.(dt, payload);
  }

  function clearQueue() {
    queue.length = 0;
  }

  function snapshot() {
    return {
      id: machineName,
      current: current?.name ?? null,
      previous: previous?.name ?? null,
      queued: queue.map((entry) => entry.name),
      states: [...states.keys()],
    };
  }

  const api = {
    addState,
    setState,
    update,
    clearQueue,
    hasState: (name) => states.has(name),
    isCurrentState: (name) => current?.name === name,
    currentStateName: () => current?.name ?? '',
    previousStateName: () => previous?.name ?? '',
    snapshot,
  };

  return api;
}
