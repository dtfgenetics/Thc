import {
  DEFENSE_ALPHABET,
  applyAction,
  createGame,
  isValidDefenseCode,
  normalizeDefenseCode
} from './engine.mjs';

const ui = {
  load: document.querySelector('#load-status'),
  round: document.querySelector('#round-stat'),
  score: document.querySelector('#score-stat'),
  resolved: document.querySelector('#resolved-stat'),
  damage: document.querySelector('#damage-stat'),
  wave: document.querySelector('#wave-status'),
  lanes: document.querySelector('#lanes'),
  tools: document.querySelector('#tools'),
  selectedTool: document.querySelector('#selected-tool'),
  feedback: document.querySelector('#feedback'),
  code: document.querySelector('#defense-code'),
  newCode: document.querySelector('#new-code'),
  share: document.querySelector('#share-run'),
  history: document.querySelector('#history'),
  announce: document.querySelector('#announce')
};

let data = null;
let state = null;
let selectedToolId = null;
let threatById = new Map();
let toolById = new Map();
let laneById = new Map();

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return [...values].map((number) => DEFENSE_ALPHABET[number % DEFENSE_ALPHABET.length]).join('');
}

function challengeUrl() {
  const params = new URLSearchParams({ defense: state.code });
  return `${location.origin}${location.pathname}?${params}`;
}

function setCode(value) {
  const normalized = normalizeDefenseCode(value);
  ui.code.value = normalized;
  ui.code.setAttribute('aria-invalid', String(normalized.length > 0 && !isValidDefenseCode(normalized)));
}

function selectedTool() {
  return toolById.get(selectedToolId) ?? null;
}

function renderStats() {
  ui.round.textContent = `${state.round} / ${state.maxRounds}`;
  ui.score.textContent = String(state.score);
  ui.resolved.textContent = String(state.resolved);
  ui.damage.textContent = String(state.totalDamage);
}

function renderWave() {
  if (state.status !== 'playing') {
    ui.wave.textContent = state.status === 'won' ? 'Defense run complete.' : 'All benches lost.';
    return;
  }
  const spawn = state.lastSpawn;
  const threat = spawn ? threatById.get(spawn.threatId) : null;
  const lane = spawn ? laneById.get(spawn.laneId) : null;
  ui.wave.textContent = threat && lane
    ? `Round ${state.round}: ${threat.label} detected at ${lane.label}.`
    : `Round ${state.round}: review the room.`;
}

function pressurePips(active) {
  let pips = '';
  for (let index = 0; index < active.maxPressure; index += 1) {
    const filled = index < active.pressure;
    pips += `<span class="pressure-pip${filled ? ' active' : ''}" aria-hidden="true"></span>`;
  }
  return `<span class="pressure-meter" aria-label="Pressure ${active.pressure} of ${active.maxPressure}">${pips}</span>`;
}

function renderThreat(active, laneId, tool) {
  const threat = threatById.get(active.threatId);
  if (!threat) return '';
  const disabled = !tool || state.status !== 'playing' ? 'disabled' : '';
  const action = tool ? `Use ${tool.label} on ${threat.label}` : `Select a tool to target ${threat.label}`;
  return `
    <button type="button" class="threat-card threat-target" data-lane="${escapeHtml(laneId)}" data-instance="${escapeHtml(active.instanceId)}" ${disabled} aria-label="${escapeHtml(action)}. Pressure ${active.pressure} of ${active.maxPressure}.">
      <span class="threat-mark">${escapeHtml(threat.mark)}</span>
      <span class="threat-copy">
        <strong>${escapeHtml(threat.label)}</strong>
        <small>${escapeHtml(threat.category)}</small>
        ${pressurePips(active)}
      </span>
    </button>`;
}

function plantArt() {
  return `
    <div class="plant-art" aria-hidden="true">
      <span class="plant-stem"></span>
      <span class="leaf leaf-a"></span>
      <span class="leaf leaf-b"></span>
      <span class="leaf leaf-c"></span>
      <span class="leaf leaf-d"></span>
      <span class="pot"></span>
    </div>`;
}

