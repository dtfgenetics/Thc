import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  completeOrAdvanceTask,
  normalizeTaskRecurrence,
  reopenTask,
  taskRecurrenceLabels,
} from './taskRecurrence';
import {
  createId,
  loadState,
  saveState,
  STATE_SAVED_EVENT,
} from './storage';
import type {
  GrowLensState,
  GrowTask,
  TaskRecurrence,
} from './types';

const REMINDERS_ENABLED_KEY = 'growlens-task-reminders-enabled-v1';
const LAST_REMINDER_KEY = 'growlens-task-reminders-last-date-v1';
const recurrenceOptions: TaskRecurrence[] = ['none', 'daily', 'weekly', 'monthly'];

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  if (!value) return 'No date';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function recurringTasksWereChecked(state: GrowLensState): boolean {
  return state.tasks.some((task) => normalizeTaskRecurrence(task.recurrence) !== 'none' && task.completed);
}

function repairCheckedRecurringTasks(state: GrowLensState): GrowLensState {
  if (!recurringTasksWereChecked(state)) return state;
  const completedAt = new Date().toISOString();
  return {
    ...state,
    tasks: state.tasks.map((task) => normalizeTaskRecurrence(task.recurrence) !== 'none' && task.completed
      ? completeOrAdvanceTask(task, completedAt)
      : task),
  };
}

