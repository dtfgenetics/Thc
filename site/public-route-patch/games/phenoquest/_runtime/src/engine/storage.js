export function isStorageAvailable(storage = globalThis.localStorage) {
  if (!storage) return false;

  try {
    const key = '__phenoquest_storage_test__';
    storage.setItem(key, '1');
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeGetItem(key, fallback = null, storage = globalThis.localStorage) {
  if (!isStorageAvailable(storage)) return fallback;

  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeSetItem(key, value, storage = globalThis.localStorage) {
  if (!isStorageAvailable(storage)) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(key, storage = globalThis.localStorage) {
  if (!isStorageAvailable(storage)) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
