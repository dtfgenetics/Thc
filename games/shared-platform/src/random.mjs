export const DETERMINISTIC_RNG_ALGORITHM = 'dtf-lcg-v1';

function hashSeed(seed) {
  const text = String(seed ?? '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 1;
}

function normalizeState(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffffffff) {
    throw new Error('deterministic RNG state must be a uint32');
  }
  return numeric >>> 0 || 1;
}

export function createDeterministicRng(seed, { state } = {}) {
  let current = state === undefined ? hashSeed(seed) : normalizeState(state);

  function next() {
    current = (Math.imul(1664525, current) + 1013904223) >>> 0;
    return current / 0x100000000;
  }

  function range(min, max) {
    const low = Number(min);
    const high = Number(max);
    if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
      throw new Error('range requires finite min/max with max >= min');
    }
    return low + (high - low) * next();
  }

  function int(min, maxInclusive) {
    const low = Math.ceil(Number(min));
    const high = Math.floor(Number(maxInclusive));
    if (!Number.isInteger(low) || !Number.isInteger(high) || high < low) {
      throw new Error('int requires an integer range with max >= min');
    }
    return Math.floor(range(low, high + 1));
  }

  function chance(probability) {
    const p = Number(probability);
    if (!Number.isFinite(p)) return false;
    return next() < Math.min(1, Math.max(0, p));
  }

  function pick(values) {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    return values[int(0, values.length - 1)];
  }

  function shuffle(values) {
    if (!Array.isArray(values)) throw new Error('shuffle requires an array');
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = int(0, index);
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }

  function snapshot() {
    return {
      algorithm: DETERMINISTIC_RNG_ALGORITHM,
      state: current >>> 0,
    };
  }

  function restore(nextSnapshot) {
    if (nextSnapshot?.algorithm !== DETERMINISTIC_RNG_ALGORITHM) {
      throw new Error(`unsupported deterministic RNG algorithm: ${nextSnapshot?.algorithm}`);
    }
    current = normalizeState(nextSnapshot.state);
    return snapshot();
  }

  function fork(label) {
    return createDeterministicRng(`${current}:${String(label ?? '')}`);
  }

  return {
    next,
    range,
    int,
    chance,
    pick,
    shuffle,
    snapshot,
    restore,
    fork,
  };
}
