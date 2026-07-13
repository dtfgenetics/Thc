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
});
