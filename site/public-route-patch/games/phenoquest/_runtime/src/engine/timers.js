export function createTimer({ id, recipeId, durationSeconds, inputTags = [], weatherAtStart = null, cueAtStart = null }) {
  return {
    id,
    recipeId,
    startTimestamp: Date.now(),
    durationSeconds,
    inputTags,
    weatherAtStart,
    cueAtStart,
    status: 'active'
  };
}

export function getTimerRemainingSeconds(timer, now = Date.now()) {
  const elapsedMs = now - timer.startTimestamp;
  const remainingMs = timer.durationSeconds * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function isTimerReady(timer, now = Date.now()) {
  return getTimerRemainingSeconds(timer, now) <= 0;
}

export function updateTimerStatus(timer, now = Date.now()) {
  if (timer.status !== 'active') return timer;
  return {
    ...timer,
    status: isTimerReady(timer, now) ? 'ready' : 'active'
  };
}

export function updateAllTimers(timers, now = Date.now()) {
  return timers.map((timer) => updateTimerStatus(timer, now));
}
