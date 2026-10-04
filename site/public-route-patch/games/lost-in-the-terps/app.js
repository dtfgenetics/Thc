const missions = document.querySelector('#missions');
const gridEl = document.querySelector('#grid');
const wordsEl = document.querySelector('#words');
const titleEl = document.querySelector('#mission-title');
const descEl = document.querySelector('#description');
const scoreEl = document.querySelector('#score');
const message = document.querySelector('#message');
const complete = document.querySelector('#complete');
const resetButton = document.querySelector('#reset');
const againButton = document.querySelector('#again');
const hud = document.querySelector('.hud');

const gridViewport = document.createElement('div');
gridViewport.className = 'grid-viewport';
gridEl.parentNode.insertBefore(gridViewport, gridEl);
gridViewport.append(gridEl);

const attemptsCard = document.createElement('div');
attemptsCard.innerHTML = '<span>Attempts</span><strong id="attempts">0</strong>';
hud.insertBefore(attemptsCard, resetButton);
const attemptsEl = attemptsCard.querySelector('#attempts');

const hintButton = document.createElement('button');
hintButton.id = 'hint';
hintButton.type = 'button';
hintButton.textContent = 'Hint (3)';
hud.insertBefore(hintButton, resetButton);

const completeSummary = document.createElement('p');
completeSummary.id = 'complete-summary';
complete.insertBefore(completeSummary, againButton);

let data;
let puzzle;
let start = null;
let found = new Set();
let attempts = 0;
let hintsRemaining = 3;
let hintsUsed = 0;
let missionToken = 0;
let pendingMissionId = null;
let missionArmUntil = 0;
let missionArmTimer = null;
let resetArmedUntil = 0;
let resetArmTimer = null;

const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const cellSelector = ([row, col]) => `[data-r="${row}"][data-c="${col}"]`;

function coordsBetween(a, b) {
  const [r1, c1] = a;
  const [r2, c2] = b;
  const rowDistance = Math.abs(r2 - r1);
  const colDistance = Math.abs(c2 - c1);
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  if (!(dr === 0 || dc === 0 || rowDistance === colDistance)) return [];
  const steps = Math.max(rowDistance, colDistance);
  return Array.from({ length: steps + 1 }, (_, index) => [r1 + dr * index, c1 + dc * index]);
}

function readEmbeddedData() {
  const node = document.querySelector('#terps-puzzle-data');
  if (!node) throw new Error('Embedded puzzle data is missing.');
  const parsed = JSON.parse(node.textContent || '{}');
  validateData(parsed);
  return parsed;
}

function validateData(candidate) {
  if (candidate?.schemaVersion !== 1 || !Array.isArray(candidate.puzzles) || !candidate.puzzles.length) throw new Error('Puzzle data is unavailable.');
  const puzzleIds = new Set();
  for (const item of candidate.puzzles) {
    if (!item?.id || !item?.title || !Number.isInteger(item.size) || item.size < 2) throw new Error('A puzzle definition is incomplete.');
    if (puzzleIds.has(item.id)) throw new Error(`Duplicate puzzle id: ${item.id}`);
    puzzleIds.add(item.id);
    if (!Array.isArray(item.grid) || item.grid.length !== item.size || item.grid.some((row) => typeof row !== 'string' || row.length !== item.size)) {
      throw new Error(`${item.title} has an invalid letter grid.`);
    }
    if (!Array.isArray(item.words) || !item.words.length) throw new Error(`${item.title} has no hidden words.`);
    const words = new Set();
    for (const entry of item.words) {
      if (!entry?.word || !Array.isArray(entry.start) || !Array.isArray(entry.end) || entry.start.length !== 2 || entry.end.length !== 2) throw new Error(`${item.title} contains an invalid hidden word.`);
      if (words.has(entry.word)) throw new Error(`${item.title} contains duplicate word ${entry.word}.`);
      words.add(entry.word);
      const coords = coordsBetween(entry.start, entry.end);
      if (coords.length !== entry.word.length) throw new Error(`${entry.word} has invalid coordinates.`);
      const letters = coords.map(([row, col]) => {
        if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= item.size || col >= item.size) throw new Error(`${entry.word} leaves the puzzle grid.`);
        return item.grid[row][col];
      }).join('');
      if (letters !== entry.word) throw new Error(`${entry.word} does not match the stored grid.`);
    }
  }
}

