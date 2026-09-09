import {
  ERA_LENGTH,
  ERA_IDS,
  MAX_TURNS,
  calculateLegacyScore,
  createGame,
  currentEra,
  legalActions,
  takeTurn
} from './engine.mjs';

const SAVE_KEY = 'dtf-high-life-save-v1';
const SAVE_VERSION = 3;
const eraLabels = {
  underground: 'Underground Era',
  medical: 'Medical Era',
  legal: 'Legal Era'
};
const resourceLabels = {
  reputation: 'Reputation',
  cash: 'Cash',
  knowledge: 'Knowledge',
  assets: 'Assets',
  compliance: 'Compliance',
  brand: 'Brand',
  operations: 'Operations',
  genetics: 'Genetics'
};

let events = [];
let state = null;
let startArmed = false;
let discardArmed = false;
let armTimer = null;

const ui = {
  load: document.querySelector('#load-status'),
  setup: document.querySelector('#setup-panel'),
  game: document.querySelector('#game-panel'),
  results: document.querySelector('#results-panel'),
  name: document.querySelector('#player-name'),
  seed: document.querySelector('#seed'),
  start: document.querySelector('#start-game'),
  resume: document.querySelector('#resume-game'),
  discard: document.querySelector('#discard-save'),
  saveStatus: document.querySelector('#save-status'),
  eraName: document.querySelector('#era-name'),
  turn: document.querySelector('#turn-label'),
  progress: document.querySelector('#era-progress'),
  resources: document.querySelector('#resource-grid'),
  score: document.querySelector('#score-preview'),
  actions: document.querySelector('#action-grid'),
  eventPanel: document.querySelector('#event-panel'),
  eventTitle: document.querySelector('#event-title'),
  eventText: document.querySelector('#event-text'),
  mitigation: document.querySelector('#event-mitigation'),
  delta: document.querySelector('#turn-delta'),
  transition: document.querySelector('#transition-note'),
  continue: document.querySelector('#continue-button'),
  finalScore: document.querySelector('#final-score'),
  resultTitle: document.querySelector('#result-title'),
  resultSummary: document.querySelector('#result-summary'),
  finalResources: document.querySelector('#final-resources'),
  again: document.querySelector('#play-again'),
  announce: document.querySelector('#announce')
};

function storageGet(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

function storageSet(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('High Life autosave unavailable.', error);
    return false;
  }
}

function storageRemove(key) {
  try {
    globalThis.localStorage?.removeItem(key);
    return true;
  } catch (error) {
    console.warn('High Life save cleanup unavailable.', error);
    return false;
  }
}

function safeScroll(element, block = 'start') {
  try {
    const reduced = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    element?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block });
  } catch {
    element?.scrollIntoView?.();
  }
}

function validateEvents(sourceEvents) {
  if (!Array.isArray(sourceEvents) || sourceEvents.length !== 18) {
    throw new Error('High Life event data is incomplete.');
  }
  if (new Set(sourceEvents.map((event) => event.id)).size !== sourceEvents.length) {
    throw new Error('High Life event IDs must be unique.');
  }
  for (const era of ERA_IDS) {
    if (sourceEvents.filter((event) => event.era === era).length !== ERA_LENGTH) {
      throw new Error(`High Life ${era} era must have ${ERA_LENGTH} events.`);
    }
  }
}

function isRecoverableState(saved) {
  if (!saved || !Number.isInteger(saved.turn) || saved.turn < 0 || saved.turn > MAX_TURNS) return false;
  if (!saved.resources || typeof saved.resources !== 'object') return false;
  if (!Array.isArray(saved.history) || !Array.isArray(saved.milestones)) return false;
  if (saved.complete === true) return saved.turn === MAX_TURNS && Number.isFinite(saved.finalScore);
  return saved.turn < MAX_TURNS;
}

function readSave() {
  try {
    const payload = JSON.parse(storageGet(SAVE_KEY) || 'null');
    if (!payload || ![1, 2, 3].includes(payload.version) || !isRecoverableState(payload.state)) return null;
    return {
      version: payload.version,
      savedAt: payload.savedAt,
      pendingEvent: payload.version >= 2 && payload.pendingEvent === true,
      state: payload.state
    };
  } catch {
    return null;
  }
}

function saveGame({ pendingEvent = false } = {}) {
  if (!state) {
    storageRemove(SAVE_KEY);
    refreshSaveControls();
    return;
  }
  storageSet(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    savedAt: Date.now(),
    pendingEvent: Boolean(pendingEvent),
    state
  }));
}

