const WHEEL_CODE_LENGTH = 6;
const WHEEL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_HISTORY = 12;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function normalizeWheelCode(value) {
  const allowed = new Set(WHEEL_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, WHEEL_CODE_LENGTH);
}

function isValidWheelCode(value) {
  return normalizeWheelCode(value).length === WHEEL_CODE_LENGTH;
}

function entriesForMode(data, modeId) {
  return data.entries.filter((entry) => entry.mode === modeId);
}

function requireMode(data, modeId) {
  const mode = data.modes.find((candidate) => candidate.id === modeId);
  if (!mode) throw new Error(`Unknown wheel mode: ${modeId}`);
  const entries = entriesForMode(data, modeId);
  if (entries.length < 2) throw new Error(`Wheel mode ${modeId} needs at least two entries.`);
  return { mode, entries };
}

function createWheel({ code, mode = 'strain-picker' } = {}, data) {
  if (!data?.modes?.length || !data?.entries?.length) throw new Error('Spin the Strain data is required.');
  const normalized = normalizeWheelCode(code);
  if (!isValidWheelCode(normalized)) throw new Error('A six-character wheel code is required.');
  requireMode(data, mode);
  return {
    schemaVersion: 1,
    code: normalized,
    mode,
    spinCount: 0,
    lastEntryId: null,
    lastResult: null,
    history: []
  };
}

function spinWheel(inputState, data) {
  const state = clone(inputState);
  const { entries } = requireMode(data, state.mode);
  const spinNumber = state.spinCount + 1;
  let index = hash(`${state.code}:${state.mode}:${spinNumber}`) % entries.length;
  if (entries.length > 1 && entries[index].id === state.lastEntryId) index = (index + 1) % entries.length;
  const entry = entries[index];
  const result = {
    spinNumber,
    index,
    entryId: entry.id,
    label: entry.label,
    detail: entry.detail,
    category: entry.category
  };
  state.spinCount = spinNumber;
  state.lastEntryId = entry.id;
  state.lastResult = result;
  state.history.push(result);
  if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-MAX_HISTORY);
  return state;
}

const ui = {
  load: document.querySelector('#load-status'),
  modes: document.querySelector('#mode-tabs'),
  title: document.querySelector('#mode-title'),
  description: document.querySelector('#mode-description'),
  code: document.querySelector('#wheel-code'),
  random: document.querySelector('#new-code'),
  share: document.querySelector('#share-wheel'),
  spin: document.querySelector('#spin'),
  wheel: document.querySelector('#wheel'),
  wheelStage: document.querySelector('#wheel-stage'),
  result: document.querySelector('#result-card'),
  category: document.querySelector('#result-category'),
  label: document.querySelector('#result-label'),
  detail: document.querySelector('#result-detail'),
  count: document.querySelector('#spin-count'),
  history: document.querySelector('#history'),
  announce: document.querySelector('#announce')
};

let data = null;
let state = null;
let spinning = false;
let revealTimer = null;

function readEmbeddedData() {
  const node = document.querySelector('#spin-the-strain-data');
  if (!node) throw new Error('Embedded wheel data is missing.');
  const parsed = JSON.parse(node.textContent || '{}');
  validateData(parsed);
  return parsed;
}

