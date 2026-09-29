import { describe, expect, it } from 'vitest';
import { buildResearchExport, safeResearchLabel } from './researchExport';
import { emptyState } from './storage';

describe('GrowLens research export', () => {
  it('remaps IDs, removes absolute dates, and omits private free text', () => {
    const state = structuredClone(emptyState);
    state.spaces.push({
      id: 'space-secret-id',
      name: 'My Basement',
      environment: 'indoor',
      lightHours: 18,
      createdAt: '2026-01-01T12:00:00.000Z',
    });
    state.cycles.push({
      id: 'cycle-secret-id',
      name: 'Private cycle name',
      spaceId: 'space-secret-id',
      startDate: '2026-01-01',
      stage: 'vegetative',
      status: 'active',
    });
    state.plants.push({
      id: 'plant-secret-id',
      name: 'Personal plant name',
      strain: 'Blue Mango F3',
      stage: 'flowering',
      status: 'active',
      spaceId: 'space-secret-id',
      cycleId: 'cycle-secret-id',
      startDate: '2026-01-02',
      notes: 'Call me at 816-555-1212',
      createdAt: '2026-01-02T12:00:00.000Z',
    });
    state.observations.push({
      id: 'obs-secret-id',
      plantId: 'plant-secret-id',
      symptoms: ['interveinal chlorosis'],
      notes: 'email me@example.com',
      possibleCauses: ['magnesium deficiency'],
      createdAt: '2026-01-03T12:00:00.000Z',
    });

    const exported = buildResearchExport(state, true, '2026-09-29T00:00:00.000Z');
    const serialized = JSON.stringify(exported);

    expect(exported.records.plants[0]).toMatchObject({
      plantId: 'plant-001',
      cultivar: 'Blue Mango F3',
      spaceId: 'space-001',
      cycleId: 'cycle-001',
    });
    expect(exported.records.observations[0].observationId).toBe('observation-001');
    expect(serialized).not.toContain('space-secret-id');
    expect(serialized).not.toContain('cycle-secret-id');
    expect(serialized).not.toContain('plant-secret-id');
    expect(serialized).not.toContain('Personal plant name');
    expect(serialized).not.toContain('Private cycle name');
    expect(serialized).not.toContain('816-555-1212');
    expect(serialized).not.toContain('me@example.com');
    expect(serialized).not.toContain('2026-01-01');
    expect(exported.consent.repositoryPublicationApproved).toBe(true);
  });

  it('rejects labels that look like contact details or URLs', () => {
    expect(safeResearchLabel('Blue Mango')).toBe('Blue Mango');
    expect(safeResearchLabel('me@example.com')).toBeNull();
    expect(safeResearchLabel('https://example.com/grow')).toBeNull();
    expect(safeResearchLabel('+1 (816) 555-1212')).toBeNull();
  });
});
