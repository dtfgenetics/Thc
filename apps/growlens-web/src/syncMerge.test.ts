import { describe, expect, it } from 'vitest';
import { emptyState } from './storage';
import {
  hasGrowLensRecords,
  mergeGrowLensStates,
  statesEqual,
  summarizeGrowLensState,
} from './syncMerge';

const remotePlant = {
  id: 'plant-shared',
  name: 'Remote name',
  strain: 'Blue Mango',
  stage: 'vegetative' as const,
  status: 'active' as const,
  spaceId: 'space-1',
  cycleId: 'cycle-1',
  startDate: '2026-07-01',
  notes: 'Remote version',
  createdAt: '2026-07-01T00:00:00Z',
};

const localPlant = {
  ...remotePlant,
  name: 'Local name',
  notes: 'Local version wins when the same ID conflicts',
};

describe('GrowLens sync merge', () => {
  it('unions records by ID and keeps the local version for matching IDs', () => {
    const remote = {
      ...structuredClone(emptyState),
      plants: [remotePlant],
      tasks: [{
        id: 'task-remote',
        title: 'Remote task',
        dueDate: '2026-07-14',
        plantId: null,
        completed: false,
        createdAt: '2026-07-13T00:00:00Z',
      }],
    };
    const local = {
      ...structuredClone(emptyState),
      plants: [localPlant, { ...localPlant, id: 'plant-local', name: 'Local-only plant' }],
    };

    const merged = mergeGrowLensStates(local, remote);

    expect(merged.plants).toHaveLength(2);
    expect(merged.plants.find((plant) => plant.id === 'plant-shared')?.name).toBe('Local name');
    expect(merged.tasks[0]?.id).toBe('task-remote');
  });

  it('detects meaningful local data and equal snapshots', () => {
    expect(hasGrowLensRecords(emptyState)).toBe(false);
    expect(hasGrowLensRecords({ ...emptyState, plants: [localPlant] })).toBe(true);
    expect(statesEqual(emptyState, structuredClone(emptyState))).toBe(true);
    expect(statesEqual(emptyState, { ...emptyState, plants: [localPlant] })).toBe(false);
  });

  it('summarizes records for conflict decisions', () => {
    const summary = summarizeGrowLensState({
      ...emptyState,
      plants: [localPlant],
      diary: [{
        id: 'entry-1',
        plantId: localPlant.id,
        cycleId: localPlant.cycleId,
        type: 'note' as const,
        title: 'Checked plant',
        notes: '',
        createdAt: '2026-07-13T00:00:00Z',
      }],
    });

    expect(summary).toEqual({ records: 2, plants: 1, diary: 1, tasks: 0 });
  });
});
