export const ERA_LENGTH = 6;
export const ERA_IDS = ['underground', 'medical', 'legal'];
export const MAX_TURNS = ERA_LENGTH * ERA_IDS.length;

export const ACTIONS = {
  learn: {
    id: 'learn',
    label: 'Study the Craft',
    description: 'Trade time and a little cash for durable knowledge.',
    cost: { cash: 1 },
    effects: { knowledge: 2 }
  },
  network: {
    id: 'network',
    label: 'Build the Network',
    description: 'Strengthen relationships and reputation.',
    cost: {},
    effects: { reputation: 2 }
  },
  genetics: {
    id: 'genetics',
    label: 'Work the Genetics',
    description: 'Invest in selection and documented genetic progress.',
    cost: { cash: 1 },
    effects: { genetics: 2, reputation: 1 }
  },
  document: {
    id: 'document',
    label: 'Document Everything',
    description: 'Turn knowledge into records, standards, and compliance readiness.',
    cost: { cash: 1 },
    effects: { compliance: 2, knowledge: 1 }
  },
  build: {
    id: 'build',
    label: 'Build Capacity',
    description: 'Convert cash into durable assets and operating capability.',
    cost: { cash: 2 },
    effects: { assets: 1, operations: 2 }
  },
  brand: {
    id: 'brand',
    label: 'Build the Brand',
    description: 'Package reputation and knowledge into a recognizable identity.',
    cost: { cash: 2 },
    effects: { brand: 2, reputation: 1 },
    eraMinimum: 1
  }
};

const BASE_RESOURCES = Object.freeze({
  reputation: 2,
  cash: 6,
  knowledge: 1,
  assets: 0,
  compliance: 0,
  brand: 0,
  operations: 0,
  genetics: 1
});

const RESOURCE_KEYS = Object.keys(BASE_RESOURCES);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSeed(seed) {
  const parsed = Number(seed);
  const normalized = Number.isFinite(parsed) ? Math.trunc(parsed) >>> 0 : 1;
  return normalized || 1;
}

