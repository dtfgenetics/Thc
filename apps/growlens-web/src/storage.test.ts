import { describe, expect, it } from 'vitest';
import { emptyState, normalizeState, parseBackup, serializeBackup } from './storage';

describe('GrowLens storage', () => {
  it('normalizes invalid data into a safe empty state', () => {
    expect(normalizeState(null)).toEqual(emptyState);
    expect(normalizeState({ plants: 'invalid' }).plants).toEqual([]);
  });

  it('round-trips a GrowLens backup', () => {
    const state = {
      ...structuredClone(emptyState),
      plants: [
        {
          id: 'plant-1',
          name: 'BM-01',
          strain: 'Blue Mango F3',
          stage: 'vegetative' as const,
          status: 'active' as const,
          spaceId: 'space-1',
          cycleId: 'cycle-1',
          startDate: '2026-07-13',
          notes: '',
          createdAt: '2026-07-13T12:00:00.000Z',
        },
      ],
    };

    expect(parseBackup(serializeBackup(state))).toEqual(state);
  });

  it('accepts a raw state backup for backwards compatibility', () => {
    const state = structuredClone(emptyState);
    expect(parseBackup(JSON.stringify(state))).toEqual(state);
  });
  it('rejects unrelated or malformed backups rather than silently clearing data', () => {
    for (const value of [null, [], {}, { state: null }, { plants: 'invalid' },
      { plants: [null] }, { schemaVersion: 999, plants: [] },
      { app: 'Other app', state: emptyState }, { plants: [], tasks: 'invalid' }]) {
      expect(() => parseBackup(JSON.stringify(value))).toThrow();
    }
  });

  it('rejects records that normalization would silently discard', () => {
    for (const key of ['irrigationRecords', 'feedingRecords', 'reservoirRecords', 'harvestRecords', 'observationOutcomes']) {
      expect(() => parseBackup(JSON.stringify({ schemaVersion: 2, [key]: [{}] }))).toThrow(/cannot be restored/);
    }
  });

  it('accepts a legacy partial state with a recognized collection', () => {
    expect(parseBackup(JSON.stringify({ schemaVersion: 1, plants: [] }))).toEqual(emptyState);
  });
});
