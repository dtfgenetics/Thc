const ERA_LENGTH = 6;
const ERA_IDS = ['underground', 'medical', 'legal'];
const MAX_TURNS = ERA_LENGTH * ERA_IDS.length;
const SAVE_KEY = 'dtf-high-life-save-v1';
const SAVE_VERSION = 2;

const ACTIONS = {
  learn: { id: 'learn', label: 'Study the Craft', description: 'Trade time and a little cash for durable knowledge.', cost: { cash: 1 }, effects: { knowledge: 2 } },
  network: { id: 'network', label: 'Build the Network', description: 'Strengthen relationships and reputation.', cost: {}, effects: { reputation: 2 } },
  genetics: { id: 'genetics', label: 'Work the Genetics', description: 'Invest in selection and documented genetic progress.', cost: { cash: 1 }, effects: { genetics: 2, reputation: 1 } },
  document: { id: 'document', label: 'Document Everything', description: 'Turn knowledge into records, standards, and compliance readiness.', cost: { cash: 1 }, effects: { compliance: 2, knowledge: 1 } },
  build: { id: 'build', label: 'Build Capacity', description: 'Convert cash into durable assets and operating capability.', cost: { cash: 2 }, effects: { assets: 1, operations: 2 } },
  brand: { id: 'brand', label: 'Build the Brand', description: 'Package reputation and knowledge into a recognizable identity.', cost: { cash: 2 }, effects: { brand: 2, reputation: 1 }, eraMinimum: 1 }
};

const BASE_RESOURCES = Object.freeze({ reputation: 2, cash: 6, knowledge: 1, assets: 0, compliance: 0, brand: 0, operations: 0, genetics: 1 });
const RESOURCE_KEYS = Object.keys(BASE_RESOURCES);
const eraLabels = { underground: 'Underground Era', medical: 'Medical Era', legal: 'Legal Era' };
const resourceLabels = { reputation: 'Reputation', cash: 'Cash', knowledge: 'Knowledge', assets: 'Assets', compliance: 'Compliance', brand: 'Brand', operations: 'Operations', genetics: 'Genetics' };

let events = [];
let state = null;
let startArmed = false;
let discardArmed = false;
let armTimer = null;

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
  again: document.querySelector('#play-again'), announce: document.querySelector('#announce')
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSeed(seed) {
  const parsed = Number(seed);
  const normalized = Number.isFinite(parsed) ? Math.trunc(parsed) >>> 0 : 1;
  return normalized || 1;
}

function nextRandom(inputState) {
  let x = inputState.rngState >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0 || 1;
  inputState.rngState = next;
  return next / 0x100000000;
}

function applyDelta(resources, delta = {}) {
  for (const [key, amount] of Object.entries(delta)) {
    if (!RESOURCE_KEYS.includes(key)) throw new Error(`Unknown resource: ${key}`);
    resources[key] = Math.max(0, resources[key] + Number(amount));
  }
}

function canPay(resources, cost = {}) {
  return Object.entries(cost).every(([key, amount]) => (resources[key] ?? 0) >= Number(amount));
}

function pay(resources, cost = {}) {
  for (const [key, amount] of Object.entries(cost)) resources[key] -= Number(amount);
}

function currentEra(inputState) {
  return ERA_IDS[Math.min(inputState.eraIndex, ERA_IDS.length - 1)];
}

function createGame({ seed = 1, playerName = 'Grower' } = {}) {
  return {
    schemaVersion: 1,
    playerName: String(playerName || 'Grower').trim().slice(0, 40) || 'Grower',
    seed: normalizeSeed(seed), rngState: normalizeSeed(seed), turn: 0, eraIndex: 0, eraTurn: 0, complete: false,
    resources: clone(BASE_RESOURCES), milestones: [], history: [], finalScore: null
  };
}

function legalActions(inputState) {
  if (inputState.complete) return [];
  return Object.values(ACTIONS).map((action) => {
    let reason = null;
    if (action.eraMinimum != null && inputState.eraIndex < action.eraMinimum) reason = `Available beginning in the ${ERA_IDS[action.eraMinimum]} era.`;
    else if (!canPay(inputState.resources, action.cost)) reason = 'Not enough cash/resources for this action.';
    return { ...action, allowed: reason == null, reason };
  });
}

function eventPool(sourceEvents, eraId) {
  const pool = sourceEvents.filter((event) => event.era === eraId);
  if (!pool.length) throw new Error(`No events configured for era: ${eraId}`);
  return pool;
}

function diffResources(before, after) {
  const result = {};
  for (const key of RESOURCE_KEYS) {
    const delta = after[key] - before[key];
    if (delta !== 0) result[key] = delta;
  }
  return result;
}

