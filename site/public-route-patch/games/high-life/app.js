import { ACTIONS, ERA_LENGTH, MAX_TURNS, calculateLegacyScore, createGame, currentEra, legalActions, takeTurn } from './engine.mjs';

const SAVE_KEY = 'dtf-high-life-save-v1';
const eraLabels = { underground: 'Underground Era', medical: 'Medical Era', legal: 'Legal Era' };
const resourceLabels = {
  reputation: 'Reputation', cash: 'Cash', knowledge: 'Knowledge', assets: 'Assets',
  compliance: 'Compliance', brand: 'Brand', operations: 'Operations', genetics: 'Genetics'
};

let events = [];
let state = null;

const ui = {
  load: document.querySelector('#load-status'), setup: document.querySelector('#setup-panel'), game: document.querySelector('#game-panel'),
  results: document.querySelector('#results-panel'), name: document.querySelector('#player-name'), seed: document.querySelector('#seed'),
  start: document.querySelector('#start-game'), resume: document.querySelector('#resume-game'), discard: document.querySelector('#discard-save'),
  saveStatus: document.querySelector('#save-status'), eraName: document.querySelector('#era-name'), turn: document.querySelector('#turn-label'),
  progress: document.querySelector('#era-progress'), resources: document.querySelector('#resource-grid'), score: document.querySelector('#score-preview'),
  actions: document.querySelector('#action-grid'), eventPanel: document.querySelector('#event-panel'), eventTitle: document.querySelector('#event-title'),
  eventText: document.querySelector('#event-text'), mitigation: document.querySelector('#event-mitigation'), delta: document.querySelector('#turn-delta'),
  transition: document.querySelector('#transition-note'), continue: document.querySelector('#continue-button'), finalScore: document.querySelector('#final-score'),
  resultTitle: document.querySelector('#result-title'), resultSummary: document.querySelector('#result-summary'), finalResources: document.querySelector('#final-resources'),
  again: document.querySelector('#play-again')
};

function resourceCards(resources, target) {
  target.replaceChildren();
  for (const [key, value] of Object.entries(resources)) {
    const card = document.createElement('div');
    card.className = 'resource';
    card.innerHTML = `<span>${resourceLabels[key] || key}</span><strong>${value}</strong>`;
    target.append(card);
  }
}

