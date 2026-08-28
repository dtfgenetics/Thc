import {
  WHEEL_ALPHABET,
  createWheel,
  entriesForMode,
  isValidWheelCode,
  normalizeWheelCode,
  spinWheel
} from './engine.mjs';

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

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
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

function wheelGradient(count) {
  const colors = ['var(--seg-a)','var(--seg-b)','var(--seg-c)','var(--seg-d)','var(--seg-e)','var(--seg-f)'];
  const size = 100 / count;
  const stops = [];
  for (let index = 0; index < count; index += 1) {
    const start = (index * size).toFixed(4);
    const end = ((index + 1) * size).toFixed(4);
    stops.push(`${colors[index % colors.length]} ${start}% ${end}%`);
  }
  return `conic-gradient(from -90deg, ${stops.join(',')})`;
}

function renderWheel() {
  const entries = entriesForMode(data, state.mode);
  ui.wheel.replaceChildren();
  ui.wheel.style.background = wheelGradient(entries.length);
  ui.wheel.style.setProperty('--segment-count', String(entries.length));
  entries.forEach((entry, index) => {
    const label = document.createElement('span');
    label.className = 'segment-label';
    label.style.setProperty('--segment-index', String(index));
    label.textContent = entry.label;
    label.title = entry.label;
    ui.wheel.append(label);
  });
  const offset = state.lastResult
    ? 360 - (state.lastResult.index + 0.5) * (360 / entries.length)
    : 0;
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
    item.innerHTML = `<span>#${result.spinNumber}</span><div><strong>${escapeHtml(result.label)}</strong><small>${escapeHtml(result.category)}</small></div>`;
    ui.history.append(item);
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function renderResult() {
  ui.count.textContent = String(state.spinCount);
  if (!state.lastResult) {
    ui.result.classList.remove('revealed');
    ui.category.textContent = 'READY';
    ui.label.textContent = 'Spin the wheel';
    ui.detail.textContent = 'Every entry in this mode has equal weight.';
    return;
  }
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
  clearTimeout(revealTimer);
  spinning = false;
  state = createWheel({ code, mode }, data);
  setCode(state.code);
  history.replaceState(null, '', challengeUrl());
  render();
}

function startSpin() {
  if (spinning || !state) return;
  spinning = true;
  ui.result.classList.remove('revealed');
  state = spinWheel(state, data);
  history.replaceState(null, '', challengeUrl());
  render();
  ui.wheelStage.setAttribute('aria-busy', 'true');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  revealTimer = setTimeout(() => {
    spinning = false;
    ui.wheelStage.setAttribute('aria-busy', 'false');
    ui.result.classList.add('revealed');
    render();
    const result = state.lastResult;
    ui.announce.textContent = `Spin ${result.spinNumber}: ${result.label}. ${result.detail}`;
  }, reduced ? 0 : 1650);
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
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Wheel challenge copied.';
  } catch {
    ui.announce.textContent = `Share wheel ${state.code}: ${url}`;
  }
});

async function load() {
  try {
    const response = await fetch('./data/wheels.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`wheel data HTTP ${response.status}`);
    data = await response.json();
    if (data.schemaVersion !== 1 || data.modes?.length !== 3 || data.entries?.length !== 54) throw new Error('wheel data contract mismatch');
    const params = new URLSearchParams(location.search);
    const requestedMode = params.get('mode');
    const mode = data.modes.some((candidate) => candidate.id === requestedMode) ? requestedMode : data.modes[0].id;
    const requestedCode = normalizeWheelCode(params.get('wheel'));
    const code = isValidWheelCode(requestedCode) ? requestedCode : randomCode();
    state = createWheel({ code, mode }, data);
    setCode(code);
    ui.load.textContent = '3 equal-weight wheels · 54 prompts · deterministic share codes';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Spin the Strain could not load its wheel data.';
    ui.spin.disabled = true;
  }
}

load();
