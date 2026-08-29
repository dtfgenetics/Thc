const SCENE_CODE_LENGTH = 6;
const SCENE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_UNDO = 60;
const SAVE_SCHEMA_VERSION = 1;
const SAVE_KEY_PREFIX = 'dtf-high-lines:v1:';
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

const ui = {
  load: document.querySelector('#load-status'),
  code: document.querySelector('#scene-code'),
  newScene: document.querySelector('#new-scene'),
  share: document.querySelector('#share-scene'),
  sceneTitle: document.querySelector('#scene-title'),
  sceneDescription: document.querySelector('#scene-description'),
  prompt: document.querySelector('#creative-prompt'),
  palette: document.querySelector('#palette'),
  undo: document.querySelector('#undo-fill'),
  reset: document.querySelector('#reset-art'),
  zoomOut: document.querySelector('#zoom-out'),
  zoomIn: document.querySelector('#zoom-in'),
  zoomReset: document.querySelector('#zoom-reset'),
  zoomLevel: document.querySelector('#zoom-level'),
  art: document.querySelector('#art-mount'),
  progress: document.querySelector('#progress-fill'),
  progressText: document.querySelector('#progress-text'),
  colored: document.querySelector('#colored-stat'),
  hidden: document.querySelector('#hidden-stat'),
  score: document.querySelector('#score-stat'),
  status: document.querySelector('#activity-status'),
  hiddenList: document.querySelector('#hidden-list'),
  announce: document.querySelector('#announce')
};

let data = null;
let state = null;
let sceneById = new Map();
let colorById = new Map();
let loadedSceneId = null;
let sceneLoadToken = 0;
let restoredOnLoad = false;
let zoom = 1;
let resetArmed = false;
let resetTimer = null;

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

function requireData(payload) {
  if (!Array.isArray(payload?.palette) || !Array.isArray(payload?.scenes) || payload.palette.length < 2 || !payload.scenes.length) throw new Error('High Lines scene data is required.');
}

function sceneMap(payload) {
  return new Map(payload.scenes.map((scene) => [scene.id, scene]));
}

function paletteMap(payload) {
  return new Map(payload.palette.map((color) => [color.id, color]));
}

function normalizeSceneCode(value) {
  const allowed = new Set(SCENE_ALPHABET);
  return String(value ?? '').trim().toUpperCase().split('').filter((character) => allowed.has(character)).join('').slice(0, SCENE_CODE_LENGTH);
}

function isValidSceneCode(value) {
  return normalizeSceneCode(value).length === SCENE_CODE_LENGTH;
}

function paletteForCode(code, payload) {
  requireData(payload);
  const start = hash(`${code}:palette`) % payload.palette.length;
  return payload.palette.map((_, index) => payload.palette[(start + index) % payload.palette.length].id);
}

function scoreExperience(inputState, payload) {
  requireData(payload);
  const scene = sceneMap(payload).get(inputState.sceneId);
  if (!scene) return 0;
  const colored = scene.regions.filter((regionId) => Boolean(inputState.fills?.[regionId])).length;
  const found = scene.hiddenObjects.filter((item) => inputState.foundHidden?.includes(item.id)).length;
  const complete = colored === scene.regions.length && found === scene.hiddenObjects.length;
  return (colored * 10) + (found * 35) + (complete ? 100 : 0);
}

