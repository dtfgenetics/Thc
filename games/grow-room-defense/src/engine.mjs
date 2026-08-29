export const DEFENSE_CODE_LENGTH = 6;
export const DEFENSE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_ROUNDS = 12;
export const INITIAL_HEALTH = 100;

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

export function normalizeDefenseCode(value) {
  const allowed = new Set(DEFENSE_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, DEFENSE_CODE_LENGTH);
}

export function isValidDefenseCode(value) {
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

export function counterQuality(threat, tool) {
  const matchIndex = threat.weaknesses.findIndex((weakness) => tool.strengths.includes(weakness));
  if (matchIndex === 0) return 'strong';
  if (matchIndex > 0) return 'supportive';
  return 'mismatch';
}

export function counterPower(threat, tool) {
  const quality = counterQuality(threat, tool);
  if (quality === 'strong') return tool.power;
  if (quality === 'supportive') return Math.max(1, tool.power - 1);
  return 0;
}

export function createGame({ code } = {}, data) {
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

export function activeThreats(state) {
  return state.lanes.flatMap((lane) => lane.threats.map((threat) => ({ ...threat, laneId: lane.id })));
}

export function applyAction(inputState, { toolId, laneId } = {}, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing') throw new Error('This defense run is already complete.');

  const lane = state.lanes.find((candidate) => candidate.id === laneId);
  if (!lane) throw new Error(`Unknown lane: ${laneId}`);
  if (lane.health <= 0) throw new Error('That plant bench has already been lost.');

  const tool = toolMap(data).get(toolId);
  if (!tool) throw new Error(`Unknown defense tool: ${toolId}`);

  const threats = threatMap(data);
  const target = lane.threats[0] ?? null;
  let quality = 'empty';
  let reduction = 0;
  let resolvedThreat = null;
  let targetThreatId = null;

  if (target) {
    const threat = threats.get(target.threatId);
    if (!threat) throw new Error(`Unknown active threat: ${target.threatId}`);
    targetThreatId = threat.id;
    quality = counterQuality(threat, tool);
    reduction = Math.min(target.pressure, counterPower(threat, tool));
    target.pressure -= reduction;

    if (quality === 'strong') state.score += reduction * 15;
    else if (quality === 'supportive') state.score += reduction * 8;

    if (target.pressure <= 0) {
      resolvedThreat = threat.id;
      lane.threats.shift();
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

export function bestToolsForThreat(threatId, data) {
  const threat = threatMap(data).get(threatId);
  if (!threat) return [];
  return data.tools
    .map((tool) => ({ toolId: tool.id, quality: counterQuality(threat, tool), power: counterPower(threat, tool) }))
    .filter((choice) => choice.quality !== 'mismatch')
    .sort((a, b) => {
      const rank = { strong: 2, supportive: 1 };
      return rank[b.quality] - rank[a.quality] || b.power - a.power;
    });
}
