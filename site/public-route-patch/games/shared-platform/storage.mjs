export function browserStorage(globalObject = globalThis) {
  try {
    return globalObject?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function storageGet(storage, key, fallback = null) {
  try {
    const value = storage?.getItem?.(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function storageSet(storage, key, value) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(storage, key) {
  try {
    if (typeof storage?.removeItem !== 'function') return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function storageReadJson(storage, key, {
  fallback = null,
  validate = null,
} = {}) {
  const raw = storageGet(storage, key, null);
  if (raw == null || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (typeof validate === 'function' && !validate(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function storageWriteJson(storage, key, value) {
  try {
    return storageSet(storage, key, JSON.stringify(value));
  } catch {
    return false;
  }
}