function formatDelta(delta = {}) {
  return Object.entries(delta).map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${resourceLabels[key] || key}`);
}

function resourceCards(resources, target) {
  target.replaceChildren();
  for (const [key, value] of Object.entries(resources)) {
    const card = document.createElement('div');
    const level = Math.max(0, Math.min(100, Math.round((Number(value) / 12) * 100)));
    card.className = `resource${value <= 2 ? ' low' : value >= 8 ? ' strong' : ''}`;
    const label = document.createElement('span');
    label.textContent = resourceLabels[key] || key;
    const amount = document.createElement('strong');
    amount.textContent = String(value);
    const meter = document.createElement('div');
    meter.className = 'resource-meter';
    meter.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('i');
    fill.style.width = `${level}%`;
    meter.append(fill);
    card.append(label, amount, meter);
    target.append(card);
  }
}

function disarmSaveButtons() {
  startArmed = false;
  discardArmed = false;
  window.clearTimeout(armTimer);
  armTimer = null;
  ui.start.classList.remove('danger-arm');
  ui.discard.classList.remove('danger-arm');
  ui.start.textContent = 'Begin Underground Era';
  ui.discard.textContent = 'Discard save';
}

function refreshSaveControls() {
  const payload = readSave();
  const hasSave = Boolean(payload);
  ui.resume.hidden = !hasSave;
  ui.discard.hidden = !hasSave;
  ui.saveStatus.hidden = !hasSave;
  if (!hasSave) {
    disarmSaveButtons();
    return;
  }
  const saved = payload.state;
  const phase = payload.pendingEvent ? ' · event result pending' : '';
  if (saved.complete) {
    ui.saveStatus.textContent = `Completed career ready to review: ${saved.playerName || 'Grower'} · ${saved.finalScore} Legacy points${phase}.`;
    return;
  }
  ui.saveStatus.textContent = `Saved career: ${saved.playerName || 'Grower'} · ${eraLabels[currentEra(saved)] || 'Career'} · turn ${Math.min(saved.turn + 1, MAX_TURNS)} of ${MAX_TURNS}${phase}.`;
}

function updateEraRoadmap() {
  const era = currentEra(state);
  document.querySelectorAll('.era-roadmap [data-era]').forEach((node) => {
    const index = ERA_IDS.indexOf(node.dataset.era);
    node.classList.toggle('current', node.dataset.era === era && !state.complete);
    node.classList.toggle('complete', state.complete || index < state.eraIndex);
  });
}

function render() {
  const era = currentEra(state);
  ui.eraName.textContent = eraLabels[era];
  ui.turn.textContent = state.complete
    ? `Career complete · ${MAX_TURNS} of ${MAX_TURNS} turns`
    : `Turn ${state.turn + 1} of ${MAX_TURNS} · Era turn ${state.eraTurn + 1} of ${ERA_LENGTH}`;
  ui.progress.value = state.complete ? ERA_LENGTH : state.eraTurn;
  ui.score.textContent = String(calculateLegacyScore(state));
  resourceCards(state.resources, ui.resources);
  updateEraRoadmap();

  ui.actions.replaceChildren();
  for (const action of legalActions(state)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `action-card${action.allowed ? ' available' : ' locked'}`;
    button.disabled = !action.allowed;

    const status = document.createElement('span');
    status.className = 'action-state';
    status.textContent = action.allowed ? 'AVAILABLE' : 'LOCKED';
    const title = document.createElement('strong');
    title.textContent = action.label;
    const description = document.createElement('span');
    description.textContent = action.description;
    const economy = document.createElement('div');
    economy.className = 'action-economy';
    const cost = document.createElement('small');
    cost.className = 'cost';
    const costs = Object.fromEntries(Object.entries(action.cost || {}).map(([key, value]) => [key, -value]));
    cost.textContent = formatDelta(costs).join(' · ') || 'No resource cost';
    const arrow = document.createElement('b');
    arrow.textContent = '→';
    const gain = document.createElement('small');
    gain.className = 'gain';
    gain.textContent = formatDelta(action.effects || {}).join(' · ');
    economy.append(cost, arrow, gain);
    button.append(status, title, description, economy);
    if (action.reason) {
      const reason = document.createElement('em');
      reason.textContent = action.reason;
      button.append(reason);
    }
    if (action.allowed) button.addEventListener('click', () => resolveTurn(action.id), { once: true });
    ui.actions.append(button);
  }
}

function renderTurnResolution(record) {
  ui.eventTitle.textContent = record.event.title;
  ui.eventText.textContent = record.event.text;
  ui.mitigation.textContent = record.event.mitigation || '';
  const combined = {};
  for (const source of [record.action.resourceChange, record.event.resourceChange]) {
    for (const [key, value] of Object.entries(source)) combined[key] = (combined[key] || 0) + value;
  }
  ui.delta.replaceChildren(...formatDelta(combined).map((text) => {
    const span = document.createElement('span');
    const value = Number.parseInt(text, 10);
    span.className = value > 0 ? 'positive' : value < 0 ? 'negative' : '';
    span.textContent = text;
    return span;
  }));
  if (record.transition) {
    const transition = record.transition;
    ui.transition.hidden = false;
    ui.transition.textContent = `Era transition: ${transition.met}/${transition.total} preparation gates met. ${formatDelta(transition.bonus).join(' · ') || 'No transition modifier.'}`;
  } else {
    ui.transition.hidden = true;
    ui.transition.textContent = '';
  }
  ui.eventPanel.hidden = false;
  document.querySelectorAll('.action-card').forEach((button) => { button.disabled = true; });
  ui.continue.textContent = state.complete ? 'See Legacy score' : 'Continue';
  safeScroll(ui.eventPanel, 'nearest');
}

function resolveTurn(actionId) {
  try {
    state = takeTurn(state, actionId, events);
    saveGame({ pendingEvent: true });
    render();
    const record = state.history.at(-1);
    renderTurnResolution(record);
    ui.announce.textContent = `${record.action.label} resolved. Event: ${record.event.title}.${record.transition ? ' Era transition reached.' : ''}`;
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
  }
}

function showResults() {
  storageRemove(SAVE_KEY);
  refreshSaveControls();
  ui.game.hidden = true;
  ui.results.hidden = false;
  ui.resultTitle.textContent = `${state.playerName}'s Legacy`;
  ui.finalScore.textContent = `${state.finalScore} points`;
  const strong = Object.entries(state.resources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => resourceLabels[key])
    .join(', ');
  ui.resultSummary.textContent = `Completed all three eras in ${state.turn} turns. Strongest final areas: ${strong}. Replay the same seed with different choices to compare paths under the same event stream.`;
  resourceCards(state.resources, ui.finalResources);
  safeScroll(ui.results);
}