function resolveEvent(inputState, sourceEvents) {
  const eraId = currentEra(inputState);
  const pool = eventPool(sourceEvents, eraId);
  const index = Math.floor(nextRandom(inputState) * pool.length);
  const event = pool[Math.min(index, pool.length - 1)];
  const before = clone(inputState.resources);
  const mitigationEligible = Boolean(event.mitigation && (before[event.mitigation.resource] ?? 0) >= event.mitigation.minimum);
  applyDelta(inputState.resources, event.effects);
  let mitigation = null;
  if (mitigationEligible) {
    applyDelta(inputState.resources, event.mitigation.effects);
    mitigation = event.mitigation.label;
  }
  return { id: event.id, title: event.title, text: event.text, era: eraId, mitigation, resourceChange: diffResources(before, inputState.resources) };
}

function resolveEraTransition(inputState) {
  if (inputState.turn === 0 || inputState.turn % ERA_LENGTH !== 0 || inputState.turn >= MAX_TURNS) return null;
  const leavingEra = ERA_IDS[inputState.eraIndex];
  const requirements = [['reputation', inputState.eraIndex === 0 ? 5 : 8], ['knowledge', inputState.eraIndex === 0 ? 4 : 6]];
  if (inputState.eraIndex >= 1) requirements.push(['compliance', 3]);
  const met = requirements.filter(([key, minimum]) => inputState.resources[key] >= minimum).length;
  const bonus = met === requirements.length ? { cash: 2, reputation: 1 } : met >= Math.ceil(requirements.length / 2) ? { cash: 1 } : { reputation: -1 };
  applyDelta(inputState.resources, bonus);
  const milestone = { type: 'era-transition', from: leavingEra, to: ERA_IDS[inputState.eraIndex + 1], requirements: requirements.map(([resource, minimum]) => ({ resource, minimum })), met, total: requirements.length, bonus };
  inputState.milestones.push(milestone);
  inputState.eraIndex += 1;
  inputState.eraTurn = 0;
  return milestone;
}

function calculateLegacyScore(inputState) {
  const r = inputState.resources;
  const base = r.reputation * 3 + r.cash + r.knowledge * 2 + r.assets * 4 + r.compliance * 2 + r.brand * 4 + r.operations * 3 + r.genetics * 3;
  const balanced = ['reputation', 'knowledge', 'assets', 'compliance', 'brand', 'operations', 'genetics'].filter((key) => r[key] >= 4).length;
  const balanceBonus = balanced >= 6 ? 18 : balanced >= 4 ? 10 : balanced >= 2 ? 4 : 0;
  return base + balanceBonus;
}

function takeTurn(inputState, actionId, sourceEvents) {
  if (!Array.isArray(sourceEvents) || sourceEvents.length === 0) throw new Error('Event data is required.');
  const next = clone(inputState);
  if (next.complete) throw new Error('Game is already complete.');
  const action = ACTIONS[actionId];
  if (!action) throw new Error(`Unknown action: ${actionId}`);
  const legal = legalActions(next).find((candidate) => candidate.id === actionId);
  if (!legal?.allowed) throw new Error(legal?.reason || `Action not allowed: ${actionId}`);
  const before = clone(next.resources);
  pay(next.resources, action.cost);
  applyDelta(next.resources, action.effects);
  const actionChange = diffResources(before, next.resources);
  const event = resolveEvent(next, sourceEvents);
  next.turn += 1;
  next.eraTurn += 1;
  const transition = resolveEraTransition(next);
  const record = { turn: next.turn, era: transition ? transition.from : currentEra(next), action: { id: action.id, label: action.label, resourceChange: actionChange }, event, transition };
  next.history.push(record);
  if (next.turn >= MAX_TURNS) {
    next.complete = true;
    next.finalScore = calculateLegacyScore(next);
  }
  return next;
}

function isRecoverableHighLifeState(saved, maxTurns) {
  if (!saved || !Number.isInteger(maxTurns) || maxTurns <= 0) return false;
  if (!Number.isInteger(saved.turn) || saved.turn < 0 || saved.turn > maxTurns) return false;
  if (!saved.resources || typeof saved.resources !== 'object') return false;
  if (saved.complete === true) return saved.turn === maxTurns && Number.isFinite(saved.finalScore);
  return saved.turn < maxTurns;
}

function validateEvents(sourceEvents) {
  if (!Array.isArray(sourceEvents) || sourceEvents.length !== 18) throw new Error('High Life event data is incomplete.');
  const ids = new Set(sourceEvents.map((event) => event.id));
  if (ids.size !== sourceEvents.length) throw new Error('High Life event IDs must be unique.');
  for (const era of ERA_IDS) {
    if (sourceEvents.filter((event) => event.era === era).length !== 6) throw new Error(`High Life ${era} era must have six events.`);
  }
}