export default function TaskRoutineWidget() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GrowLensState>(() => loadState());
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(todayInput());
  const [plantId, setPlantId] = useState('');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('weekly');
  const [message, setMessage] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(
    () => window.localStorage.getItem(REMINDERS_ENABLED_KEY) === 'true',
  );

  function commit(nextState: GrowLensState): void {
    saveState(nextState, window.localStorage, 'external');
    setState(nextState);
  }

  function refreshState(): void {
    const loaded = loadState();
    const repaired = repairCheckedRecurringTasks(loaded);
    if (repaired !== loaded) {
      saveState(repaired, window.localStorage, 'external');
    }
    setState(repaired);
  }

  useEffect(() => {
    refreshState();
    const refresh = () => refreshState();
    window.addEventListener(STATE_SAVED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STATE_SAVED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const sortedTasks = useMemo(
    () => [...state.tasks].sort((first, second) => Number(first.completed) - Number(second.completed)
      || first.dueDate.localeCompare(second.dueDate)
      || first.title.localeCompare(second.title)),
    [state.tasks],
  );
  const openTasks = sortedTasks.filter((task) => !task.completed);
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < todayInput());
  const recurringTasks = openTasks.filter((task) => normalizeTaskRecurrence(task.recurrence) !== 'none');

  useEffect(() => {
    if (!remindersEnabled || !('Notification' in window) || Notification.permission !== 'granted') return undefined;

    const notifyDueTasks = () => {
      const today = todayInput();
      if (window.localStorage.getItem(LAST_REMINDER_KEY) === today) return;
      const due = state.tasks.filter((task) => !task.completed && task.dueDate && task.dueDate <= today);
      if (due.length === 0) return;
      const firstTitles = due.slice(0, 3).map((task) => task.title).join(', ');
      const extra = due.length > 3 ? ` and ${due.length - 3} more` : '';
      new Notification(`${due.length} GrowLens task${due.length === 1 ? '' : 's'} due`, {
        body: `${firstTitles}${extra}`,
        tag: `growlens-tasks-${today}`,
      });
      window.localStorage.setItem(LAST_REMINDER_KEY, today);
    };

    notifyDueTasks();
    window.addEventListener('focus', notifyDueTasks);
    document.addEventListener('visibilitychange', notifyDueTasks);
    return () => {
      window.removeEventListener('focus', notifyDueTasks);
      document.removeEventListener('visibilitychange', notifyDueTasks);
    };
  }, [remindersEnabled, state.tasks]);

  function addRoutine(event: FormEvent): void {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const task: GrowTask = {
      id: createId('task'),
      title: trimmedTitle,
      dueDate,
      plantId: plantId || null,
      completed: false,
      recurrence,
      lastCompletedAt: null,
      completionCount: 0,
      createdAt: new Date().toISOString(),
    };
    commit({ ...state, tasks: [...state.tasks, task] });
    setTitle('');
    setMessage(recurrence === 'none'
      ? `Task “${trimmedTitle}” added.`
      : `${taskRecurrenceLabels[recurrence]} routine “${trimmedTitle}” added.`);
  }

  function toggleTask(task: GrowTask): void {
    if (task.completed) {
      const reopened = reopenTask(task);
      commit({ ...state, tasks: state.tasks.map((candidate) => candidate.id === task.id ? reopened : candidate) });
      setMessage(`Task “${task.title}” reopened.`);
      return;
    }

    const completedAt = new Date().toISOString();
    const updated = completeOrAdvanceTask(task, completedAt);
    commit({ ...state, tasks: state.tasks.map((candidate) => candidate.id === task.id ? updated : candidate) });
    const normalizedRecurrence = normalizeTaskRecurrence(task.recurrence);
    setMessage(normalizedRecurrence === 'none'
      ? `Task “${task.title}” completed.`
      : `Routine completed. “${task.title}” is next due ${formatDate(updated.dueDate)}.`);
  }

  function deleteTask(task: GrowTask): void {
    if (!window.confirm(`Delete “${task.title}” and its completion history?`)) return;
    commit({ ...state, tasks: state.tasks.filter((candidate) => candidate.id !== task.id) });
    setMessage(`Task “${task.title}” deleted.`);
  }

  async function enableReminders(): Promise<void> {
    if (!('Notification' in window)) {
      setMessage('This browser does not support notifications. Tasks still remain available in GrowLens.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setMessage('Notification permission was not granted. No browser reminders will be shown.');
      return;
    }
    window.localStorage.setItem(REMINDERS_ENABLED_KEY, 'true');
    window.localStorage.removeItem(LAST_REMINDER_KEY);
    setRemindersEnabled(true);
    setMessage('Due reminders enabled. GrowLens checks them while the PWA is open or active.');
  }

  function disableReminders(): void {
    window.localStorage.setItem(REMINDERS_ENABLED_KEY, 'false');
    setRemindersEnabled(false);
    setMessage('Due reminders disabled.');
  }

  return <>
    <button className="routines-launcher" type="button" onClick={() => { refreshState(); setOpen(true); }} aria-label="Open GrowLens routines and reminders"><span aria-hidden="true">↻</span><strong>Routines</strong></button>
    {open ? <div className="routines-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section className="routines-panel" role="dialog" aria-modal="true" aria-labelledby="routines-title">
        <header className="routines-header"><div><span className="eyebrow">Repeatable cultivation work</span><h2 id="routines-title">Routines & reminders</h2><p>Recurring tasks advance to their next due date when completed instead of creating duplicate records.</p></div><button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close routines">×</button></header>
        {message ? <div className="account-message success" role="status">{message}</div> : null}
        <div className="routines-stats"><article><span>Open</span><strong>{openTasks.length}</strong></article><article><span>Overdue</span><strong>{overdueTasks.length}</strong></article><article><span>Recurring</span><strong>{recurringTasks.length}</strong></article><article><span>Reminders</span><strong>{remindersEnabled ? 'On' : 'Off'}</strong></article></div>
        <div className="routines-layout">
          <section className="routines-card"><h3>Add task or routine</h3><form className="stack-form" onSubmit={addRoutine}><label>Task<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Inspect leaf undersides" required /></label><label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label><label>Repeat<select value={recurrence} onChange={(event) => setRecurrence(event.target.value as TaskRecurrence)}>{recurrenceOptions.map((option) => <option key={option} value={option}>{taskRecurrenceLabels[option]}</option>)}</select></label><label>Plant<select value={plantId} onChange={(event) => setPlantId(event.target.value)}><option value="">Whole grow</option>{state.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</select></label><button className="primary-button" type="submit">Add {recurrence === 'none' ? 'task' : 'routine'}</button></form><div className="routines-reminder-box"><strong>Browser reminders</strong><p>GrowLens can notify you about due tasks while the installed PWA or browser page is open. This is not a closed-app background alarm.</p>{remindersEnabled ? <button className="secondary-button" type="button" onClick={disableReminders}>Disable reminders</button> : <button className="secondary-button" type="button" onClick={enableReminders}>Enable due reminders</button>}</div></section>
          <section className="routines-card"><div className="routines-list-heading"><div><h3>Task schedule</h3><p>{openTasks.length} open · {overdueTasks.length} overdue</p></div></div>{sortedTasks.length ? <div className="routines-list">{sortedTasks.map((task) => { const plant = state.plants.find((candidate) => candidate.id === task.plantId); const normalizedRecurrence = normalizeTaskRecurrence(task.recurrence); return <article className={`routine-row ${task.completed ? 'completed' : ''}`} key={task.id}><button className="routine-check" type="button" onClick={() => toggleTask(task)} aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>{task.completed ? '✓' : ''}</button><div><div className="routine-title-line"><strong>{task.title}</strong>{normalizedRecurrence !== 'none' ? <span>{taskRecurrenceLabels[normalizedRecurrence]}</span> : null}</div><small className={!task.completed && task.dueDate < todayInput() ? 'danger-text' : ''}>{formatDate(task.dueDate)}{plant ? ` · ${plant.name}` : ''}</small>{(task.completionCount ?? 0) > 0 ? <small>{task.completionCount} completion{task.completionCount === 1 ? '' : 's'} · last {formatDateTime(task.lastCompletedAt)}</small> : null}</div><button className="routine-delete" type="button" onClick={() => deleteTask(task)} aria-label={`Delete ${task.title}`}>×</button></article>; })}</div> : <div className="empty-state"><strong>No tasks yet</strong><span>Add a one-time action or repeatable cultivation routine.</span></div>}</section>
        </div>
      </section>
    </div> : null}
  </>;
}