function matchWord(a, b) {
  return puzzle.words.find((word) => !found.has(word.word) && (
    (same(word.start, a) && same(word.end, b)) ||
    (same(word.end, a) && same(word.start, b))
  ));
}

function clearTransientCells() {
  gridEl.querySelectorAll('.wrong,.hint,.candidate').forEach((element) => element.classList.remove('wrong', 'hint', 'candidate'));
}

function renderWords() {
  wordsEl.replaceChildren();
  for (const word of puzzle.words) {
    const item = document.createElement('div');
    item.className = `word${found.has(word.word) ? ' found' : ''}`;
    item.textContent = word.word;
    if (found.has(word.word)) item.setAttribute('aria-label', `${word.word}, found`);
    wordsEl.append(item);
  }
}

function update() {
  scoreEl.textContent = `${found.size} / ${puzzle.words.length}`;
  attemptsEl.textContent = String(attempts);
  hintButton.textContent = `Hint (${hintsRemaining})`;
  hintButton.disabled = hintsRemaining <= 0 || found.size === puzzle.words.length;
  renderWords();
  if (found.size === puzzle.words.length) {
    complete.hidden = false;
    message.textContent = 'Mission cleared.';
    completeSummary.textContent = `Cleared in ${attempts} attempts with ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} used.`;
    gridEl.classList.add('mission-complete');
  }
}

