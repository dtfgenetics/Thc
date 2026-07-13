import type { GrowLensState } from './types';

export const STORAGE_KEY = 'thc-growlens-state-v1';
export const STATE_SAVED_EVENT = 'growlens:state-saved';

export type StateSavedSource = 'app' | 'external';
export type StateSavedDetail = {
  source: StateSavedSource;
  savedAt: string;
};

export const emptyState: GrowLensState = {
  schemaVersion: 1,
  spaces: [],
  cycles: [],
  plants: [],
  diary: [],
  tasks: [],
  readings: [],
  calibrationProfiles: [],
  observations: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeState(value: unknown): GrowLensState {
  if (!isRecord(value)) return structuredClone(emptyState);

  return {
    schemaVersion: 1,
    spaces: Array.isArray(value.spaces) ? value.spaces as GrowLensState['spaces'] : [],
    cycles: Array.isArray(value.cycles) ? value.cycles as GrowLensState['cycles'] : [],
    plants: Array.isArray(value.plants) ? value.plants as GrowLensState['plants'] : [],
    diary: Array.isArray(value.diary) ? value.diary as GrowLensState['diary'] : [],
    tasks: Array.isArray(value.tasks) ? value.tasks as GrowLensState['tasks'] : [],
    readings: Array.isArray(value.readings) ? value.readings as GrowLensState['readings'] : [],
    calibrationProfiles: Array.isArray(value.calibrationProfiles)
      ? value.calibrationProfiles as GrowLensState['calibrationProfiles']
      : [],
    observations: Array.isArray(value.observations) ? value.observations as GrowLensState['observations'] : [],
  };
}

export function loadState(storage: Pick<Storage, 'getItem'> = window.localStorage): GrowLensState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(emptyState);
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredClone(emptyState);
  }
}

function inferStateSource(): StateSavedSource {
  if (typeof document === 'undefined') return 'app';
  return document.querySelector('.camera-panel, .account-panel, .reports-panel')
    ? 'external'
    : 'app';
}

export function saveState(
  state: GrowLensState,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
  source?: StateSavedSource,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (typeof window !== 'undefined') {
    try {
      if (storage === window.localStorage) {
        const detail: StateSavedDetail = {
          source: source ?? inferStateSource(),
          savedAt: new Date().toISOString(),
        };
        window.dispatchEvent(new CustomEvent<StateSavedDetail>(STATE_SAVED_EVENT, { detail }));
      }
    } catch {
      // State was saved; notification support is optional in restricted browsers.
    }
  }
}

export function serializeBackup(state: GrowLensState): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'THC GrowLens', state }, null, 2);
}

export function parseBackup(raw: string): GrowLensState {
  const parsed: unknown = JSON.parse(raw);
  if (isRecord(parsed) && 'state' in parsed) return normalizeState(parsed.state);
  return normalizeState(parsed);
}

export function createId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