function progressForState(inputState, payload) {
  requireData(payload);
  const scene = sceneMap(payload).get(inputState.sceneId);
  if (!scene) return { colored: 0, totalRegions: 0, found: 0, totalHidden: 0, percent: 0, complete: false };
  const colored = scene.regions.filter((regionId) => Boolean(inputState.fills?.[regionId])).length;
  const found = scene.hiddenObjects.filter((item) => inputState.foundHidden?.includes(item.id)).length;
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

function createExperience({ code } = {}, payload) {
  requireData(payload);
  const normalized = normalizeSceneCode(code);
  if (!isValidSceneCode(normalized)) throw new Error('A six-character High Lines scene code is required.');
  const scene = payload.scenes[hash(`${normalized}:scene`) % payload.scenes.length];
  const promptIndex = hash(`${normalized}:${scene.id}:prompt`) % scene.prompts.length;
  const paletteOrder = paletteForCode(normalized, payload);
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

function finalize(inputState, payload) {
  const progress = progressForState(inputState, payload);
  inputState.score = scoreExperience(inputState, payload);
  inputState.complete = progress.complete;
  return inputState;
}

function selectColor(inputState, colorId, payload) {
  requireData(payload);
  if (!paletteMap(payload).has(colorId)) throw new Error(`Unknown palette color: ${colorId}`);
  const next = clone(inputState);
  next.selectedColorId = colorId;
  return next;
}

function fillRegion(inputState, regionId, colorId, payload) {
  requireData(payload);
  const next = clone(inputState);
  const scene = sceneMap(payload).get(next.sceneId);
  if (!scene) throw new Error(`Unknown scene: ${next.sceneId}`);
  if (!scene.regions.includes(regionId)) throw new Error(`Unknown region: ${regionId}`);
  if (!paletteMap(payload).has(colorId)) throw new Error(`Unknown palette color: ${colorId}`);
  const previousColorId = next.fills[regionId] ?? null;
  if (previousColorId === colorId) return finalize(next, payload);
  next.undoStack.push({ regionId, previousColorId, colorId });
  next.undoStack = next.undoStack.slice(-MAX_UNDO);
  next.fills[regionId] = colorId;
  next.selectedColorId = colorId;
  return finalize(next, payload);
}

function undoFill(inputState, payload) {
  requireData(payload);
  const next = clone(inputState);
  const action = next.undoStack.pop();
  if (!action) return finalize(next, payload);
  if (action.previousColorId) next.fills[action.regionId] = action.previousColorId;
  else delete next.fills[action.regionId];
  return finalize(next, payload);
}

function findHiddenObject(inputState, hiddenId, payload) {
  requireData(payload);
  const next = clone(inputState);
  const scene = sceneMap(payload).get(next.sceneId);
  if (!scene) throw new Error(`Unknown scene: ${next.sceneId}`);
  if (!scene.hiddenObjects.some((item) => item.id === hiddenId)) throw new Error(`Unknown hidden object: ${hiddenId}`);
  if (!next.foundHidden.includes(hiddenId)) next.foundHidden.push(hiddenId);
  return finalize(next, payload);
}

function resetArtwork(inputState, payload) {
  requireData(payload);
  const next = clone(inputState);
  next.fills = {};
  next.foundHidden = [];
  next.undoStack = [];
  next.score = 0;
  next.complete = false;
  return next;
}

function saveKeyForCode(code) {
  const normalized = normalizeSceneCode(code);
  if (!isValidSceneCode(normalized)) throw new Error('A valid High Lines scene code is required for persistence.');
  return `${SAVE_KEY_PREFIX}${normalized}`;
}

function experienceSavePayload(inputState) {
  if (!inputState || !isValidSceneCode(inputState.code)) throw new Error('A valid High Lines state is required for persistence.');
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    code: normalizeSceneCode(inputState.code),
    selectedColorId: inputState.selectedColorId,
    fills: { ...(inputState.fills ?? {}) },
    foundHidden: [...(inputState.foundHidden ?? [])]
  };
}

function restoreExperience(payload, sourceData) {
  if (!payload || payload.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error('Unsupported High Lines save payload.');
  const code = normalizeSceneCode(payload.code);
  if (!isValidSceneCode(code)) throw new Error('Saved High Lines scene code is invalid.');
  let next = createExperience({ code }, sourceData);
  const scene = sourceData.scenes.find((candidate) => candidate.id === next.sceneId);
  if (!scene) throw new Error('Saved High Lines scene no longer exists.');
  const paletteIds = new Set(sourceData.palette.map((color) => color.id));
  const regionIds = new Set(scene.regions);
  const hiddenIds = new Set(scene.hiddenObjects.map((item) => item.id));
  if (payload.selectedColorId != null) {
    if (!paletteIds.has(payload.selectedColorId)) throw new Error('Saved High Lines color is invalid.');
    next = selectColor(next, payload.selectedColorId, sourceData);
  }
  const fills = payload.fills ?? {};
  if (!fills || typeof fills !== 'object' || Array.isArray(fills)) throw new Error('Saved High Lines fills are invalid.');
  for (const [regionId, colorId] of Object.entries(fills)) {
    if (!regionIds.has(regionId)) throw new Error(`Saved High Lines region is invalid: ${regionId}`);
    if (!paletteIds.has(colorId)) throw new Error(`Saved High Lines fill color is invalid: ${colorId}`);
    next = fillRegion(next, regionId, colorId, sourceData);
  }
  const foundHidden = payload.foundHidden ?? [];
  if (!Array.isArray(foundHidden) || new Set(foundHidden).size !== foundHidden.length) throw new Error('Saved High Lines hidden-object list is invalid.');
  for (const hiddenId of foundHidden) {
    if (!hiddenIds.has(hiddenId)) throw new Error(`Saved High Lines hidden object is invalid: ${hiddenId}`);
    next = findHiddenObject(next, hiddenId, sourceData);
  }
  next.undoStack = [];
  return next;
}

function hasSavedProgress(payload) {
  return Boolean(payload && (Object.keys(payload.fills ?? {}).length || (payload.foundHidden ?? []).length));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function humanize(value) {
  return String(value).replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validateData(payload) {
  if (payload?.schemaVersion !== 1 || payload?.palette?.length !== 8 || payload?.scenes?.length !== 4) throw new Error('High Lines scene data contract mismatch.');
  const colorIds = new Set(payload.palette.map((color) => color.id));
  const sceneIds = new Set(payload.scenes.map((scene) => scene.id));
  if (colorIds.size !== 8 || sceneIds.size !== 4) throw new Error('High Lines data contains duplicate IDs.');
  for (const scene of payload.scenes) {
    if (!scene.asset?.endsWith('.svg') || !scene.regions?.length || scene.hiddenObjects?.length !== 3 || scene.prompts?.length !== 3) throw new Error(`${scene.id} has an invalid scene contract.`);
    if (new Set(scene.regions).size !== scene.regions.length) throw new Error(`${scene.id} contains duplicate regions.`);
  }
}

function randomCode() {
  const values = new Uint32Array(SCENE_CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  return [...values].map((number) => SCENE_ALPHABET[number % SCENE_ALPHABET.length]).join('');
}

function challengeUrl() {
  const params = new URLSearchParams({ lines: state.code });
  return `${location.origin}${location.pathname}?${params}`;
}

function replaceChallengeUrl() {
  try { globalThis.history?.replaceState?.(null, '', challengeUrl()); } catch { /* optional browser feature */ }
}

function setCode(value) {
  const normalized = normalizeSceneCode(value);
  ui.code.value = normalized;
  ui.code.setAttribute('aria-invalid', String(normalized.length > 0 && !isValidSceneCode(normalized)));
}

function currentScene() {
  return sceneById.get(state.sceneId);
}

function currentColor() {
  return colorById.get(state.selectedColorId);
}

function removeSavedExperience(code) {
  try { globalThis.localStorage?.removeItem(saveKeyForCode(code)); }
  catch (error) { console.warn('High Lines save cleanup failed.', error); }
}

function persistExperience() {
  if (!state) return;
  try {
    const payload = experienceSavePayload(state);
    const key = saveKeyForCode(state.code);
    if (hasSavedProgress(payload)) globalThis.localStorage?.setItem(key, JSON.stringify(payload));
    else globalThis.localStorage?.removeItem(key);
  } catch (error) {
    console.warn('High Lines autosave failed.', error);
  }
}

function experienceForCode(code) {
  const fresh = createExperience({ code }, data);
  try {
    const key = saveKeyForCode(fresh.code);
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return { experience: fresh, restored: false };
    const payload = JSON.parse(raw);
    return { experience: restoreExperience(payload, data), restored: hasSavedProgress(payload) };
  } catch (error) {
    console.warn('Discarding invalid High Lines save.', error);
    removeSavedExperience(fresh.code);
    return { experience: fresh, restored: false };
  }
}

function paintRegionElement(element) {
  const colorId = state.fills[element.dataset.region];
  element.style.fill = colorId ? colorById.get(colorId)?.hex ?? '' : '';
  element.dataset.colored = colorId ? 'true' : 'false';
}

function applyZoom() {
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  const svg = ui.art.querySelector('svg');
  if (svg) {
    svg.style.width = `${Math.round(zoom * 100)}%`;
    svg.style.maxHeight = 'none';
  }
  ui.zoomLevel.value = `${Math.round(zoom * 100)}%`;
  ui.zoomOut.disabled = zoom <= MIN_ZOOM;
  ui.zoomIn.disabled = zoom >= MAX_ZOOM;
}

function setZoom(nextZoom, { announce = true } = {}) {
  zoom = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom)) * 4) / 4;
  applyZoom();
  if (announce) ui.announce.textContent = `Board zoom ${Math.round(zoom * 100)} percent.`;
}

function decorateSvg(svg) {
  const scene = currentScene();
  svg.classList.add('high-lines-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  for (const element of svg.querySelectorAll('[data-region]')) {
    const regionId = element.dataset.region;
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', `Color ${humanize(regionId)} with ${currentColor()?.label ?? 'selected color'}`);
    paintRegionElement(element);
  }
  for (const element of svg.querySelectorAll('[data-hidden]')) {
    const hiddenId = element.dataset.hidden;
    const found = state.foundHidden.includes(hiddenId);
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', found ? '-1' : '0');
    element.setAttribute('aria-label', found ? 'Hidden bonus already found' : 'Hidden bonus object');
    element.dataset.found = String(found);
    element.style.opacity = found ? '0.28' : '';
    if (found) element.style.pointerEvents = 'none';
  }
  svg.addEventListener('click', handleArtActivation);
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest?.('[data-hidden],[data-region]');
    if (!target) return;
    event.preventDefault();
    activateTarget(target);
  });
  ui.art.replaceChildren(svg);
  if (scene) ui.art.setAttribute('aria-label', `${scene.title} interactive coloring board`);
  applyZoom();
}