function validateData(candidate) {
  if (candidate?.schemaVersion !== 1) throw new Error('wheel data contract mismatch');
  if (!Array.isArray(candidate.modes) || candidate.modes.length !== 3) throw new Error('expected three wheel modes');
  if (!Array.isArray(candidate.entries) || candidate.entries.length !== 54) throw new Error('expected 54 wheel entries');

  const modeIds = new Set();
  for (const mode of candidate.modes) {
    if (!mode?.id || !mode?.title || !mode?.description) throw new Error('a wheel mode is incomplete');
    if (modeIds.has(mode.id)) throw new Error(`duplicate wheel mode: ${mode.id}`);
    modeIds.add(mode.id);
  }

  const entryIds = new Set();
  for (const entry of candidate.entries) {
    if (!entry?.id || !entry?.mode || !entry?.label || !entry?.detail || !entry?.category) throw new Error('a wheel entry is incomplete');
    if (entryIds.has(entry.id)) throw new Error(`duplicate wheel entry: ${entry.id}`);
    if (!modeIds.has(entry.mode)) throw new Error(`${entry.id} references unknown mode ${entry.mode}`);
    entryIds.add(entry.id);
  }

  for (const mode of candidate.modes) {
    if (entriesForMode(candidate, mode.id).length !== 18) throw new Error(`${mode.title} must contain exactly 18 equal-weight entries`);
  }
}

function randomCode() {
  const values = new Uint32Array(WHEEL_CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * 0xffffffff);
    }
  }
  return [...values].map((number) => WHEEL_ALPHABET[number % WHEEL_ALPHABET.length]).join('');
}

function currentMode() {
  return data.modes.find((mode) => mode.id === state?.mode) || data.modes[0];
}

function setCode(value) {
  ui.code.value = normalizeWheelCode(value);
  ui.code.setAttribute('aria-invalid', String(ui.code.value.length > 0 && !isValidWheelCode(ui.code.value)));
}

function challengeUrl() {
  const params = new URLSearchParams({ mode: state.mode, wheel: state.code });
  return `${location.origin}${location.pathname}?${params}`;
}

function safeReplaceUrl() {
  try { history.replaceState(null, '', challengeUrl()); } catch {}
}

function prefersReducedMotion() {
  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }
  catch { return false; }
}

function wheelGradient(count) {
  const colors = ['var(--seg-a)','var(--seg-b)','var(--seg-c)','var(--seg-d)','var(--seg-e)','var(--seg-f)'];
  const size = 100 / count;
  const stops = [];
  for (let index = 0; index < count; index += 1) {
    const start = (index * size).toFixed(4);
    const end = ((index + 1) * size).toFixed(4);
    stops.push(`${colors[index % colors.length]} ${start}% ${end}%`);
  }
  return `conic-gradient(${stops.join(',')})`;
}

function renderWheel() {
  const entries = entriesForMode(data, state.mode);
  const segmentAngle = 360 / entries.length;
  ui.wheel.replaceChildren();
  ui.wheel.style.background = wheelGradient(entries.length);
  entries.forEach((entry, index) => {
    const label = document.createElement('span');
    label.className = 'segment-label';
    label.style.setProperty('--segment-angle', `${(index + 0.5) * segmentAngle}deg`);
    label.textContent = entry.label;
    label.title = entry.label;
    ui.wheel.append(label);
  });
  const offset = state.lastResult ? 360 - (state.lastResult.index + 0.5) * segmentAngle : 0;
  ui.wheel.style.transform = `rotate(${state.spinCount * 1080 + offset}deg)`;
}

function renderModes() {
  ui.modes.replaceChildren();
  for (const mode of data.modes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode-tab';
    button.dataset.mode = mode.id;
    button.setAttribute('aria-pressed', String(mode.id === state.mode));
    button.textContent = mode.title;
    button.disabled = spinning;
    ui.modes.append(button);
  }
}

function renderHistory() {
  ui.history.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Spin results will appear here.';
    ui.history.append(empty);
    return;
  }
  for (const result of [...state.history].reverse()) {
    const item = document.createElement('li');
    const count = document.createElement('span');
    count.textContent = `#${result.spinNumber}`;
    const copy = document.createElement('div');
    const label = document.createElement('strong');
    const category = document.createElement('small');
    label.textContent = result.label;
    category.textContent = result.category;
    copy.append(label, category);
    item.append(count, copy);
    ui.history.append(item);
  }
}

