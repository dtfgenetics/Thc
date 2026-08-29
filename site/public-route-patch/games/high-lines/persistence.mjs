import {
  createExperience,
  fillRegion,
  findHiddenObject,
  isValidSceneCode,
  normalizeSceneCode,
  selectColor
} from './engine.mjs';

export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_KEY_PREFIX = 'dtf-high-lines:v1:';

export function saveKeyForCode(code) {
  const normalized = normalizeSceneCode(code);
  if (!isValidSceneCode(normalized)) throw new Error('A valid High Lines scene code is required for persistence.');
  return `${SAVE_KEY_PREFIX}${normalized}`;
}

export function experienceSavePayload(state) {
  if (!state || !isValidSceneCode(state.code)) throw new Error('A valid High Lines state is required for persistence.');
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    code: normalizeSceneCode(state.code),
    selectedColorId: state.selectedColorId,
    fills: { ...(state.fills ?? {}) },
    foundHidden: [...(state.foundHidden ?? [])]
  };
}

export function restoreExperience(payload, data) {
  if (!payload || payload.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error('Unsupported High Lines save payload.');
  const code = normalizeSceneCode(payload.code);
  if (!isValidSceneCode(code)) throw new Error('Saved High Lines scene code is invalid.');

  let state = createExperience({ code }, data);
  const scene = data.scenes.find((candidate) => candidate.id === state.sceneId);
  if (!scene) throw new Error('Saved High Lines scene no longer exists.');
  const paletteIds = new Set(data.palette.map((color) => color.id));
  const regionIds = new Set(scene.regions);
  const hiddenIds = new Set(scene.hiddenObjects.map((item) => item.id));

  if (payload.selectedColorId != null) {
    if (!paletteIds.has(payload.selectedColorId)) throw new Error('Saved High Lines color is invalid.');
    state = selectColor(state, payload.selectedColorId, data);
  }

  const fills = payload.fills ?? {};
  if (!fills || typeof fills !== 'object' || Array.isArray(fills)) throw new Error('Saved High Lines fills are invalid.');
  for (const [regionId, colorId] of Object.entries(fills)) {
    if (!regionIds.has(regionId)) throw new Error(`Saved High Lines region is invalid: ${regionId}`);
    if (!paletteIds.has(colorId)) throw new Error(`Saved High Lines fill color is invalid: ${colorId}`);
    state = fillRegion(state, regionId, colorId, data);
  }

  const foundHidden = payload.foundHidden ?? [];
  if (!Array.isArray(foundHidden) || new Set(foundHidden).size !== foundHidden.length) {
    throw new Error('Saved High Lines hidden-object list is invalid.');
  }
  for (const hiddenId of foundHidden) {
    if (!hiddenIds.has(hiddenId)) throw new Error(`Saved High Lines hidden object is invalid: ${hiddenId}`);
    state = findHiddenObject(state, hiddenId, data);
  }

  state.undoStack = [];
  return state;
}

export function hasSavedProgress(payload) {
  return Boolean(payload && (Object.keys(payload.fills ?? {}).length || (payload.foundHidden ?? []).length));
}
