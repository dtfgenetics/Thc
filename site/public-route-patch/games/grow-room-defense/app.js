const DEFENSE_CODE_LENGTH = 6;
const DEFENSE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROUNDS = 12;
const INITIAL_HEALTH = 100;

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

function normalizeDefenseCode(value) {
  const allowed = new Set(DEFENSE_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, DEFENSE_CODE_LENGTH);
}

function isValidDefenseCode(value) {
  return normalizeDefenseCode(value).length === DEFENSE_CODE_LENGTH;
}

function requireData(data) {
  if (!data?.lanes?.length || !data?.threats?.length || !data?.tools?.length) {
    throw new Error('Grow Room Defense data is required.');
  }
}

function threatMap(data) {
  return new Map(data.threats.map((threat) => [threat.id, threat]));
}

function toolMap(data) {
  return new Map(data.tools.map((tool) => [tool.id, tool]));
}

function spawnThreat(inputState, data) {
  const state = clone(inputState);
  if (state.status !== 'playing') return state;
  const aliveLanes = state.lanes.filter((lane) => lane.health > 0);
  if (!aliveLanes.length) return state;

  const threat = data.threats[hash(`${state.code}:threat:${state.round}`) % data.threats.length];
  const lane = aliveLanes[hash(`${state.code}:lane:${state.round}`) % aliveLanes.length];
  const target = state.lanes.find((candidate) => candidate.id === lane.id);
  const instance = {
    instanceId: `${state.round}-${lane.id}-${threat.id}`,
    threatId: threat.id,
    pressure: threat.pressure,
    maxPressure: threat.pressure,
    spawnedRound: state.round
  };
  target.threats.push(instance);
  state.lastSpawn = {
    round: state.round,
    laneId: lane.id,
    threatId: threat.id,
    instanceId: instance.instanceId
  };
  return state;
}

function counterQuality(threat, tool) {
  const matchIndex = threat.weaknesses.findIndex((weakness) => tool.strengths.includes(weakness));
  if (matchIndex === 0) return 'strong';
  if (matchIndex > 0) return 'supportive';
  return 'mismatch';
}

function counterPower(threat, tool) {
  const quality = counterQuality(threat, tool);
  if (quality === 'strong') return tool.power + 1;
  if (quality === 'supportive') return Math.max(1, tool.power - 1);
  return 0;
}

function createGame({ code } = {}, data) {
  requireData(data);
  const normalized = normalizeDefenseCode(code);
  if (!isValidDefenseCode(normalized)) throw new Error('A six-character defense code is required.');

  const state = {
    schemaVersion: 1,
    code: normalized,
    round: 1,
    maxRounds: MAX_ROUNDS,
    status: 'playing',
    score: 0,
    resolved: 0,
    totalDamage: 0,
    lanes: data.lanes.map((lane) => ({
      id: lane.id,
      label: lane.label,
      plant: lane.plant,
      health: INITIAL_HEALTH,
      threats: []
    })),
    lastSpawn: null,
    lastAction: null,
    history: []
  };

  return spawnThreat(state, data);
}