function renderResult() {
  ui.count.textContent = String(state.spinCount);
  if (spinning) {
    ui.result.classList.remove('revealed');
    ui.category.textContent = 'SPINNING';
    ui.label.textContent = 'Wheel in motion';
    ui.detail.textContent = 'The result will reveal when the wheel stops.';
    return;
  }
  if (!state.lastResult) {
    ui.result.classList.remove('revealed');
    ui.category.textContent = 'READY';
    ui.label.textContent = 'Spin the wheel';
    ui.detail.textContent = 'Every entry in this mode has equal weight.';
    return;
  }
  ui.result.classList.add('revealed');
  ui.category.textContent = state.lastResult.category;
  ui.label.textContent = state.lastResult.label;
  ui.detail.textContent = state.lastResult.detail;
}

function render() {
  const mode = currentMode();
  ui.title.textContent = mode.title;
  ui.description.textContent = mode.description;
  ui.spin.disabled = spinning;
  ui.random.disabled = spinning;
  ui.code.disabled = spinning;
  ui.share.disabled = spinning;
  renderModes();
  renderWheel();
  renderResult();
  renderHistory();
}

function resetWheel(code, mode) {
  window.clearTimeout(revealTimer);
  revealTimer = null;
  spinning = false;
  state = createWheel({ code, mode }, data);
  ui.wheelStage.setAttribute('aria-busy', 'false');
  setCode(state.code);
  safeReplaceUrl();
  render();
}

function finishSpin() {
  if (!state?.lastResult) return;
  spinning = false;
  revealTimer = null;
  ui.wheelStage.setAttribute('aria-busy', 'false');
  render();
  const result = state.lastResult;
  ui.announce.textContent = `Spin ${result.spinNumber}: ${result.label}. ${result.detail}`;
}

function startSpin() {
  if (spinning || !state) return;
  spinning = true;
  state = spinWheel(state, data);
  safeReplaceUrl();
  ui.wheelStage.setAttribute('aria-busy', 'true');
  render();
  revealTimer = window.setTimeout(finishSpin, prefersReducedMotion() ? 0 : 1650);
}

ui.modes.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (!button || spinning || button.dataset.mode === state.mode) return;
  resetWheel(state.code, button.dataset.mode);
  ui.announce.textContent = `${currentMode().title} selected. Spin history reset.`;
});
ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || spinning) return;
  if (!isValidWheelCode(ui.code.value)) {
    ui.code.setAttribute('aria-invalid', 'true');
    ui.announce.textContent = 'Enter a complete six-character wheel code.';
    return;
  }
  resetWheel(ui.code.value, state.mode);
  ui.announce.textContent = `Wheel ${state.code} loaded.`;
});
ui.random.addEventListener('click', () => {
  resetWheel(randomCode(), state.mode);
  ui.announce.textContent = `New wheel code ${state.code}.`;
});
ui.spin.addEventListener('click', startSpin);
ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `Spin the Strain · ${currentMode().title} · wheel ${state.code}\n${url}`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Wheel challenge copied.';
  } catch {
    ui.announce.textContent = `Share wheel ${state.code}: ${url}`;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !spinning) return;
  window.clearTimeout(revealTimer);
  finishSpin();
});

function load() {
  try {
    data = readEmbeddedData();
    const params = new URLSearchParams(location.search);
    const requestedMode = params.get('mode');
    const mode = data.modes.some((candidate) => candidate.id === requestedMode) ? requestedMode : data.modes[0].id;
    const requestedCode = normalizeWheelCode(params.get('wheel'));
    const code = isValidWheelCode(requestedCode) ? requestedCode : randomCode();
    state = createWheel({ code, mode }, data);
    setCode(code);
    safeReplaceUrl();
    ui.load.textContent = '3 equal-weight wheels · 54 prompts · deterministic share codes';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = `Spin the Strain could not load its wheel data. ${error instanceof Error ? error.message : String(error)}`;
    ui.spin.disabled = true;
  }
}

load();
