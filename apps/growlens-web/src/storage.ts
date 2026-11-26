import {
  normalizeFeedingRecords,
  normalizeHarvestRecords,
  normalizeIrrigationRecords,
  normalizeObservationOutcomes,
  normalizeReservoirRecords,
} from './cultivationRecords';
import type { GrowLensState } from './types';

export const STORAGE_KEY = 'thc-growlens-state-v1';
export const STATE_SAVED_EVENT = 'growlens:state-saved';

export type StateSavedSource = 'app' | 'external';
export type StateSavedDetail = {
  source: StateSavedSource;
  savedAt: string;
};

export const emptyState: GrowLensState = {
  schemaVersion: 2,
  spaces: [],
  cycles: [],
  plants: [],
  diary: [],
  tasks: [],
  readings: [],
  calibrationProfiles: [],
  observations: [],
  irrigationRecords: [],
  feedingRecords: [],
  reservoirRecords: [],
  harvestRecords: [],
  observationOutcomes: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeState(value: unknown): GrowLensState {
  if (!isRecord(value)) return structuredClone(emptyState);

  return {
    schemaVersion: 2,
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
    irrigationRecords: normalizeIrrigationRecords(value.irrigationRecords),
    feedingRecords: normalizeFeedingRecords(value.feedingRecords),
    reservoirRecords: normalizeReservoirRecords(value.reservoirRecords),
    harvestRecords: normalizeHarvestRecords(value.harvestRecords),
    observationOutcomes: normalizeObservationOutcomes(value.observationOutcomes),
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
  return document.querySelector('.camera-panel, .account-panel, .reports-panel, .cultivation-panel')
    ? 'external'
    : 'app';
}

export function saveState(
  state: GrowLensState,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
  source?: StateSavedSource,
): void {
  const normalized = normalizeState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
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
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'THC GrowLens', state: normalizeState(state) }, null, 2);
}

export function parseBackup(raw: string): GrowLensState {
  const parsed: unknown = JSON.parse(raw);
  const wrapped = isRecord(parsed) && 'state' in parsed;
  if (wrapped && parsed.app !== undefined && parsed.app !== 'THC GrowLens') {
    throw new Error('Backup belongs to a different application');
  }
  const candidate = wrapped ? parsed.state : parsed;
  if (!isRecord(candidate)) throw new Error('Invalid backup state');
  if (candidate.schemaVersion !== undefined && candidate.schemaVersion !== 1 && candidate.schemaVersion !== 2) {
    throw new Error('Unsupported backup schema');
  }
  const keys = Object.keys(emptyState).filter(key => key !== 'schemaVersion');
  if (!keys.some(key => Array.isArray(candidate[key])) ||
      keys.some(key => key in candidate && !Array.isArray(candidate[key]))) {
    throw new Error('Invalid backup collections');
  }
  for (const key of keys) {
    const rows = candidate[key];
    if (Array.isArray(rows) && rows.some(row => !isRecord(row))) {
      throw new Error('Invalid backup record in ' + key);
    }
  }
  return normalizeState(candidate);
}

export function createId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