async function fetchSceneText(asset) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(`./${asset}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Scene SVG HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
  }
  throw lastError ?? new Error('Scene SVG could not load.');
}

async function loadSceneAsset() {
  const requestToken = ++sceneLoadToken;
  const scene = currentScene();
  if (!scene) throw new Error('High Lines scene definition is missing.');
  const requestedSceneId = scene.id;
  try {
    const text = await fetchSceneText(scene.asset);
    if (requestToken !== sceneLoadToken || !state || state.sceneId !== requestedSceneId) return;
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('Scene SVG could not be parsed.');
    const svg = doc.documentElement;
    if (svg.localName !== 'svg' || svg.querySelector('script, foreignObject')) throw new Error('Scene SVG failed the safe-inline contract.');
    if (requestToken !== sceneLoadToken || state.sceneId !== requestedSceneId) return;
    loadedSceneId = requestedSceneId;
    decorateSvg(document.importNode(svg, true));
  } catch (error) {
    if (requestToken !== sceneLoadToken || !state || state.sceneId !== requestedSceneId) return;
    throw error;
  }
}

function renderPalette() {
  ui.palette.replaceChildren();
  state.paletteOrder.forEach((colorId, index) => {
    const color = colorById.get(colorId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch-button';
    button.dataset.color = color.id;
    button.setAttribute('aria-pressed', String(color.id === state.selectedColorId));
    button.setAttribute('aria-label', `${index + 1}. ${color.label}`);
    button.innerHTML = `<span class="swatch" style="--swatch:${escapeHtml(color.hex)}" aria-hidden="true"></span><span>${escapeHtml(color.label)}</span><kbd>${index + 1}</kbd>`;
    ui.palette.append(button);
  });
}

function renderHiddenList() {
  const scene = currentScene();
  ui.hiddenList.replaceChildren();
  for (const item of scene.hiddenObjects) {
    const found = state.foundHidden.includes(item.id);
    const li = document.createElement('li');
    li.className = found ? 'found' : '';
    li.innerHTML = `<span aria-hidden="true">${found ? '✓' : '?'}</span><div><strong>${found ? escapeHtml(item.label) : 'Hidden object'}</strong><small>${found ? 'Found' : 'Still hiding in the line art'}</small></div>`;
    ui.hiddenList.append(li);
  }
}

function renderStats() {
  const progress = progressForState(state, data);
  ui.progress.style.width = `${progress.percent}%`;
  ui.progressText.textContent = `${progress.percent}%`;
  ui.colored.textContent = `${progress.colored} / ${progress.totalRegions}`;
  ui.hidden.textContent = `${progress.found} / ${progress.totalHidden}`;
  ui.score.textContent = String(state.score);
  ui.undo.disabled = state.undoStack.length === 0;
  document.body.classList.toggle('scene-complete', progress.complete);
  if (progress.complete) {
    ui.status.className = 'activity-status complete';
    ui.status.innerHTML = `<span>SCENE COMPLETE</span><strong>${escapeHtml(currentScene().title)} finished at ${state.score} points.</strong><p>Progress is saved on this device. Try another scene code for a different drawing, prompt, and palette order.</p>`;
  } else {
    ui.status.className = 'activity-status';
    ui.status.innerHTML = '<span>ACTIVITY RUN</span><strong>Color every region and find all three bonuses.</strong><p>Progress autosaves on this device. Recoloring is free; only unique colored regions and hidden finds add progress.</p>';
  }
}

function renderSceneCopy() {
  const scene = currentScene();
  ui.sceneTitle.textContent = scene.title;
  ui.sceneDescription.textContent = scene.description;
  ui.prompt.innerHTML = `<span>CREATIVE PROMPT</span><strong>${escapeHtml(state.prompt)}</strong>`;
}

function refreshSvgState() {
  const svg = ui.art.querySelector('svg');
  if (!svg || loadedSceneId !== state.sceneId) return;
  for (const element of svg.querySelectorAll('[data-region]')) {
    paintRegionElement(element);
    element.setAttribute('aria-label', `Color ${humanize(element.dataset.region)} with ${currentColor()?.label ?? 'selected color'}`);
  }
  for (const element of svg.querySelectorAll('[data-hidden]')) {
    const found = state.foundHidden.includes(element.dataset.hidden);
    element.dataset.found = String(found);
    element.setAttribute('tabindex', found ? '-1' : '0');
    element.setAttribute('aria-label', found ? 'Hidden bonus already found' : 'Hidden bonus object');
    element.style.opacity = found ? '0.28' : '';
    element.style.pointerEvents = found ? 'none' : '';
  }
  applyZoom();
}

function render({ reloadAsset = false } = {}) {
  setCode(state.code);
  renderSceneCopy();
  renderPalette();
  renderHiddenList();
  renderStats();
  if (reloadAsset || loadedSceneId !== state.sceneId) loadSceneAsset().catch(handleLoadError);
  else refreshSvgState();
}

function activateTarget(target) {
  if (!state) return;
  try {
    const hidden = target.closest?.('[data-hidden]');
    if (hidden) {
      const hiddenId = hidden.dataset.hidden;
      if (state.foundHidden.includes(hiddenId)) return;
      const item = currentScene().hiddenObjects.find((candidate) => candidate.id === hiddenId);
      state = findHiddenObject(state, hiddenId, data);
      persistExperience();
      render();
      ui.announce.textContent = `${item?.label ?? 'Hidden object'} found. ${state.score} points. Progress saved.`;
      return;
    }
    const region = target.closest?.('[data-region]');
    if (!region) return;
    state = fillRegion(state, region.dataset.region, state.selectedColorId, data);
    persistExperience();
    render();
    ui.announce.textContent = `${humanize(region.dataset.region)} colored ${currentColor().label}. Progress saved.`;
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
  }
}

function handleArtActivation(event) {
  const target = event.target.closest?.('[data-hidden],[data-region]');
  if (target) activateTarget(target);
}

function disarmReset() {
  resetArmed = false;
  window.clearTimeout(resetTimer);
  resetTimer = null;
  ui.reset.classList.remove('reset-armed');
  ui.reset.textContent = 'Reset Artwork';
}

ui.palette.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-color]');
  if (!button) return;
  state = selectColor(state, button.dataset.color, data);
  persistExperience();
  renderPalette();
  refreshSvgState();
  ui.announce.textContent = `${currentColor().label} selected.`;
});

ui.undo.addEventListener('click', () => {
  state = undoFill(state, data);
  persistExperience();
  render();
  ui.announce.textContent = 'Last fill undone. Progress saved.';
});

ui.reset.addEventListener('click', () => {
  const progress = progressForState(state, data);
  if ((progress.colored > 0 || progress.found > 0) && !resetArmed) {
    resetArmed = true;
    ui.reset.classList.add('reset-armed');
    ui.reset.textContent = 'Confirm Reset';
    resetTimer = window.setTimeout(disarmReset, 4500);
    ui.announce.textContent = 'Reset will erase this scene code’s saved artwork. Press Confirm Reset to continue.';
    return;
  }
  state = resetArtwork(state, data);
  removeSavedExperience(state.code);
  disarmReset();
  render();
  ui.announce.textContent = 'Artwork and saved progress reset for this scene code.';
});

ui.zoomOut.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
ui.zoomIn.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
ui.zoomReset.addEventListener('click', () => setZoom(1));

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidSceneCode(ui.code.value)) {
    ui.announce.textContent = 'Enter a complete six-character High Lines scene code.';
    return;
  }
  const requested = normalizeSceneCode(ui.code.value);
  if (requested === state.code) {
    ui.announce.textContent = `Scene ${state.code} is already loaded.`;
    return;
  }
  resetExperience(requested);
});

ui.newScene.addEventListener('click', () => resetExperience(randomCode()));

ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `High Lines · ${currentScene().title} · code ${state.code}\n${url}`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'High Lines scene challenge copied.';
  } catch {
    ui.announce.textContent = `Share scene code ${state.code}: ${url}`;
  }
});

function shortcutTarget(target) {
  return typeof Element !== 'undefined' && target instanceof Element && Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"], [data-region], [data-hidden]'));
}

document.addEventListener('keydown', (event) => {
  if (shortcutTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey || !state) return;
  if (/^[1-8]$/.test(event.key)) {
    const colorId = state.paletteOrder[Number(event.key) - 1];
    if (!colorId) return;
    event.preventDefault();
    state = selectColor(state, colorId, data);
    persistExperience();
    renderPalette();
    refreshSvgState();
    ui.announce.textContent = `${currentColor().label} selected.`;
    return;
  }
  if ((event.key === 'u' || event.key === 'U') && state.undoStack.length) {
    event.preventDefault();
    ui.undo.click();
  }
});

function resetExperience(code) {
  disarmReset();
  const loaded = experienceForCode(code);
  state = loaded.experience;
  restoredOnLoad = loaded.restored;
  loadedSceneId = null;
  zoom = 1;
  replaceChallengeUrl();
  ui.art.innerHTML = '<div class="art-loading" aria-hidden="true"><span></span><strong>Drawing scene…</strong></div>';
  render({ reloadAsset: true });
  ui.announce.textContent = loaded.restored ? `${currentScene().title} restored from saved progress for scene code ${state.code}.` : `${currentScene().title} loaded with scene code ${state.code}.`;
}

function handleLoadError(error) {
  console.error(error);
  ui.art.innerHTML = '<div class="art-error"><strong>Scene artwork could not load.</strong><span>Try a new scene code or reload the page.</span></div>';
  ui.announce.textContent = error instanceof Error ? error.message : String(error);
}

function load() {
  try {
    const embedded = document.querySelector('#high-lines-data');
    if (!embedded?.textContent) throw new Error('Embedded High Lines data is missing.');
    data = JSON.parse(embedded.textContent);
    validateData(data);
    sceneById = new Map(data.scenes.map((scene) => [scene.id, scene]));
    colorById = new Map(data.palette.map((color) => [color.id, color]));
    const requested = normalizeSceneCode(new URLSearchParams(location.search).get('lines'));
    const code = isValidSceneCode(requested) ? requested : randomCode();
    const loaded = experienceForCode(code);
    state = loaded.experience;
    restoredOnLoad = loaded.restored;
    replaceChallengeUrl();
    ui.load.textContent = loaded.restored ? 'Saved progress restored · local autosave active' : 'Ready · 4 scenes · autosave · zoomable board';
    render({ reloadAsset: true });
    if (restoredOnLoad) ui.announce.textContent = `Saved progress restored for ${currentScene().title}.`;
  } catch (error) {
    handleLoadError(error);
    ui.load.textContent = 'High Lines could not initialize.';
  }
}

window.addEventListener('pagehide', () => window.clearTimeout(resetTimer));
load();