function formatDelta(delta) {
  return Object.entries(delta).map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${resourceLabels[key] || key}`);
}

function readSave() {
  try {
    const payload = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    const saved = payload?.state;
    if (!saved || payload.version !== 1 || saved.complete || !Number.isInteger(saved.turn) || saved.turn < 0 || saved.turn >= MAX_TURNS || !saved.resources) return null;
    return payload;
  } catch {
    return null;
  }
}

function refreshSaveControls() {
  const payload = readSave();
  const hasSave = Boolean(payload);
  ui.resume.hidden = !hasSave;
  ui.discard.hidden = !hasSave;
  ui.saveStatus.hidden = !hasSave;
  if (!hasSave) return;
  const saved = payload.state;
  const era = eraLabels[currentEra(saved)] || 'Career';
  ui.saveStatus.textContent = `Saved career: ${saved.playerName || 'Grower'} · ${era} · turn ${Math.min(saved.turn + 1, MAX_TURNS)} of ${MAX_TURNS}.`;
}

function saveGame() {
  if (!state || state.complete) {
    localStorage.removeItem(SAVE_KEY);
    refreshSaveControls();
    return;
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), state }));
  } catch (error) {
    console.warn('High Life autosave unavailable.', error);
  }
}

function render() {
  const era = currentEra(state);
  ui.eraName.textContent = eraLabels[era];
  ui.turn.textContent = `Turn ${state.turn + 1} of ${MAX_TURNS} · Era turn ${state.eraTurn + 1} of ${ERA_LENGTH}`;
  ui.progress.value = state.eraTurn;
  ui.score.textContent = calculateLegacyScore(state);
  resourceCards(state.resources, ui.resources);

  ui.actions.replaceChildren();
  for (const action of legalActions(state)) {
    const button = document.createElement('button');
    button.className = 'action-card';
    button.disabled = !action.allowed;
    const cost = formatDelta(Object.fromEntries(Object.entries(action.cost || {}).map(([key, value]) => [key, -value]))).join(' · ') || 'No resource cost';
    const gain = formatDelta(action.effects || {}).join(' · ');
    button.innerHTML = `<strong>${action.label}</strong><span>${action.description}</span><small>${cost} → ${gain}</small>${action.reason ? `<em>${action.reason}</em>` : ''}`;
    if (action.allowed) button.addEventListener('click', () => resolveTurn(action.id));
    ui.actions.append(button);
  }
}

function resolveTurn(actionId) {
  state = takeTurn(state, actionId, events);
  saveGame();
  const record = state.history.at(-1);
  ui.eventTitle.textContent = record.event.title;
  ui.eventText.textContent = record.event.text;
  ui.mitigation.textContent = record.event.mitigation || '';
  const combined = {};
  for (const source of [record.action.resourceChange, record.event.resourceChange]) {
    for (const [key, value] of Object.entries(source)) combined[key] = (combined[key] || 0) + value;
  }
  ui.delta.replaceChildren(...formatDelta(combined).map((text) => {
    const span = document.createElement('span'); span.textContent = text; return span;
  }));

  if (record.transition) {
    const t = record.transition;
    ui.transition.hidden = false;
    ui.transition.textContent = `Era transition: ${t.met}/${t.total} preparation gates met. ${formatDelta(t.bonus).join(' · ') || 'No transition modifier.'}`;
  } else ui.transition.hidden = true;

  ui.eventPanel.hidden = false;
  document.querySelectorAll('.action-card').forEach((button) => { button.disabled = true; });
  ui.continue.textContent = state.complete ? 'See Legacy score' : 'Continue';
  ui.eventPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function continueGame() {
  ui.eventPanel.hidden = true;
  if (state.complete) return showResults();
  saveGame();
  render();
  document.querySelector('#choices-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showResults() {
  localStorage.removeItem(SAVE_KEY);
  refreshSaveControls();
  ui.game.hidden = true;
  ui.results.hidden = false;
  ui.resultTitle.textContent = `${state.playerName}'s Legacy`;
  ui.finalScore.textContent = `${state.finalScore} points`;
  const strong = Object.entries(state.resources).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => resourceLabels[key]).join(', ');
  ui.resultSummary.textContent = `Completed all three eras in ${state.turn} turns. Strongest final areas: ${strong}. Replay the same seed with different choices to compare paths under the same event stream.`;
  resourceCards(state.resources, ui.finalResources);
  ui.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function enterGame(nextState) {
  state = nextState;
  ui.setup.hidden = true;
  ui.results.hidden = true;
  ui.game.hidden = false;
  ui.eventPanel.hidden = true;
  render();
  saveGame();
}

function startGame() {
  const seed = Number.parseInt(ui.seed.value, 10) || 1;
  enterGame(createGame({ seed, playerName: ui.name.value }));
}

function resumeGame() {
  const payload = readSave();
  if (!payload) return refreshSaveControls();
  enterGame(payload.state);
  document.querySelector('#choices-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function discardSave() {
  localStorage.removeItem(SAVE_KEY);
  refreshSaveControls();
}

async function load() {
  try {
    const response = await fetch('./data/events.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`events HTTP ${response.status}`);
    events = await response.json();
    if (!Array.isArray(events) || events.length !== 18) throw new Error('event data is incomplete');
    ui.load.textContent = 'Prototype data ready · 18 era events · deterministic engine · autosave enabled';
    ui.setup.hidden = false;
    refreshSaveControls();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'High Life prototype data could not be loaded.';
  }
}

ui.start.addEventListener('click', startGame);
ui.resume.addEventListener('click', resumeGame);
ui.discard.addEventListener('click', discardSave);
ui.continue.addEventListener('click', continueGame);
ui.again.addEventListener('click', () => { ui.results.hidden = true; ui.setup.hidden = false; refreshSaveControls(); });
load();