function applyAction(inputState, { toolId, laneId, instanceId } = {}, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing') throw new Error('This defense run is already complete.');

  const lane = state.lanes.find((candidate) => candidate.id === laneId);
  if (!lane) throw new Error(`Unknown lane: ${laneId}`);
  if (lane.health <= 0) throw new Error('That plant bench has already been lost.');

  const tool = toolMap(data).get(toolId);
  if (!tool) throw new Error(`Unknown defense tool: ${toolId}`);

  const threats = threatMap(data);
  const targetIndex = instanceId
    ? lane.threats.findIndex((candidate) => candidate.instanceId === instanceId)
    : (lane.threats.length ? 0 : -1);
  if (instanceId && targetIndex < 0) throw new Error('That threat is no longer active on this bench.');
  const target = targetIndex >= 0 ? lane.threats[targetIndex] : null;
  let quality = 'empty';
  let reduction = 0;
  let resolvedThreat = null;
  let targetThreatId = null;
  let targetInstanceId = null;

  if (target) {
    const threat = threats.get(target.threatId);
    if (!threat) throw new Error(`Unknown active threat: ${target.threatId}`);
    targetThreatId = threat.id;
    targetInstanceId = target.instanceId;
    quality = counterQuality(threat, tool);
    reduction = Math.min(target.pressure, counterPower(threat, tool));
    target.pressure -= reduction;

    if (quality === 'strong') state.score += reduction * 15;
    else if (quality === 'supportive') state.score += reduction * 8;

    if (target.pressure <= 0) {
      resolvedThreat = threat.id;
      lane.threats.splice(targetIndex, 1);
      state.resolved += 1;
      state.score += 25;
    }
  }

  let damageThisRound = 0;
  for (const plantLane of state.lanes) {
    if (plantLane.health <= 0) continue;
    for (const active of plantLane.threats) {
      const threat = threats.get(active.threatId);
      if (!threat) continue;
      const scaledDamage = Math.max(1, Math.ceil(threat.damage * (active.pressure / active.maxPressure)));
      plantLane.health = Math.max(0, plantLane.health - scaledDamage);
      damageThisRound += scaledDamage;
    }
  }
  state.totalDamage += damageThisRound;

  state.lastAction = {
    round: state.round,
    laneId,
    toolId,
    threatId: targetThreatId,
    instanceId: targetInstanceId,
    quality,
    reduction,
    resolvedThreat,
    damage: damageThisRound
  };
  state.history.push(state.lastAction);

  const totalHealth = state.lanes.reduce((sum, plantLane) => sum + plantLane.health, 0);
  if (totalHealth <= 0) {
    state.status = 'lost';
    return state;
  }

  if (state.round >= state.maxRounds) {
    state.status = 'won';
    state.score += totalHealth;
    return state;
  }

  state.round += 1;
  return spawnThreat(state, data);
}

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

function readEmbeddedData() {
  const node = document.querySelector('#grow-room-defense-data');
  if (!node) throw new Error('Embedded defense data is missing.');
  const parsed = JSON.parse(node.textContent || '{}');
  validateData(parsed);
  return parsed;
}

function validateData(candidate) {
  if (candidate?.schemaVersion !== 1) throw new Error('Grow Room Defense data contract mismatch');
  if (!Array.isArray(candidate.lanes) || candidate.lanes.length !== 3) throw new Error('expected three plant benches');
  if (!Array.isArray(candidate.threats) || candidate.threats.length !== 8) throw new Error('expected eight pressure types');
  if (!Array.isArray(candidate.tools) || candidate.tools.length !== 7) throw new Error('expected seven IPM tools');

  const laneIds = new Set();
  for (const lane of candidate.lanes) {
    if (!lane?.id || !lane?.label || !lane?.plant) throw new Error('a plant bench is incomplete');
    if (laneIds.has(lane.id)) throw new Error(`duplicate plant bench id: ${lane.id}`);
    laneIds.add(lane.id);
  }

  const toolIds = new Set();
  const strengthIds = new Set();
  for (const tool of candidate.tools) {
    if (!tool?.id || !tool?.label || !tool?.mark || !tool?.description || !Number.isFinite(tool.power) || tool.power < 1 || !Array.isArray(tool.strengths) || !tool.strengths.length) {
      throw new Error('an IPM tool is incomplete');
    }
    if (toolIds.has(tool.id)) throw new Error(`duplicate IPM tool id: ${tool.id}`);
    toolIds.add(tool.id);
    for (const strength of tool.strengths) strengthIds.add(strength);
  }

  const threatIds = new Set();
  for (const threat of candidate.threats) {
    if (!threat?.id || !threat?.label || !threat?.mark || !threat?.category || !threat?.lesson || !Number.isFinite(threat.pressure) || threat.pressure < 1 || !Number.isFinite(threat.damage) || threat.damage < 1 || !Array.isArray(threat.weaknesses) || !threat.weaknesses.length) {
      throw new Error('a threat definition is incomplete');
    }
    if (threatIds.has(threat.id)) throw new Error(`duplicate threat id: ${threat.id}`);
    threatIds.add(threat.id);
    for (const weakness of threat.weaknesses) {
      if (!strengthIds.has(weakness)) throw new Error(`${threat.label} references unsupported weakness ${weakness}`);
    }
    if (!candidate.tools.some((tool) => tool.strengths.includes(threat.weaknesses[0]) && tool.power + 1 >= threat.pressure)) {
      throw new Error(`${threat.label} has no strong counter able to clear fresh pressure`);
    }
  }
}