function renderLanes() {
  const tool = selectedTool();
  ui.lanes.replaceChildren();

  for (const lane of state.lanes) {
    const section = document.createElement('section');
    section.className = `lane-card${lane.health <= 0 ? ' lost' : ''}`;
    const threatMarkup = lane.threats.length
      ? lane.threats.map((active) => renderThreat(active, lane.id, tool)).join('')
      : '<p class="clear-lane">No active pressure.</p>';
    const actionLabel = tool ? `Deploy ${tool.label} to bench` : 'Select a tool first';
    section.innerHTML = `
      <div class="lane-heading">
        <div><span>${escapeHtml(lane.label)}</span><strong>${escapeHtml(lane.plant)}</strong></div>
        <b>${lane.health}%</b>
      </div>
      <div class="health-track" aria-label="${escapeHtml(lane.plant)} health ${lane.health} percent"><span style="width:${lane.health}%"></span></div>
      ${plantArt()}
      <div class="threat-stack">${threatMarkup}</div>
      <button type="button" class="deploy-button" data-lane="${escapeHtml(lane.id)}" ${!tool || lane.health <= 0 || state.status !== 'playing' ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button>`;
    ui.lanes.append(section);
  }
}

function renderTools() {
  ui.tools.replaceChildren();
  for (const tool of data.tools) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-button';
    button.dataset.tool = tool.id;
    button.setAttribute('aria-pressed', String(tool.id === selectedToolId));
    button.disabled = state.status !== 'playing';
    button.innerHTML = `<span class="tool-mark">${escapeHtml(tool.mark)}</span><span><strong>${escapeHtml(tool.label)}</strong><small>${escapeHtml(tool.description)}</small></span>`;
    ui.tools.append(button);
  }
}

function renderSelectedTool() {
  const tool = selectedTool();
  if (!tool) {
    ui.selectedTool.innerHTML = '<strong>No tool selected.</strong><span>Choose one defense tool, then target a specific threat or deploy to a bench.</span>';
    return;
  }
  ui.selectedTool.innerHTML = `<strong>${escapeHtml(tool.label)}</strong><span>${escapeHtml(tool.description)} Select a threat card to prioritize it.</span>`;
}

function qualityCopy(action) {
  if (action.quality === 'strong') return ['STRONG COUNTER', 'strong'];
  if (action.quality === 'supportive') return ['SUPPORTIVE COUNTER', 'supportive'];
  if (action.quality === 'mismatch') return ['MISMATCH', 'mismatch'];
  return ['EMPTY BENCH', 'empty'];
}

function renderFeedback() {
  if (!state.lastAction) {
    ui.feedback.className = 'feedback-card';
    ui.feedback.innerHTML = '<span class="feedback-kicker">DEFENSE READY</span><strong>Select a tool, then choose the pressure you want to prioritize.</strong><p>Threat cards are direct targets. The bench button remains a quick action and uses the oldest active threat on that bench.</p>';
    return;
  }

  const action = state.lastAction;
  const tool = toolById.get(action.toolId);
  const threat = action.threatId ? threatById.get(action.threatId) : null;
  const lane = laneById.get(action.laneId);
  const [headline, className] = qualityCopy(action);
  let detail;
  if (!threat) {
    detail = `${tool?.label ?? 'That tool'} was deployed to ${lane?.label ?? 'the bench'}, but there was no active pressure there.`;
  } else if (action.resolvedThreat) {
    detail = `${tool.label} cleared ${threat.label} from ${lane.label} before the next wave.`;
  } else if (action.reduction > 0) {
    detail = `${tool.label} reduced ${threat.label} by ${action.reduction} pressure. ${action.damage} total plant damage followed from unresolved room pressure.`;
  } else {
    detail = `${tool.label} did not reduce ${threat.label}. ${action.damage} total plant damage followed from unresolved room pressure.`;
  }

  const lesson = threat ? `<p class="lesson"><strong>IPM note:</strong> ${escapeHtml(threat.lesson)}</p>` : '';
  const result = state.status === 'won'
    ? `<p class="game-result win"><strong>Room defended.</strong> Final score ${state.score}.</p>`
    : state.status === 'lost'
      ? `<p class="game-result loss"><strong>Room lost.</strong> Start a new defense code to try again.</p>`
      : '';

  ui.feedback.className = `feedback-card ${className}`;
  ui.feedback.innerHTML = `<span class="feedback-kicker">${headline}</span><strong>${escapeHtml(detail)}</strong>${lesson}${result}`;
}

