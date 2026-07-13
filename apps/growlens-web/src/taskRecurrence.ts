import type { GrowTask, TaskRecurrence } from './types';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export const taskRecurrenceLabels: Record<TaskRecurrence, string> = {
  none: 'One time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export function normalizeTaskRecurrence(value: unknown): TaskRecurrence {
  return value === 'daily' || value === 'weekly' || value === 'monthly' ? value : 'none';
}

function parseDateOnly(value: string): Date | null {
  if (!dateOnlyPattern.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? date
    : null;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addMonthsClamped(value: Date, months: number): Date {
  const targetMonth = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  targetMonth.setUTCDate(Math.min(value.getUTCDate(), lastDay));
  return targetMonth;
}

export function nextRecurringDueDate(
  dueDate: string,
  recurrenceValue: unknown,
  today = new Date().toISOString().slice(0, 10),
): string {
  const recurrence = normalizeTaskRecurrence(recurrenceValue);
  if (recurrence === 'none') return dueDate;

  const parsedToday = parseDateOnly(today) ?? new Date(Date.UTC(1970, 0, 1));
  const parsedDueDate = parseDateOnly(dueDate) ?? parsedToday;
  const anchor = parsedDueDate.getTime() < parsedToday.getTime() ? parsedToday : parsedDueDate;

  if (recurrence === 'daily') {
    anchor.setUTCDate(anchor.getUTCDate() + 1);
  } else if (recurrence === 'weekly') {
    anchor.setUTCDate(anchor.getUTCDate() + 7);
  } else {
    return formatDateOnly(addMonthsClamped(anchor, 1));
  }

  return formatDateOnly(anchor);
}

export function completeOrAdvanceTask(
  task: GrowTask,
  completedAt = new Date().toISOString(),
): GrowTask {
  const recurrence = normalizeTaskRecurrence(task.recurrence);
  const previousCompletionCount = typeof task.completionCount === 'number' && Number.isFinite(task.completionCount)
    ? Math.max(0, task.completionCount)
    : 0;
  const completionCount = previousCompletionCount + 1;

  if (recurrence === 'none') {
    return {
      ...task,
      completed: true,
      recurrence,
      lastCompletedAt: completedAt,
      completionCount,
    };
  }

  return {
    ...task,
    completed: false,
    recurrence,
    dueDate: nextRecurringDueDate(task.dueDate, recurrence, completedAt.slice(0, 10)),
    lastCompletedAt: completedAt,
    completionCount,
  };
}

export function reopenTask(task: GrowTask): GrowTask {
  return {
    ...task,
    completed: false,
  };
}