function renderGrid() {
  gridEl.replaceChildren();
  gridEl.style.gridTemplateColumns = `repeat(${puzzle.size},minmax(0,1fr))`;
  gridEl.style.setProperty('--grid-size', String(puzzle.size));
  const minimumTouchGridWidth = puzzle.size * 36 + Math.max(0, puzzle.size - 1) * 3 + 12;
  gridEl.style.minWidth = `max(100%, ${minimumTouchGridWidth}px)`;
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'letter';
      button.dataset.r = String(row);
      button.dataset.c = String(col);
      button.textContent = puzzle.grid[row][col];
      button.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, ${button.textContent}`);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => choose([row, col], button));
      gridEl.append(button);
    }
  }
}

function paintFound() {
  gridEl.querySelectorAll('.letter').forEach((element) => {
    element.classList.remove('found');
    if (!element.classList.contains('start')) element.setAttribute('aria-pressed', 'false');
  });
  const foundCells = new Set();
  for (const word of puzzle.words.filter((item) => found.has(item.word))) {
    for (const coord of coordsBetween(word.start, word.end)) foundCells.add(`${coord[0]},${coord[1]}`);
  }
  for (const coordinate of foundCells) {
    const [row, col] = coordinate.split(',').map(Number);
    const element = gridEl.querySelector(cellSelector([row, col]));
    if (element) {
      element.classList.add('found');
      element.setAttribute('aria-pressed', 'true');
    }
  }
}

function clearStart() {
  gridEl.querySelectorAll('.start').forEach((element) => {
    element.classList.remove('start');
    if (!element.classList.contains('found')) element.setAttribute('aria-pressed', 'false');
  });
  start = null;
}

function showWrongPath(first, last) {
  const token = missionToken;
  const coords = coordsBetween(first, last);
  const targets = coords.length > 1 ? coords : [first, last];
  for (const coord of targets) gridEl.querySelector(cellSelector(coord))?.classList.add('wrong');
  window.setTimeout(() => {
    if (token !== missionToken) return;
    gridEl.querySelectorAll('.wrong').forEach((element) => element.classList.remove('wrong'));
  }, 520);
}

function choose(position, button) {
  if (!start) {
    clearTransientCells();
    start = position;
    button.classList.add('start');
    button.setAttribute('aria-pressed', 'true');
    message.textContent = 'Now choose the last letter.';
    return;
  }
  if (same(start, position)) {
    clearStart();
    message.textContent = 'Selection cleared. Choose a starting letter.';
    return;
  }

  const first = start;
  clearStart();
  attempts += 1;
  const word = matchWord(first, position);
  if (word) {
    found.add(word.word);
    paintFound();
    message.textContent = `Found ${word.word}.`;
    update();
  } else {
    showWrongPath(first, position);
    message.textContent = 'That line is not one of this mission’s words. Try again.';
    update();
  }
}

function useHint() {
  if (hintsRemaining <= 0) return;
  const remaining = puzzle.words.filter((word) => !found.has(word.word));
  if (!remaining.length) return;
  const target = remaining[hintsUsed % remaining.length];
  hintsRemaining -= 1;
  hintsUsed += 1;
  const token = missionToken;
  clearTransientCells();
  const element = gridEl.querySelector(cellSelector(target.start));
  element?.classList.add('hint');
  element?.focus({ preventScroll: true });
  message.textContent = `Hint: ${target.word.length} letters. Its starting cell is glowing.`;
  update();
  window.setTimeout(() => {
    if (token !== missionToken) return;
    element?.classList.remove('hint');
  }, 1800);
}

function safeReplaceMissionUrl() {
  try {
    globalThis.history?.replaceState?.(null, '', `?mission=${encodeURIComponent(puzzle.id)}`);
  } catch {}
}

function clearMissionArm() {
  pendingMissionId = null;
  missionArmUntil = 0;
  clearTimeout(missionArmTimer);
  missionArmTimer = null;
  missions.querySelectorAll('button').forEach((button) => button.removeAttribute('data-armed'));
}

function requestMission(id) {
  if (id === puzzle?.id) return;
  const hasProgress = found.size > 0 || attempts > 0 || start !== null;
  if (!hasProgress) {
    select(id);
    return;
  }
  const now = Date.now();
  if (pendingMissionId !== id || now > missionArmUntil) {
    clearMissionArm();
    pendingMissionId = id;
    missionArmUntil = now + 3500;
    const button = missions.querySelector(`button[data-id="${id}"]`);
    button?.setAttribute('data-armed', 'true');
    message.textContent = 'Tap that mission again within 3.5 seconds to abandon current progress.';
    missionArmTimer = setTimeout(clearMissionArm, 3600);
    return;
  }
  select(id);
}

function clearResetArm() {
  resetArmedUntil = 0;
  clearTimeout(resetArmTimer);
  resetArmTimer = null;
  resetButton.textContent = 'Reset mission';
  resetButton.removeAttribute('data-armed');
}

function requestReset() {
  const hasProgress = found.size > 0 || attempts > 0 || start !== null;
  if (!hasProgress) {
    select(puzzle.id);
    return;
  }
  const now = Date.now();
  if (now > resetArmedUntil) {
    resetArmedUntil = now + 3500;
    resetButton.textContent = 'Confirm reset';
    resetButton.dataset.armed = 'true';
    message.textContent = 'Tap Confirm reset within 3.5 seconds to erase this mission progress.';
    clearTimeout(resetArmTimer);
    resetArmTimer = setTimeout(clearResetArm, 3600);
    return;
  }
  select(puzzle.id);
}

function select(id) {
  missionToken += 1;
  puzzle = data.puzzles.find((item) => item.id === id) || data.puzzles[0];
  found = new Set();
  attempts = 0;
  hintsRemaining = 3;
  hintsUsed = 0;
  clearStart();
  clearTransientCells();
  clearMissionArm();
  clearResetArm();
  complete.hidden = true;
  completeSummary.textContent = '';
  gridEl.classList.remove('mission-complete');
  titleEl.textContent = puzzle.title;
  descEl.textContent = puzzle.description;
  missions.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.id === puzzle.id)));
  renderGrid();
  update();
  message.textContent = 'Choose a starting letter.';
  safeReplaceMissionUrl();
}

function renderMissions() {
  missions.replaceChildren();
  for (const item of data.puzzles) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = item.id;
    button.textContent = item.title;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => requestMission(item.id));
    missions.append(button);
  }
}

function showLoadError(error) {
  gridEl.replaceChildren();
  const alert = document.createElement('p');
  alert.setAttribute('role', 'alert');
  alert.textContent = `Lost in the Terps could not load. ${error.message}`;
  gridEl.append(alert);
  message.textContent = 'The mission could not start. Refresh the page or return to the Game Hub.';
  console.error(error);
}

// BEGIN LOST IN THE TERPS AGENT BRIDGE
const LOST_TERPS_AGENT_VERSION = 'lost-in-the-terps-agent-bridge-v1';
const LOST_TERPS_AGENT_MAX_EVENTS = 32;
const LOST_TERPS_AGENT_STALL_MS = 8000;
const lostTerpsAgentTelemetry = { actions: [], errors: [], lastProgressKey: '', lastProgressAt: 0, lastActionAt: 0 };

function lostTerpsAgentNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}
function pushLostTerpsAgentEvent(list, event) {
  list.push(Object.freeze(event));
  if (list.length > LOST_TERPS_AGENT_MAX_EVENTS) list.splice(0, list.length - LOST_TERPS_AGENT_MAX_EVENTS);
}
function recordLostTerpsAgentAction(action, detail = null) {
  const now = lostTerpsAgentNow();
  lostTerpsAgentTelemetry.lastActionAt = now;
  pushLostTerpsAgentEvent(lostTerpsAgentTelemetry.actions, { atMs: Math.round(now), action, detail });
}
function recordLostTerpsAgentError(kind, messageText, source = null) {
  pushLostTerpsAgentEvent(lostTerpsAgentTelemetry.errors, {
    atMs: Math.round(lostTerpsAgentNow()),
    kind,
    message: String(messageText || kind || 'unknown error').slice(0, 500),
    source: source ? String(source).slice(0, 500) : null
  });
}
function lostTerpsVisibleGrid() {
  if (!puzzle) return [];
  return Array.from({ length: puzzle.size }, (_, row) =>
    Array.from({ length: puzzle.size }, (_, col) => {
      const element = gridEl.querySelector(cellSelector([row, col]));
      return {
        row,
        col,
        letter: puzzle.grid[row][col],
        selectedStart: Boolean(start && start[0] === row && start[1] === col),
        found: Boolean(element?.classList.contains('found')),
        hinted: Boolean(element?.classList.contains('hint')),
        wrong: Boolean(element?.classList.contains('wrong'))
      };
    })
  );
}
function observeLostTerpsAgentProgress() {
  const progressKey = [
    puzzle?.id || '',
    missionToken,
    found.size,
    attempts,
    hintsRemaining,
    hintsUsed,
    start ? start.join(',') : '',
    complete.hidden ? 0 : 1,
    pendingMissionId || '',
    resetArmedUntil > Date.now() ? 1 : 0
  ].join('|');
  if (progressKey !== lostTerpsAgentTelemetry.lastProgressKey) {
    lostTerpsAgentTelemetry.lastProgressKey = progressKey;
    lostTerpsAgentTelemetry.lastProgressAt = lostTerpsAgentNow();
  }
}
function lostTerpsAgentTelemetrySnapshot() {
  observeLostTerpsAgentProgress();
  const now = lostTerpsAgentNow();
  const noProgressMs = lostTerpsAgentTelemetry.lastProgressAt ? Math.max(0, now - lostTerpsAgentTelemetry.lastProgressAt) : 0;
  const sinceActionMs = lostTerpsAgentTelemetry.lastActionAt ? Math.max(0, now - lostTerpsAgentTelemetry.lastActionAt) : 0;
  const actionPending = lostTerpsAgentTelemetry.lastActionAt > lostTerpsAgentTelemetry.lastProgressAt;
  return {
    errors: lostTerpsAgentTelemetry.errors.slice(),
    recentActions: lostTerpsAgentTelemetry.actions.slice(),
    noProgressMs: Math.round(noProgressMs),
    sinceActionMs: Math.round(sinceActionMs),
    stallSuspected: Boolean(actionPending && sinceActionMs >= LOST_TERPS_AGENT_STALL_MS && noProgressMs >= LOST_TERPS_AGENT_STALL_MS),
    stallThresholdMs: LOST_TERPS_AGENT_STALL_MS
  };
}
function lostTerpsAgentSnapshot() {
  const completed = Boolean(puzzle && found.size === puzzle.words.length);
  return {
    version: LOST_TERPS_AGENT_VERSION,
    ready: Boolean(data && puzzle),
    mission: puzzle ? {
      id: puzzle.id,
      title: puzzle.title,
      description: puzzle.description,
      size: puzzle.size,
      available: data.puzzles.map((item) => ({ id: item.id, title: item.title }))
    } : null,
    round: {
      attempts,
      hintsRemaining,
      hintsUsed,
      foundCount: found.size,
      totalWords: puzzle?.words?.length || 0,
      foundWords: [...found],
      selectedStart: start ? { row: start[0], col: start[1] } : null,
      completed,
      resetArmed: resetArmedUntil > Date.now(),
      pendingMissionId
    },
    visibleWords: puzzle ? puzzle.words.map((entry) => ({ word: entry.word, found: found.has(entry.word) })) : [],
    grid: lostTerpsVisibleGrid(),
    legalActions: completed
      ? ['again','select-mission']
      : ['select-cell','hint','reset','select-mission','clear-selection'],
    telemetry: lostTerpsAgentTelemetrySnapshot()
  };
}
function selectLostTerpsAgentCell(row, col) {
  const r=Number(row), c=Number(col);
  if (!Number.isInteger(r) || !Number.isInteger(c) || !puzzle || r < 0 || c < 0 || r >= puzzle.size || c >= puzzle.size) {
    throw new Error(`Unsupported Lost in the Terps cell: ${row},${col}`);
  }
  if (found.size === puzzle.words.length) return false;
  const button=gridEl.querySelector(cellSelector([r,c]));
  if (!button) return false;
  recordLostTerpsAgentAction('select-cell', { row:r, col:c });
  button.click();
  return true;
}
function selectLostTerpsAgentMission(id) {
  const normalized=String(id || '');
  if (!data?.puzzles?.some((item) => item.id === normalized)) throw new Error(`Unsupported Lost in the Terps mission: ${id}`);
  const button=missions.querySelector(`button[data-id="${normalized}"]`);
  if (!button) return false;
  recordLostTerpsAgentAction('select-mission', normalized);
  button.click();
  return true;
}
function installLostTerpsAgentTelemetry() {
  if (typeof window?.addEventListener !== 'function') return;
  window.addEventListener('error', (event) => {
    const target=event?.target;
    const resource=target && target !== window && (target.currentSrc || target.src || target.href);
    if (resource) recordLostTerpsAgentError('resource-error','Browser resource failed to load',resource);
    else recordLostTerpsAgentError('runtime-error',event?.message || event?.error?.message || 'Browser runtime error',event?.filename || null);
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    recordLostTerpsAgentError('unhandled-rejection',event?.reason?.message || event?.reason || 'Unhandled promise rejection');
  });
}
function installLostTerpsAgentBridge() {
  installLostTerpsAgentTelemetry();
  const api=Object.freeze({
    version: LOST_TERPS_AGENT_VERSION,
    snapshot: lostTerpsAgentSnapshot,
    selectCell: selectLostTerpsAgentCell,
    selectMission: selectLostTerpsAgentMission,
    hint: () => {
      if (!puzzle || hintsRemaining <= 0 || found.size === puzzle.words.length) return false;
      recordLostTerpsAgentAction('hint');
      hintButton.click();
      return true;
    },
    reset: () => {
      if (!puzzle || found.size === puzzle.words.length) return false;
      recordLostTerpsAgentAction('reset');
      resetButton.click();
      return true;
    },
    again: () => {
      if (!puzzle || found.size !== puzzle.words.length) return false;
      recordLostTerpsAgentAction('again');
      againButton.click();
      return true;
    },
    clearSelection: () => {
      if (!start) return false;
      recordLostTerpsAgentAction('clear-selection');
      clearStart();
      message.textContent='Selection cleared. Choose a starting letter.';
      return true;
    },
    telemetry: lostTerpsAgentTelemetrySnapshot
  });
  Object.defineProperty(window,'__LOST_TERPS_AGENT__',{value:api,enumerable:false,configurable:false,writable:false});
  Object.defineProperty(window,'__LOST_TERPS_GAME_STATE__',{get:lostTerpsAgentSnapshot,enumerable:false,configurable:false});
  document.documentElement.dataset.lostTerpsAgentBridge=LOST_TERPS_AGENT_VERSION;
  lostTerpsAgentTelemetry.lastProgressAt=lostTerpsAgentNow();
  return api;
}
installLostTerpsAgentBridge();
// END LOST IN THE TERPS AGENT BRIDGE

resetButton.addEventListener('click', requestReset);
againButton.addEventListener('click', () => select(puzzle.id));
hintButton.addEventListener('click', useHint);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && start) {
    clearStart();
    message.textContent = 'Selection cleared. Choose a starting letter.';
  }
  if ((event.key === 'h' || event.key === 'H') && !event.altKey && !event.ctrlKey && !event.metaKey && !event.target.closest?.('input,textarea,select')) {
    event.preventDefault();
    useHint();
  }
});

try {
  data = readEmbeddedData();
  renderMissions();
  const requested = new URLSearchParams(location.search).get('mission');
  select(data.puzzles.some((item) => item.id === requested) ? requested : data.puzzles[0].id);
} catch (error) {
  showLoadError(error instanceof Error ? error : new Error(String(error)));
}
