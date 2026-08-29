export const SCENE_CODE_LENGTH = 6;
export const SCENE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_UNDO = 60;

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

function requireData(data) {
  if (!Array.isArray(data?.palette) || !Array.isArray(data?.scenes) || data.palette.length < 2 || !data.scenes.length) {
    throw new Error('High Lines scene data is required.');
  }
}

function sceneMap(data) {
  return new Map(data.scenes.map((scene) => [scene.id, scene]));
}

function paletteMap(data) {
  return new Map(data.palette.map((color) => [color.id, color]));
}

export function normalizeSceneCode(value) {
  const allowed = new Set(SCENE_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, SCENE_CODE_LENGTH);
}

export function isValidSceneCode(value) {
  return normalizeSceneCode(value).length === SCENE_CODE_LENGTH;
}

export function paletteForCode(code, data) {
  requireData(data);
  const start = hash(`${code}:palette`) % data.palette.length;
  return data.palette.map((_, index) => data.palette[(start + index) % data.palette.length].id);
}

export function scoreExperience(state, data) {
  requireData(data);
  const scene = sceneMap(data).get(state.sceneId);
  if (!scene) return 0;
  const colored = scene.regions.filter((regionId) => Boolean(state.fills?.[regionId])).length;
  const found = scene.hiddenObjects.filter((item) => state.foundHidden?.includes(item.id)).length;
  const complete = colored === scene.regions.length && found === scene.hiddenObjects.length;
  return (colored * 10) + (found * 35) + (complete ? 100 : 0);
}

export function progressForState(state, data) {
  requireData(data);
  const scene = sceneMap(data).get(state.sceneId);
  if (!scene) return { colored: 0, totalRegions: 0, found: 0, totalHidden: 0, percent: 0, complete: false };
  const colored = scene.regions.filter((regionId) => Boolean(state.fills?.[regionId])).length;
  const found = scene.hiddenObjects.filter((item) => state.foundHidden?.includes(item.id)).length;
  const total = scene.regions.length + scene.hiddenObjects.length;
  const done = colored + found;
  return {
    colored,
    totalRegions: scene.regions.length,
    found,
    totalHidden: scene.hiddenObjects.length,
    percent: total ? Math.round((done / total) * 100) : 0,
    complete: colored === scene.regions.length && found === scene.hiddenObjects.length
  };
}

export function createExperience({ code } = {}, data) {
  requireData(data);
  const normalized = normalizeSceneCode(code);
  if (!isValidSceneCode(normalized)) throw new Error('A six-character High Lines scene code is required.');
  const scene = data.scenes[hash(`${normalized}:scene`) % data.scenes.length];
  const promptIndex = hash(`${normalized}:${scene.id}:prompt`) % scene.prompts.length;
  const paletteOrder = paletteForCode(normalized, data);
  return {
    schemaVersion: 1,
    code: normalized,
    sceneId: scene.id,
    promptIndex,
    prompt: scene.prompts[promptIndex],
    paletteOrder,
    selectedColorId: paletteOrder[0],
    fills: {},
    foundHidden: [],
    undoStack: [],
    score: 0,
    complete: false
  };
}

function finalize(state, data) {
  const progress = progressForState(state, data);
  state.score = scoreExperience(state, data);
  state.complete = progress.complete;
  return state;
}

export function selectColor(inputState, colorId, data) {
  requireData(data);
  if (!paletteMap(data).has(colorId)) throw new Error(`Unknown palette color: ${colorId}`);
  const state = clone(inputState);
  state.selectedColorId = colorId;
  return state;
}

export function fillRegion(inputState, regionId, colorId, data) {
  requireData(data);
  const state = clone(inputState);
  const scene = sceneMap(data).get(state.sceneId);
  if (!scene) throw new Error(`Unknown scene: ${state.sceneId}`);
  if (!scene.regions.includes(regionId)) throw new Error(`Unknown region: ${regionId}`);
  if (!paletteMap(data).has(colorId)) throw new Error(`Unknown palette color: ${colorId}`);
  const previousColorId = state.fills[regionId] ?? null;
  if (previousColorId === colorId) return finalize(state, data);
  state.undoStack.push({ regionId, previousColorId, colorId });
  state.undoStack = state.undoStack.slice(-MAX_UNDO);
  state.fills[regionId] = colorId;
  state.selectedColorId = colorId;
  return finalize(state, data);
}

export function undoFill(inputState, data) {
  requireData(data);
  const state = clone(inputState);
  const action = state.undoStack.pop();
  if (!action) return finalize(state, data);
  if (action.previousColorId) state.fills[action.regionId] = action.previousColorId;
  else delete state.fills[action.regionId];
  return finalize(state, data);
}

export function findHiddenObject(inputState, hiddenId, data) {
  requireData(data);
  const state = clone(inputState);
  const scene = sceneMap(data).get(state.sceneId);
  if (!scene) throw new Error(`Unknown scene: ${state.sceneId}`);
  if (!scene.hiddenObjects.some((item) => item.id === hiddenId)) throw new Error(`Unknown hidden object: ${hiddenId}`);
  if (!state.foundHidden.includes(hiddenId)) state.foundHidden.push(hiddenId);
  return finalize(state, data);
}

export function resetArtwork(inputState, data) {
  requireData(data);
  const state = clone(inputState);
  state.fills = {};
  state.foundHidden = [];
  state.undoStack = [];
  state.score = 0;
  state.complete = false;
  return state;
}