function randomCode() {
  const values = new Uint32Array(DEFENSE_CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  }
  return [...values].map((number) => DEFENSE_ALPHABET[number % DEFENSE_ALPHABET.length]).join('');
}

function challengeUrl() {
  const params = new URLSearchParams({ defense: state.code });
  return `${location.origin}${location.pathname}?${params}`;
}

function safeReplaceUrl() {
  try { window.history.replaceState(null, '', challengeUrl()); } catch {}
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

function renderThreat(active, laneId, tool, laneAlive) {
  const threat = threatById.get(active.threatId);
  if (!threat) return '';
  const disabled = !tool || !laneAlive || state.status !== 'playing' ? 'disabled' : '';
  const action = !laneAlive
    ? `${threat.label} remains on a lost bench and cannot be targeted`
    : tool
      ? `Use ${tool.label} on ${threat.label}`
      : `Select a tool to target ${threat.label}`;
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
    const laneAlive = lane.health > 0;
    const section = document.createElement('section');
    section.className = `lane-card${laneAlive ? '' : ' lost'}`;
    const threatMarkup = lane.threats.length
      ? lane.threats.map((active) => renderThreat(active, lane.id, tool, laneAlive)).join('')
      : '<p class="clear-lane">No active pressure.</p>';
    const actionLabel = !laneAlive ? 'Bench lost' : tool ? `Deploy ${tool.label} to bench` : 'Select a tool first';
    section.innerHTML = `
      <div class="lane-heading">
        <div><span>${escapeHtml(lane.label)}</span><strong>${escapeHtml(lane.plant)}</strong></div>
        <b>${lane.health}%</b>
      </div>
      <div class="health-track" aria-label="${escapeHtml(lane.plant)} health ${lane.health} percent"><span style="width:${lane.health}%"></span></div>
      ${plantArt()}
      <div class="threat-stack">${threatMarkup}</div>
      <button type="button" class="deploy-button" data-lane="${escapeHtml(lane.id)}" ${!tool || !laneAlive || state.status !== 'playing' ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button>`;
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
  safeReplaceUrl();
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
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
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
  const benchButton = event.target.closest('button.deploy-button[data-lane]');
  if (!benchButton) return;
  playAction(benchButton.dataset.lane);
});

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidDefenseCode(ui.code.value)) {
    ui.code.setAttribute('aria-invalid', 'true');
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
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Defense challenge copied.';
  } catch {
    ui.announce.textContent = `Share defense code ${state.code}: ${url}`;
  }
});

function load() {
  try {
    data = readEmbeddedData();
    threatById = new Map(data.threats.map((threat) => [threat.id, threat]));
    toolById = new Map(data.tools.map((tool) => [tool.id, tool]));
    laneById = new Map(data.lanes.map((lane) => [lane.id, lane]));

    const requested = normalizeDefenseCode(new URLSearchParams(location.search).get('defense'));
    const code = isValidDefenseCode(requested) ? requested : randomCode();
    state = createGame({ code }, data);
    setCode(code);
    safeReplaceUrl();
    ui.load.textContent = '12 deterministic rounds · 8 threats · 7 IPM tools · priority targeting';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = `Grow Room Defense could not load its game data. ${error instanceof Error ? error.message : String(error)}`;
  }
}

load();
