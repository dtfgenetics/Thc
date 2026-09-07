const SESSION_KEY = 'dtf-grower-conversations-session-v1';

const ui = {
  load: document.querySelector('#load-status'),
  controls: document.querySelector('#controls'),
  stage: document.querySelector('#card-stage'),
  category: document.querySelector('#category-filter'),
  depth: document.querySelector('#depth-filter'),
  shuffle: document.querySelector('#shuffle-deck'),
  next: document.querySelector('#next-card'),
  copy: document.querySelector('#copy-card'),
  reset: document.querySelector('#reset-deck'),
  categoryText: document.querySelector('#card-category'),
  depthText: document.querySelector('#card-depth'),
  number: document.querySelector('#card-number'),
  prompt: document.querySelector('#card-prompt'),
  status: document.querySelector('#deck-status'),
  remaining: document.querySelector('#remaining-stat'),
  used: document.querySelector('#used-stat'),
  pool: document.querySelector('#pool-stat'),
  progress: document.querySelector('#deck-progress-fill'),
  progressRail: document.querySelector('#deck-progress')
};

let cards = [];
let used = new Set();
let current = null;

const categoryLabels = {
  'origin-story': 'Origin Story',
  'plant-observation': 'Plant Observation',
  environment: 'Environment',
  'problem-solving': 'Problem Solving',
  genetics: 'Genetics & Selection',
  'harvest-quality': 'Harvest & Quality',
  community: 'Community',
  future: 'Future of Cultivation'
};

function readEmbeddedBank() {
  const node = document.querySelector('#grower-conversations-data');
  if (!node) throw new Error('Embedded Grower Conversations data is missing.');
  const bank = JSON.parse(node.textContent || '{}');
  if (bank?.schemaVersion !== 1 || bank?.cardCount !== 96 || !bank?.categories || typeof bank.categories !== 'object') {
    throw new Error('Grower Conversations data contract mismatch.');
  }
  const categoryIds = Object.keys(bank.categories);
  if (categoryIds.length !== 8) throw new Error('Grower Conversations requires eight topics.');
  for (const category of categoryIds) {
    if (!Array.isArray(bank.categories[category]) || bank.categories[category].length !== 12) {
      throw new Error(`${category} must contain twelve prompts.`);
    }
  }
  return bank;
}

function materialize(bank) {
  const result = [];
  for (const [category, prompts] of Object.entries(bank.categories)) {
    prompts.forEach((prompt, index) => {
      const depth = index < 4 ? 'easy' : index < 8 ? 'reflective' : 'technical';
      result.push({
        id: `gc-${category}-${String(index + 1).padStart(2, '0')}`,
        category,
        categoryLabel: categoryLabels[category] || category,
        depth,
        prompt
      });
    });
  }
  return result;
}

function matchesActiveFilters(card) {
  if (!card) return false;
  if (ui.category.value !== 'all' && card.category !== ui.category.value) return false;
  if (ui.depth.value !== 'all' && card.depth !== ui.depth.value) return false;
  return true;
}

function pool() {
  return cards.filter(matchesActiveFilters);
}

function remaining() {
  return pool().filter((card) => !used.has(card.id));
}

function saveSession() {
  try {
    globalThis.localStorage?.setItem(SESSION_KEY, JSON.stringify({
      version: 1,
      category: ui.category.value,
      depth: ui.depth.value,
      used: [...used],
      currentId: current?.id || null
    }));
  } catch (error) {
    console.warn('Grower Conversations session persistence unavailable.', error);
  }
}

function readSession() {
  try {
    const payload = JSON.parse(globalThis.localStorage?.getItem(SESSION_KEY) || 'null');
    return payload?.version === 1 ? payload : null;
  } catch {
    return null;
  }
}

function updateStatus() {
  const filtered = pool();
  const available = filtered.filter((card) => !used.has(card.id));
  const usedMatching = filtered.length - available.length;
  const completion = filtered.length ? Math.round((usedMatching / filtered.length) * 100) : 0;
  ui.status.textContent = `${available.length} unused of ${filtered.length} matching cards · ${usedMatching} used in this view · progress saved on this device.`;
  ui.remaining.textContent = String(available.length);
  ui.used.textContent = String(usedMatching);
  ui.pool.textContent = String(filtered.length);
  ui.progress.style.width = `${completion}%`;
  ui.progressRail.setAttribute('aria-valuenow', String(usedMatching));
  ui.progressRail.setAttribute('aria-valuemax', String(Math.max(1, filtered.length)));
  ui.next.disabled = filtered.length === 0;
  ui.next.textContent = available.length === 0 && filtered.length > 0 ? 'Reset and draw' : current ? 'Next prompt' : 'Draw a prompt';
}