function renderHistory() {
  ui.history.replaceChildren();
  if (!state.history.length) {
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.textContent = 'Your defense choices will appear here.';
    ui.history.append(item);
    return;
  }

  for (const action of [...state.history].slice(-7).reverse()) {
    const tool = toolById.get(action.toolId);
    const threat = action.threatId ? threatById.get(action.threatId) : null;
    const lane = laneById.get(action.laneId);
    const item = document.createElement('li');
    item.innerHTML = `<span>R${action.round}</span><div><strong>${escapeHtml(tool?.label ?? action.toolId)}</strong><small>${escapeHtml(lane?.label ?? action.laneId)} · ${escapeHtml(threat?.label ?? 'No pressure')} · ${escapeHtml(action.quality)}</small></div>`;
    ui.history.append(item);
  }
}

function render() {
  renderStats();
  renderWave();
  renderTools();
  renderSelectedTool();
  renderLanes();
  renderFeedback();
  renderHistory();
}

function resetGame(code) {
  state = createGame({ code }, data);
  selectedToolId = null;
  setCode(state.code);
  window.history.replaceState(null, '', challengeUrl());
  render();
}

function playAction(laneId, instanceId = null) {
  if (!selectedToolId || state.status !== 'playing') return;
  try {
    state = applyAction(state, { toolId: selectedToolId, laneId, instanceId }, data);
    const action = state.lastAction;
    render();
    const threat = action.threatId ? threatById.get(action.threatId) : null;
    ui.announce.textContent = `${qualityCopy(action)[0]}. ${threat ? `${threat.label}. ` : ''}${action.damage} total damage this round. Round ${state.round} of ${state.maxRounds}.`;
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error.message;
  }
}

ui.tools.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-tool]');
  if (!button || state?.status !== 'playing') return;
  selectedToolId = button.dataset.tool;
  renderTools();
  renderSelectedTool();
  renderLanes();
  ui.announce.textContent = `${selectedTool().label} selected. Choose a specific threat or a plant bench.`;
});

ui.lanes.addEventListener('click', (event) => {
  const threatButton = event.target.closest('button[data-instance][data-lane]');
  if (threatButton) {
    playAction(threatButton.dataset.lane, threatButton.dataset.instance);
    return;
  }
  const benchButton = event.target.closest('button[data-lane]');
  if (!benchButton) return;
  playAction(benchButton.dataset.lane);
});

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidDefenseCode(ui.code.value)) {
    ui.announce.textContent = 'Enter a complete six-character defense code.';
    return;
  }
  resetGame(ui.code.value);
  ui.announce.textContent = `Defense code ${state.code} loaded.`;
});

ui.newCode.addEventListener('click', () => {
  resetGame(randomCode());
  ui.announce.textContent = `New defense code ${state.code}.`;
});

ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `Grow Room Defense · code ${state.code}\n${url}`;
  try {
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Defense challenge copied.';
  } catch {
    ui.announce.textContent = `Share defense code ${state.code}: ${url}`;
  }
});

async function load() {
  try {
    const response = await fetch('./data/ipm.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`IPM data HTTP ${response.status}`);
    data = await response.json();
    if (data.schemaVersion !== 1 || data.lanes?.length !== 3 || data.threats?.length !== 8 || data.tools?.length !== 7) {
      throw new Error('Grow Room Defense data contract mismatch');
    }
    threatById = new Map(data.threats.map((threat) => [threat.id, threat]));
    toolById = new Map(data.tools.map((tool) => [tool.id, tool]));
    laneById = new Map(data.lanes.map((lane) => [lane.id, lane]));

    const requested = normalizeDefenseCode(new URLSearchParams(location.search).get('defense'));
    const code = isValidDefenseCode(requested) ? requested : randomCode();
    state = createGame({ code }, data);
    setCode(code);
    window.history.replaceState(null, '', challengeUrl());
    ui.load.textContent = '12 deterministic rounds · 8 threats · 7 IPM tools · priority targeting';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Grow Room Defense could not load its game data.';
  }
}

load();