function continueGame() {
  ui.eventPanel.hidden = true;
  if (state.complete) {
    showResults();
    return;
  }
  saveGame({ pendingEvent: false });
  render();
  safeScroll(document.querySelector('#choices-title'));
}

function enterGame(nextState, { pendingEvent = false } = {}) {
  state = nextState;
  ui.setup.hidden = true;
  ui.results.hidden = true;
  ui.game.hidden = false;
  ui.eventPanel.hidden = true;
  render();
  saveGame({ pendingEvent });
  if (pendingEvent && state.history.length) renderTurnResolution(state.history.at(-1));
}

function beginNewCareer() {
  const existing = readSave();
  if (existing && !startArmed) {
    startArmed = true;
    discardArmed = false;
    ui.start.classList.add('danger-arm');
    ui.start.textContent = 'Confirm New Career';
    ui.discard.classList.remove('danger-arm');
    ui.discard.textContent = 'Discard save';
    window.clearTimeout(armTimer);
    armTimer = window.setTimeout(disarmSaveButtons, 4500);
    ui.announce.textContent = 'A saved career exists. Press Confirm New Career to replace it.';
    return;
  }
  const seed = Number.parseInt(ui.seed.value, 10) || 1;
  disarmSaveButtons();
  enterGame(createGame({ seed, playerName: ui.name.value }), { pendingEvent: false });
  ui.announce.textContent = `Career started for ${state.playerName}. Underground Era, turn 1.`;
}

function resumeGame() {
  const payload = readSave();
  if (!payload) {
    refreshSaveControls();
    return;
  }
  disarmSaveButtons();
  if (payload.state.complete && !payload.pendingEvent) {
    state = payload.state;
    ui.setup.hidden = true;
    ui.game.hidden = true;
    ui.eventPanel.hidden = true;
    showResults();
    return;
  }
  enterGame(payload.state, { pendingEvent: payload.pendingEvent });
  if (!payload.pendingEvent) safeScroll(document.querySelector('#choices-title'));
  ui.announce.textContent = payload.pendingEvent
    ? `Saved ${payload.state.history.at(-1)?.event?.title ?? 'turn result'} restored.`
    : `Saved career resumed at turn ${payload.state.turn + 1}.`;
}

function discardSave() {
  if (!discardArmed) {
    discardArmed = true;
    startArmed = false;
    ui.discard.classList.add('danger-arm');
    ui.discard.textContent = 'Confirm Discard';
    ui.start.classList.remove('danger-arm');
    ui.start.textContent = 'Begin Underground Era';
    window.clearTimeout(armTimer);
    armTimer = window.setTimeout(disarmSaveButtons, 4500);
    ui.announce.textContent = 'Press Confirm Discard to permanently remove the saved career.';
    return;
  }
  storageRemove(SAVE_KEY);
  disarmSaveButtons();
  refreshSaveControls();
  ui.announce.textContent = 'Saved career discarded.';
}

function load() {
  try {
    const embedded = document.querySelector('#high-life-events');
    if (!embedded?.textContent) throw new Error('Embedded High Life events are missing.');
    events = JSON.parse(embedded.textContent);
    validateEvents(events);
    ui.load.textContent = 'Ready · canonical engine · 18 seeded events · 3 eras · exact autosave resume';
    ui.setup.hidden = false;
    refreshSaveControls();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'High Life could not initialize.';
  }
}

ui.start.addEventListener('click', beginNewCareer);
ui.resume.addEventListener('click', resumeGame);
ui.discard.addEventListener('click', discardSave);
ui.continue.addEventListener('click', continueGame);
ui.again.addEventListener('click', () => {
  state = null;
  ui.results.hidden = true;
  ui.setup.hidden = false;
  refreshSaveControls();
  safeScroll(ui.setup);
});
window.addEventListener('pagehide', () => window.clearTimeout(armTimer));
load();