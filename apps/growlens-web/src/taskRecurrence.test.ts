import { describe, expect, it } from 'vitest';
import {
  completeOrAdvanceTask,
  nextRecurringDueDate,
  normalizeTaskRecurrence,
  reopenTask,
} from './taskRecurrence';
import type { GrowTask } from './types';

function task(overrides: Partial<GrowTask> = {}): GrowTask {
  return {
    id: 'task-test-001',
    title: 'Scout leaf undersides',
    dueDate: '2026-07-13',
    plantId: null,
    completed: false,
    recurrence: 'none',
    lastCompletedAt: null,
    completionCount: 0,
    createdAt: '2026-07-12T12:00:00.000Z',
    ...overrides,
  };
}

describe('GrowLens recurring tasks', () => {
  it('treats unknown and legacy recurrence values as one-time tasks', () => {
    expect(normalizeTaskRecurrence(undefined)).toBe('none');
    expect(normalizeTaskRecurrence('hourly')).toBe('none');
  });

  it('advances daily and weekly tasks from today when they are overdue', () => {
    expect(nextRecurringDueDate('2026-07-01', 'daily', '2026-07-13')).toBe('2026-07-14');
    expect(nextRecurringDueDate('2026-07-01', 'weekly', '2026-07-13')).toBe('2026-07-20');
  });

  it('keeps future schedules anchored to their existing due date', () => {
    expect(nextRecurringDueDate('2026-07-20', 'daily', '2026-07-13')).toBe('2026-07-21');
    expect(nextRecurringDueDate('2026-07-20', 'weekly', '2026-07-13')).toBe('2026-07-27');
  });

  it('clamps monthly recurrence to the last valid day of the month', () => {
    expect(nextRecurringDueDate('2028-01-31', 'monthly', '2028-01-01')).toBe('2028-02-29');
    expect(nextRecurringDueDate('2027-01-31', 'monthly', '2027-01-01')).toBe('2027-02-28');
  });

  it('completes a one-time task and records completion history', () => {
    const completed = completeOrAdvanceTask(task(), '2026-07-13T16:30:00.000Z');
    expect(completed.completed).toBe(true);
    expect(completed.lastCompletedAt).toBe('2026-07-13T16:30:00.000Z');
    expect(completed.completionCount).toBe(1);
  });

  it('reschedules a recurring task without producing duplicate task records', () => {
    const advanced = completeOrAdvanceTask(task({ recurrence: 'weekly' }), '2026-07-13T16:30:00.000Z');
    expect(advanced.completed).toBe(false);
    expect(advanced.dueDate).toBe('2026-07-20');
    expect(advanced.lastCompletedAt).toBe('2026-07-13T16:30:00.000Z');
    expect(advanced.completionCount).toBe(1);
  });

  it('reopens completed one-time tasks without erasing completion history', () => {
    const reopened = reopenTask(task({ completed: true, completionCount: 2, lastCompletedAt: '2026-07-13T16:30:00.000Z' }));
    expect(reopened.completed).toBe(false);
    expect(reopened.completionCount).toBe(2);
    expect(reopened.lastCompletedAt).toBe('2026-07-13T16:30:00.000Z');
  });
});
