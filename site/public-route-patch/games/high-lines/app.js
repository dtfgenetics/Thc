import {
  SCENE_ALPHABET,
  createExperience,
  fillRegion,
  findHiddenObject,
  isValidSceneCode,
  normalizeSceneCode,
  progressForState,
  resetArtwork,
  selectColor,
  undoFill
} from './engine.mjs';
import {
  experienceSavePayload,
  hasSavedProgress,
  restoreExperience,
  saveKeyForCode
} from './persistence.mjs';

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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function humanize(value) {
  return String(value).replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return [...values].map((number) => SCENE_ALPHABET[number % SCENE_ALPHABET.length]).join('');
}

function challengeUrl() {
  const params = new URLSearchParams({ lines: state.code });
  return `${location.origin}${location.pathname}?${params}`;
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
  try {
    localStorage.removeItem(saveKeyForCode(code));
  } catch (error) {
    console.warn('High Lines save cleanup failed.', error);
  }
}

function persistExperience() {
  if (!state) return;
  try {
    const payload = experienceSavePayload(state);
    const key = saveKeyForCode(state.code);
    if (hasSavedProgress(payload)) localStorage.setItem(key, JSON.stringify(payload));
    else localStorage.removeItem(key);
  } catch (error) {
    console.warn('High Lines autosave failed.', error);
  }
}

function experienceForCode(code) {
  const fresh = createExperience({ code }, data);
  try {
    const key = saveKeyForCode(fresh.code);
    const raw = localStorage.getItem(key);
    if (!raw) return { experience: fresh, restored: false };
    const payload = JSON.parse(raw);
    const restored = restoreExperience(payload, data);
    return { experience: restored, restored: hasSavedProgress(payload) };
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
}

async function loadSceneAsset() {
  const requestToken = ++sceneLoadToken;
  const scene = currentScene();
  if (!scene) throw new Error('High Lines scene definition is missing.');
  const requestedSceneId = scene.id;

  try {
    const response = await fetch(`./${scene.asset}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Scene SVG HTTP ${response.status}`);
    const text = await response.text();
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
    ui.announce.textContent = error.message;
  }
}

function handleArtActivation(event) {
  const target = event.target.closest?.('[data-hidden],[data-region]');
  if (target) activateTarget(target);
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
  state = resetArtwork(state, data);
  removeSavedExperience(state.code);
  render();
  ui.announce.textContent = 'Artwork and saved progress reset for this scene code.';
});

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidSceneCode(ui.code.value)) {
    ui.announce.textContent = 'Enter a complete six-character High Lines scene code.';
    return;
  }
  resetExperience(ui.code.value);
});

ui.newScene.addEventListener('click', () => resetExperience(randomCode()));

ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `High Lines · ${currentScene().title} · code ${state.code}\n${url}`;
  try {
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'High Lines scene challenge copied.';
  } catch {
    ui.announce.textContent = `Share scene code ${state.code}: ${url}`;
  }
});

function shortcutTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"], [data-region], [data-hidden]'));
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
  const loaded = experienceForCode(code);
  state = loaded.experience;
  restoredOnLoad = loaded.restored;
  loadedSceneId = null;
  window.history.replaceState(null, '', challengeUrl());
  render({ reloadAsset: true });
  ui.announce.textContent = loaded.restored
    ? `${currentScene().title} restored from saved progress for scene code ${state.code}.`
    : `${currentScene().title} loaded with scene code ${state.code}.`;
}

function handleLoadError(error) {
  console.error(error);
  ui.art.innerHTML = '<div class="art-error"><strong>Scene artwork could not load.</strong><span>Try a new scene code or reload the page.</span></div>';
  ui.announce.textContent = error.message;
}

async function load() {
  try {
    const response = await fetch('./data/scenes.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`High Lines data HTTP ${response.status}`);
    data = await response.json();
    if (data.schemaVersion !== 1 || data.palette?.length !== 8 || data.scenes?.length !== 4) {
      throw new Error('High Lines scene data contract mismatch.');
    }
    sceneById = new Map(data.scenes.map((scene) => [scene.id, scene]));
    colorById = new Map(data.palette.map((color) => [color.id, color]));
    const requested = normalizeSceneCode(new URLSearchParams(location.search).get('lines'));
    const code = isValidSceneCode(requested) ? requested : randomCode();
    const loaded = experienceForCode(code);
    state = loaded.experience;
    restoredOnLoad = loaded.restored;
    window.history.replaceState(null, '', challengeUrl());
    ui.load.textContent = loaded.restored
      ? 'Saved progress restored · local autosave active'
      : '4 original scenes · local autosave active · 12 hidden bonuses';
    render({ reloadAsset: true });
    if (restoredOnLoad) ui.announce.textContent = `Saved progress restored for ${currentScene().title}.`;
  } catch (error) {
    handleLoadError(error);
    ui.load.textContent = 'High Lines could not load its scene data.';
  }
}

load();
