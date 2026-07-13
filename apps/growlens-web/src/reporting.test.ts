import { describe, expect, it } from 'vitest';
import { emptyState } from './storage';
import {
  buildPlantTimeline,
  calculateCalibration,
  createCsv,
  createGrowLensCsvExports,
  createPrintableReport,
  environmentStats,
  summarizeReport,
} from './reporting';

const state = {
  ...structuredClone(emptyState),
  plants: [{
    id: 'plant-1',
    name: 'BM-01',
    strain: 'Blue Mango F3',
    stage: 'flowering' as const,
    status: 'active' as const,
    spaceId: 'space-1',
    cycleId: 'cycle-1',
    startDate: '2026-07-01',
    notes: '<script>alert(1)</script>',
    createdAt: '2026-07-01T00:00:00Z',
  }],
  diary: [{
    id: 'entry-1',
    plantId: 'plant-1',
    cycleId: 'cycle-1',
    type: 'watering' as const,
    title: 'Measured irrigation',
    notes: '500 mL, "even runoff"',
    createdAt: '2026-07-13T10:00:00Z',
  }],
  tasks: [{
    id: 'task-1',
    title: 'Inspect leaves',
    dueDate: '2026-07-14',
    plantId: 'plant-1',
    completed: false,
    createdAt: '2026-07-13T00:00:00Z',
  }],
  readings: [
    { id: 'reading-1', spaceId: 'space-1', temperatureC: 24, humidity: 60, ppfd: 400, createdAt: '2026-07-13T08:00:00Z' },
    { id: 'reading-2', spaceId: 'space-1', temperatureC: 28, humidity: 50, ppfd: 600, createdAt: '2026-07-13T12:00:00Z' },
  ],
  observations: [{
    id: 'observation-1',
    plantId: 'plant-1',
    symptoms: ['webbing'],
    notes: 'Upper leaf',
    possibleCauses: ['Possible pest pressure'],
    photoIds: ['photo-1'],
    createdAt: '2026-07-13T11:00:00Z',
  }],
};

describe('GrowLens reporting', () => {
  it('summarizes the current grow state', () => {
    expect(summarizeReport(state)).toMatchObject({
      activePlants: 1,
      diaryEntries: 1,
      openTasks: 1,
      observations: 1,
      readings: 2,
    });
  });

  it('calculates environment ranges and averages', () => {
    const stats = environmentStats(state.readings);
    expect(stats.temperatureC).toMatchObject({ minimum: 24, maximum: 28, average: 26 });
    expect(stats.ppfd).toMatchObject({ minimum: 400, maximum: 600, average: 500 });
    expect(stats.vpdKpa?.count).toBe(2);
  });

  it('uses the median calibration factor and reports variability', () => {
    const result = calculateCalibration([
      { lux: 40_000, ppfd: 600 },
      { lux: 42_000, ppfd: 630 },
      { lux: 40_000, ppfd: 1_000 },
    ]);
    expect(result?.count).toBe(3);
    expect(result?.factor).toBeCloseTo(0.015, 6);
    expect(result?.variabilityPercent).toBeGreaterThan(20);
  });

  it('builds a descending plant timeline across record types', () => {
    const timeline = buildPlantTimeline(state, 'plant-1');
    expect(timeline.map((event) => event.kind)).toEqual(['task', 'observation', 'diary']);
  });

  it('escapes commas, quotes, and line breaks in CSV', () => {
    expect(createCsv(['name', 'notes'], [['BM-01', 'one, "two"\nthree']]))
      .toBe('name,notes\r\nBM-01,"one, ""two""\nthree"');
  });

  it('creates separate downloadable CSV datasets', () => {
    const exports = createGrowLensCsvExports(state);
    expect(exports.plants).toContain('Blue Mango F3');
    expect(exports.diary).toContain('"500 mL, ""even runoff"""');
    expect(exports.readings).toContain('vpdKpa');
    expect(exports.observations).toContain('photo-1');
  });

  it('escapes user text in printable HTML', () => {
    const report = createPrintableReport(state);
    expect(report).toContain('THC GrowLens report');
    expect(report).not.toContain('<script>alert(1)</script>');
    expect(report).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
