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
  status: document.querySelector('#deck-status')
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

function pool() {
  return cards.filter((card) => {
    if (ui.category.value !== 'all' && card.category !== ui.category.value) return false;
    if (ui.depth.value !== 'all' && card.depth !== ui.depth.value) return false;
    return true;
  });
}

function remaining() {
  return pool().filter((card) => !used.has(card.id));
}

function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
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
    const payload = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return payload?.version === 1 ? payload : null;
  } catch {
    return null;
  }
}

function updateStatus() {
  const filtered = pool();
  const available = remaining();
  ui.status.textContent = `${available.length} unused of ${filtered.length} matching cards · ${used.size} used · progress saved on this device.`;
  ui.next.disabled = filtered.length === 0;
  ui.next.textContent = available.length === 0 && filtered.length > 0 ? 'Reset and draw' : current ? 'Next prompt' : 'Draw a prompt';
}

function renderCurrent() {
  if (!current) {
    ui.categoryText.textContent = 'Ready';
    ui.depthText.textContent = 'Mixed deck';
    ui.number.textContent = '96 cards';
    ui.prompt.textContent = 'Choose a topic or depth, then draw a conversation prompt.';
    return;
  }
  ui.categoryText.textContent = current.categoryLabel;
  ui.depthText.textContent = current.depth;
  ui.number.textContent = current.id.toUpperCase();
  ui.prompt.textContent = current.prompt;
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
  ui.prompt.focus?.({ preventScroll: true });
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
    await navigator.clipboard.writeText(text);
    ui.copy.textContent = 'Copied';
    setTimeout(() => { ui.copy.textContent = 'Copy prompt'; }, 1300);
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
  renderCurrent();
  updateStatus();
  saveSession();
}

async function load() {
  try {
    const response = await fetch('./data/prompt-bank.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`prompt bank HTTP ${response.status}`);
    const bank = await response.json();
    cards = materialize(bank);
    if (cards.length !== 96 || new Set(cards.map((card) => card.id)).size !== 96) throw new Error('96-card contract mismatch');
    populateCategories();
    ui.load.textContent = `Deck ready · ${cards.length} prompts · ${Object.keys(categoryLabels).length} topics · session progress enabled`;
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
ui.category.addEventListener('change', () => { updateStatus(); saveSession(); });
ui.depth.addEventListener('change', () => { updateStatus(); saveSession(); });
load();