function renderCurrent() {
  ui.copy.disabled = !current;
  ui.stage.classList.toggle('has-card', Boolean(current));
  if (!current) {
    document.documentElement.removeAttribute('data-depth');
    document.documentElement.removeAttribute('data-category');
    ui.categoryText.textContent = 'Ready';
    ui.depthText.textContent = 'Mixed deck';
    ui.number.textContent = '96 cards';
    ui.prompt.textContent = 'Choose a topic or depth, then draw a conversation prompt.';
    return;
  }
  document.documentElement.dataset.depth = current.depth;
  document.documentElement.dataset.category = current.category;
  ui.categoryText.textContent = current.categoryLabel;
  ui.depthText.textContent = current.depth;
  ui.number.textContent = current.id.toUpperCase();
  ui.prompt.textContent = current.prompt;
}

function safeFocus(element) {
  if (!element?.focus) return;
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  try { element.focus({ preventScroll: true }); }
  catch { element.focus(); }
}

function animateDraw() {
  const card = document.querySelector('#prompt-card');
  if (!card) return;
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;
  card.classList.remove('draw-pop');
  requestAnimationFrame(() => card.classList.add('draw-pop'));
}

function syncCurrentToFilters() {
  if (current && !matchesActiveFilters(current)) current = null;
  renderCurrent();
  updateStatus();
  saveSession();
}

function draw() {
  let available = remaining();
  if (!available.length) {
    const filteredIds = new Set(pool().map((card) => card.id));
    for (const id of [...used]) if (filteredIds.has(id)) used.delete(id);
    available = remaining();
  }
  if (!available.length) return;
  current = available[Math.floor(Math.random() * available.length)];
  used.add(current.id);
  renderCurrent();
  updateStatus();
  saveSession();
  animateDraw();
  safeFocus(ui.prompt);
}

function resetUsed() {
  used.clear();
  current = null;
  renderCurrent();
  updateStatus();
  saveSession();
}

function shuffleDeck() {
  used.clear();
  current = null;
  draw();
}

async function copyPrompt() {
  if (!current) return;
  const text = `${current.prompt}\n\n— Grower Conversations · DTF Genetics`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
    await navigator.clipboard.writeText(text);
    ui.copy.textContent = 'Copied';
    ui.status.textContent = 'Prompt copied to clipboard.';
    setTimeout(() => {
      ui.copy.textContent = 'Copy prompt';
      updateStatus();
    }, 1300);
  } catch {
    ui.status.textContent = 'Clipboard access was blocked by the browser. Select the prompt text to copy it manually.';
  }
}

function populateCategories() {
  for (const category of Object.keys(categoryLabels)) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = categoryLabels[category];
    ui.category.append(option);
  }
}

function restoreSession() {
  const payload = readSession();
  if (!payload) return resetUsed();
  const validIds = new Set(cards.map((card) => card.id));
  used = new Set((Array.isArray(payload.used) ? payload.used : []).filter((id) => validIds.has(id)));
  if (payload.category === 'all' || Object.hasOwn(categoryLabels, payload.category)) ui.category.value = payload.category;
  if (['all', 'easy', 'reflective', 'technical'].includes(payload.depth)) ui.depth.value = payload.depth;
  current = cards.find((card) => card.id === payload.currentId) || null;
  if (current && !matchesActiveFilters(current)) current = null;
  renderCurrent();
  updateStatus();
  saveSession();
}

function installKeyboardHints() {
  ui.next.setAttribute('aria-keyshortcuts', 'D N');
  ui.copy.setAttribute('aria-keyshortcuts', 'C');
  ui.shuffle.setAttribute('aria-keyshortcuts', 'S');
}

function load() {
  try {
    const bank = readEmbeddedBank();
    cards = materialize(bank);
    if (cards.length !== 96 || new Set(cards.map((card) => card.id)).size !== 96) throw new Error('96-card contract mismatch');
    populateCategories();
    installKeyboardHints();
    ui.load.textContent = `Deck ready · ${cards.length} prompts · ${Object.keys(categoryLabels).length} topics · progress saved · D/N draw · C copy · S shuffle`;
    ui.controls.hidden = false;
    ui.stage.hidden = false;
    restoreSession();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'The Grower Conversations prompt bank could not be loaded.';
  }
}

ui.next.addEventListener('click', draw);
ui.reset.addEventListener('click', resetUsed);
ui.shuffle.addEventListener('click', shuffleDeck);
ui.copy.addEventListener('click', copyPrompt);
ui.category.addEventListener('change', syncCurrentToFilters);
ui.depth.addEventListener('change', syncCurrentToFilters);
document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === 'd' || key === 'n') {
    event.preventDefault();
    draw();
  } else if (key === 'c' && current) {
    event.preventDefault();
    copyPrompt();
  } else if (key === 's') {
    event.preventDefault();
    shuffleDeck();
  }
});

load();