function nextRandom(state) {
  let x = state.rngState >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0 || 1;
  state.rngState = next;
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

export function currentEra(state) {
  return ERA_IDS[Math.min(state.eraIndex, ERA_IDS.length - 1)];
}

export function createGame({ seed = 1, playerName = 'Grower' } = {}) {
  return {
    schemaVersion: 1,
    playerName: String(playerName || 'Grower').slice(0, 40),
    seed: normalizeSeed(seed),
    rngState: normalizeSeed(seed),
    turn: 0,
    eraIndex: 0,
    eraTurn: 0,
    complete: false,
    resources: clone(BASE_RESOURCES),
    milestones: [],
    history: [],
    finalScore: null
  };
}

export function legalActions(state) {
  if (state.complete) return [];
  return Object.values(ACTIONS).map((action) => {
    let reason = null;
    if (action.eraMinimum != null && state.eraIndex < action.eraMinimum) {
      reason = `Available beginning in the ${ERA_IDS[action.eraMinimum]} era.`;
    } else if (!canPay(state.resources, action.cost)) {
      reason = 'Not enough cash/resources for this action.';
    }
    return { ...action, allowed: reason == null, reason };
  });
}

function eventPool(events, eraId) {
  const pool = events.filter((event) => event.era === eraId);
  if (!pool.length) throw new Error(`No events configured for era: ${eraId}`);
  return pool;
}

function resolveEvent(state, events) {
  const eraId = currentEra(state);
  const pool = eventPool(events, eraId);
  const index = Math.floor(nextRandom(state) * pool.length);
  const event = pool[Math.min(index, pool.length - 1)];
  const before = clone(state.resources);

  applyDelta(state.resources, event.effects);

  let mitigation = null;
  if (event.mitigation && (state.resources[event.mitigation.resource] ?? 0) >= event.mitigation.minimum) {
    applyDelta(state.resources, event.mitigation.effects);
    mitigation = event.mitigation.label;
  }

  return {
    id: event.id,
    title: event.title,
    text: event.text,
    era: eraId,
    mitigation,
    resourceChange: diffResources(before, state.resources)
  };
}

function diffResources(before, after) {
  const result = {};
  for (const key of RESOURCE_KEYS) {
    const delta = after[key] - before[key];
    if (delta !== 0) result[key] = delta;
  }
  return result;
}

function resolveEraTransition(state) {
  if (state.turn === 0 || state.turn % ERA_LENGTH !== 0 || state.turn >= MAX_TURNS) return null;

  const leavingEra = ERA_IDS[state.eraIndex];
  const requirements = [
    ['reputation', state.eraIndex === 0 ? 5 : 8],
    ['knowledge', state.eraIndex === 0 ? 4 : 6]
  ];
  if (state.eraIndex >= 1) requirements.push(['compliance', 3]);

  const met = requirements.filter(([key, minimum]) => state.resources[key] >= minimum).length;
  const bonus = met === requirements.length
    ? { cash: 2, reputation: 1 }
    : met >= Math.ceil(requirements.length / 2)
      ? { cash: 1 }
      : { reputation: -1 };

  applyDelta(state.resources, bonus);
  const milestone = {
    type: 'era-transition',
    from: leavingEra,
    to: ERA_IDS[state.eraIndex + 1],
    requirements: requirements.map(([resource, minimum]) => ({ resource, minimum })),
    met,
    total: requirements.length,
    bonus
  };
  state.milestones.push(milestone);
  state.eraIndex += 1;
  state.eraTurn = 0;
  return milestone;
}

export function calculateLegacyScore(state) {
  const r = state.resources;
  const base =
    r.reputation * 3 +
    r.cash +
    r.knowledge * 2 +
    r.assets * 4 +
    r.compliance * 2 +
    r.brand * 4 +
    r.operations * 3 +
    r.genetics * 3;

  const balanced = ['reputation', 'knowledge', 'assets', 'compliance', 'brand', 'operations', 'genetics']
    .filter((key) => r[key] >= 4).length;
  const balanceBonus = balanced >= 6 ? 18 : balanced >= 4 ? 10 : balanced >= 2 ? 4 : 0;
  return base + balanceBonus;
}

export function takeTurn(inputState, actionId, events) {
  if (!Array.isArray(events) || events.length === 0) throw new Error('Event data is required.');
  const state = clone(inputState);
  if (state.complete) throw new Error('Game is already complete.');

  const action = ACTIONS[actionId];
  if (!action) throw new Error(`Unknown action: ${actionId}`);
  const legal = legalActions(state).find((candidate) => candidate.id === actionId);
  if (!legal?.allowed) throw new Error(legal?.reason || `Action not allowed: ${actionId}`);

  const before = clone(state.resources);
  pay(state.resources, action.cost);
  applyDelta(state.resources, action.effects);
  const actionChange = diffResources(before, state.resources);
  const event = resolveEvent(state, events);

  state.turn += 1;
  state.eraTurn += 1;
  const transition = resolveEraTransition(state);

  const record = {
    turn: state.turn,
    era: transition ? transition.from : currentEra(state),
    action: { id: action.id, label: action.label, resourceChange: actionChange },
    event,
    transition
  };
  state.history.push(record);

  if (state.turn >= MAX_TURNS) {
    state.complete = true;
    state.finalScore = calculateLegacyScore(state);
  }

  return state;
}

export function playStrategy({ seed = 1, actions = [], events, playerName = 'Simulation' } = {}) {
  if (!actions.length) throw new Error('At least one action is required for a strategy.');
  let state = createGame({ seed, playerName });
  let actionIndex = 0;
  while (!state.complete) {
    const preferred = actions[actionIndex % actions.length];
    const legal = legalActions(state);
    const choice = legal.find((action) => action.id === preferred && action.allowed)
      || legal.find((action) => action.allowed);
    if (!choice) throw new Error('No legal action is available.');
    state = takeTurn(state, choice.id, events);
    actionIndex += 1;
  }
  return state;
}