function storageGet(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

function storageSet(key, value) {
  try { globalThis.localStorage?.setItem(key, value); return true; } catch (error) { console.warn('High Life autosave unavailable.', error); return false; }
}

function storageRemove(key) {
  try { globalThis.localStorage?.removeItem(key); return true; } catch (error) { console.warn('High Life save cleanup unavailable.', error); return false; }
}

function safeScroll(element, block = 'start') {
  try {
    const reduced = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    element?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block });
  } catch {
    element?.scrollIntoView?.();
  }
}

function formatDelta(delta) {
  return Object.entries(delta).map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${resourceLabels[key] || key}`);
}

function resourceCards(resources, target) {
  target.replaceChildren();
  for (const [key, value] of Object.entries(resources)) {
    const card = document.createElement('div');
    const level = Math.max(0, Math.min(100, Math.round((Number(value) / 12) * 100)));
    card.className = `resource${value <= 2 ? ' low' : value >= 8 ? ' strong' : ''}`;
    card.innerHTML = `<span>${resourceLabels[key] || key}</span><strong>${value}</strong><div class="resource-meter" aria-hidden="true"><i style="width:${level}%"></i></div>`;
    target.append(card);
  }
}

function readSave() {
  try {
    const payload = JSON.parse(storageGet(SAVE_KEY) || 'null');
    const saved = payload?.state;
    if (!payload || ![1, 2].includes(payload.version) || !isRecoverableHighLifeState(saved, MAX_TURNS)) return null;
    return { version: payload.version, savedAt: payload.savedAt, pendingEvent: payload.version >= 2 && payload.pendingEvent === true, state: saved };
  } catch {
    return null;
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
  const era = eraLabels[currentEra(saved)] || 'Career';
  ui.saveStatus.textContent = `Saved career: ${saved.playerName || 'Grower'} · ${era} · turn ${Math.min(saved.turn + 1, MAX_TURNS)} of ${MAX_TURNS}${phase}.`;
}

function saveGame({ pendingEvent = false } = {}) {
  if (!state) {
    storageRemove(SAVE_KEY);
    refreshSaveControls();
    return;
  }
  storageSet(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), pendingEvent: Boolean(pendingEvent), state }));
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
  ui.turn.textContent = state.complete ? `Career complete · ${MAX_TURNS} of ${MAX_TURNS} turns` : `Turn ${state.turn + 1} of ${MAX_TURNS} · Era turn ${state.eraTurn + 1} of ${ERA_LENGTH}`;
  ui.progress.value = state.complete ? ERA_LENGTH : state.eraTurn;
  ui.score.textContent = calculateLegacyScore(state);
  resourceCards(state.resources, ui.resources);
  updateEraRoadmap();

  ui.actions.replaceChildren();
  for (const action of legalActions(state)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `action-card${action.allowed ? ' available' : ' locked'}`;
    button.disabled = !action.allowed;
    const costs = formatDelta(Object.fromEntries(Object.entries(action.cost || {}).map(([key, value]) => [key, -value])));
    const gains = formatDelta(action.effects || {});
    const cost = costs.join(' · ') || 'No resource cost';
    const gain = gains.join(' · ');
    button.innerHTML = `<span class="action-state">${action.allowed ? 'AVAILABLE' : 'LOCKED'}</span><strong>${action.label}</strong><span>${action.description}</span><div class="action-economy"><small class="cost">${cost}</small><b>→</b><small class="gain">${gain}</small></div>${action.reason ? `<em>${action.reason}</em>` : ''}`;
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
    const t = record.transition;
    ui.transition.hidden = false;
    ui.transition.textContent = `Era transition: ${t.met}/${t.total} preparation gates met. ${formatDelta(t.bonus).join(' · ') || 'No transition modifier.'}`;
  } else ui.transition.hidden = true;
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

function continueGame() {
  ui.eventPanel.hidden = true;
  if (state.complete) return showResults();
  saveGame({ pendingEvent: false });
  render();
  safeScroll(document.querySelector('#choices-title'));
}

function showResults() {
  storageRemove(SAVE_KEY);
  refreshSaveControls();
  ui.game.hidden = true;
  ui.results.hidden = false;
  ui.resultTitle.textContent = `${state.playerName}'s Legacy`;
  ui.finalScore.textContent = `${state.finalScore} points`;
  const strong = Object.entries(state.resources).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => resourceLabels[key]).join(', ');
  ui.resultSummary.textContent = `Completed all three eras in ${state.turn} turns. Strongest final areas: ${strong}. Replay the same seed with different choices to compare paths under the same event stream.`;
  resourceCards(state.resources, ui.finalResources);
  safeScroll(ui.results);
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
  if (!payload) return refreshSaveControls();
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
  ui.announce.textContent = payload.pendingEvent ? `Saved ${payload.state.history.at(-1)?.event?.title ?? 'turn result'} restored.` : `Saved career resumed at turn ${payload.state.turn + 1}.`;
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
    ui.load.textContent = 'Ready · 18 seeded events · 3 eras · exact autosave resume';
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
