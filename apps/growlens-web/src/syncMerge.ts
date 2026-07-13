import { normalizeState } from './storage';
import type { GrowLensState } from './types';

type RecordWithId = { id: string };

function mergeRecords<T extends RecordWithId>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();
  for (const record of remote) {
    if (record.id) merged.set(record.id, record);
  }
  for (const record of local) {
    if (record.id) merged.set(record.id, record);
  }
  return [...merged.values()];
}

export function mergeGrowLensStates(localValue: unknown, remoteValue: unknown): GrowLensState {
  const local = normalizeState(localValue);
  const remote = normalizeState(remoteValue);
  return {
    schemaVersion: 1,
    spaces: mergeRecords(local.spaces, remote.spaces),
    cycles: mergeRecords(local.cycles, remote.cycles),
    plants: mergeRecords(local.plants, remote.plants),
    diary: mergeRecords(local.diary, remote.diary),
    tasks: mergeRecords(local.tasks, remote.tasks),
    readings: mergeRecords(local.readings, remote.readings),
    calibrationProfiles: mergeRecords(local.calibrationProfiles, remote.calibrationProfiles),
    observations: mergeRecords(local.observations, remote.observations),
  };
}

export function stateFingerprint(value: unknown): string {
  return JSON.stringify(normalizeState(value));
}

export function statesEqual(first: unknown, second: unknown): boolean {
  return stateFingerprint(first) === stateFingerprint(second);
}

export function hasGrowLensRecords(value: unknown): boolean {
  const state = normalizeState(value);
  return state.spaces.length > 0
    || state.cycles.length > 0
    || state.plants.length > 0
    || state.diary.length > 0
    || state.tasks.length > 0
    || state.readings.length > 0
    || state.calibrationProfiles.length > 0
    || state.observations.length > 0;
}

export function summarizeGrowLensState(value: unknown): { records: number; plants: number; diary: number; tasks: number } {
  const state = normalizeState(value);
  return {
    records: state.spaces.length
      + state.cycles.length
      + state.plants.length
      + state.diary.length
      + state.tasks.length
      + state.readings.length
      + state.calibrationProfiles.length
      + state.observations.length,
    plants: state.plants.length,
    diary: state.diary.length,
    tasks: state.tasks.length,
  };
}
