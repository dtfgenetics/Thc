function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function assertVersion(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be an integer >= 1`);
}

export function createSaveEnvelope({
  gameId,
  version,
  data,
  savedAt = new Date().toISOString(),
  releaseVersion = 'unknown',
} = {}) {
  if (!gameId || typeof gameId !== 'string') throw new Error('gameId is required');
  assertVersion(version, 'version');
  if (!savedAt || typeof savedAt !== 'string') throw new Error('savedAt is required');
  return {
    schemaVersion: 1,
    gameId,
    version,
    releaseVersion,
    savedAt,
    data: clone(data),
  };
}

export function validateSaveEnvelope(save, {
  gameId,
  minVersion = 1,
  maxVersion = Number.MAX_SAFE_INTEGER,
} = {}) {
  const errors = [];
  if (!save || typeof save !== 'object' || Array.isArray(save)) return { valid: false, errors: ['save must be an object'] };
  if (save.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!save.gameId || typeof save.gameId !== 'string') errors.push('gameId is required');
  if (gameId && save.gameId !== gameId) errors.push(`gameId mismatch: expected ${gameId}, found ${save.gameId}`);
  if (!Number.isInteger(save.version) || save.version < minVersion || save.version > maxVersion) {
    errors.push(`version must be an integer between ${minVersion} and ${maxVersion}`);
  }
  if (!save.savedAt || typeof save.savedAt !== 'string') errors.push('savedAt is required');
  if (!Object.prototype.hasOwnProperty.call(save, 'data')) errors.push('data is required');
  return { valid: errors.length === 0, errors };
}

export function migrateSaveEnvelope(save, {
  gameId,
  targetVersion,
  migrations = {},
  validateData = null,
} = {}) {
  assertVersion(targetVersion, 'targetVersion');
  const baseValidation = validateSaveEnvelope(save, { gameId, maxVersion: targetVersion });
  if (!baseValidation.valid) {
    return { ok: false, error: 'invalid-save', issues: baseValidation.errors, save: null, migrated: false };
  }

  let current = clone(save);
  let migrated = false;

  while (current.version < targetVersion) {
    const migrate = migrations[current.version];
    if (typeof migrate !== 'function') {
      return {
        ok: false,
        error: 'missing-migration',
        issues: [`missing migration ${current.version} -> ${current.version + 1}`],
        save: null,
        migrated,
      };
    }

    const nextData = migrate(clone(current.data), clone(current));
    current = {
      ...current,
      version: current.version + 1,
      data: clone(nextData),
    };
    migrated = true;
  }

  if (typeof validateData === 'function' && !validateData(current.data, current)) {
    return { ok: false, error: 'invalid-data', issues: ['migrated save data failed validation'], save: null, migrated };
  }

  return { ok: true, error: null, issues: [], save: current, migrated };
}

export function createVersionedSaveStore({
  gameId,
  version,
  storage,
  key = `dtf.game.${gameId}.save`,
  migrations = {},
  validateData = null,
  now = () => new Date().toISOString(),
  releaseVersion = 'unknown',
} = {}) {
  if (!gameId || typeof gameId !== 'string') throw new Error('gameId is required');
  assertVersion(version, 'version');

  function readRaw() {
    try {
      const raw = storage?.getItem?.(key);
      if (!raw) return { ok: true, empty: true, value: null };
      return { ok: true, empty: false, value: JSON.parse(raw) };
    } catch {
      return { ok: false, empty: false, value: null };
    }
  }

  function load({ fallback = null } = {}) {
    const raw = readRaw();
    if (!raw.ok) return { ok: false, status: 'unavailable', data: clone(fallback), save: null, migrated: false };
    if (raw.empty) return { ok: true, status: 'empty', data: clone(fallback), save: null, migrated: false };

    const result = migrateSaveEnvelope(raw.value, { gameId, targetVersion: version, migrations, validateData });
    if (!result.ok) {
      return { ok: false, status: result.error, data: clone(fallback), save: null, migrated: result.migrated, issues: result.issues };
    }

    if (result.migrated) {
      const persisted = writeEnvelope(result.save);
      if (!persisted) {
        return { ok: false, status: 'migration-write-failed', data: clone(result.save.data), save: result.save, migrated: true };
      }
    }

    return { ok: true, status: result.migrated ? 'migrated' : 'loaded', data: clone(result.save.data), save: result.save, migrated: result.migrated };
  }

  function writeEnvelope(envelope) {
    try {
      storage?.setItem?.(key, JSON.stringify(envelope));
      return typeof storage?.setItem === 'function';
    } catch {
      return false;
    }
  }

  function save(data) {
    if (typeof validateData === 'function' && !validateData(data)) {
      return { ok: false, status: 'invalid-data', save: null };
    }
    const envelope = createSaveEnvelope({ gameId, version, data, savedAt: now(), releaseVersion });
    if (!writeEnvelope(envelope)) return { ok: false, status: 'unavailable', save: null };
    return { ok: true, status: 'saved', save: clone(envelope) };
  }

  function clear() {
    try {
      if (typeof storage?.removeItem !== 'function') return false;
      storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  return {
    key,
    version,
    load,
    save,
    clear,
  };
}
