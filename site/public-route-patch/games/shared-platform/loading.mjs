export class LoadingTaskError extends Error {
  constructor(message, { failed = [], cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'LoadingTaskError';
    this.failed = failed;
  }
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error('At least one loading task is required.');
  const ids = new Set();
  return tasks.map((task, index) => {
    if (!task || typeof task.load !== 'function') throw new Error(`Loading task ${index + 1} requires a load() function.`);
    const id = String(task.id || `task-${index + 1}`);
    if (ids.has(id)) throw new Error(`Duplicate loading task id: ${id}`);
    ids.add(id);
    return { ...task, id };
  });
}

export async function runLoadTasks(tasks, {
  onProgress = null,
  retries = 0,
  retryDelayMs = 0,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const list = normalizeTasks(tasks);
  const results = new Map();
  const failures = [];
  let completed = 0;

  const report = (detail = {}) => {
    onProgress?.({
      completed,
      total: list.length,
      progress: list.length ? completed / list.length : 1,
      ...detail,
    });
  };

  report({ phase: 'start' });

  async function execute(task) {
    let attempt = 0;
    while (true) {
      try {
        const value = await task.load({ id: task.id, attempt });
        results.set(task.id, value);
        completed += 1;
        report({ phase: 'complete', id: task.id, attempt });
        return;
      } catch (error) {
        if (attempt >= retries) {
          failures.push({ id: task.id, error, attempts: attempt + 1 });
          completed += 1;
          report({ phase: 'error', id: task.id, attempt, error });
          return;
        }
        attempt += 1;
        report({ phase: 'retry', id: task.id, attempt, error });
        if (retryDelayMs > 0) await sleep(retryDelayMs);
      }
    }
  }

  await Promise.all(list.map(execute));

  if (failures.length) {
    const ids = failures.map((item) => item.id);
    throw new LoadingTaskError(
      `Loading failed for ${ids.length} task(s): ${ids.join(', ')}`,
      { failed: failures, cause: failures[0]?.error },
    );
  }

  report({ phase: 'ready' });
  return results;
}

export function loadingResultsToObject(results) {
  if (!(results instanceof Map)) throw new TypeError('Loading results must be a Map.');
  return Object.fromEntries(results.entries());
}
