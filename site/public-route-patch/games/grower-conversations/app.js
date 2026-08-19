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

function updateStatus() {
  const filtered = pool();
  const available = remaining();
  ui.status.textContent = `${available.length} unused of ${filtered.length} matching cards · ${used.size} used in this session.`;
  ui.next.disabled = filtered.length === 0;
  ui.next.textContent = available.length === 0 && filtered.length > 0 ? 'Reset and draw' : current ? 'Next prompt' : 'Draw a prompt';
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
  ui.categoryText.textContent = current.categoryLabel;
  ui.depthText.textContent = current.depth;
  ui.number.textContent = current.id.toUpperCase();
  ui.prompt.textContent = current.prompt;
  updateStatus();
  ui.prompt.focus?.({ preventScroll: true });
}

function resetUsed() {
  used.clear();
  current = null;
  ui.categoryText.textContent = 'Ready';
  ui.depthText.textContent = 'Mixed deck';
  ui.number.textContent = '96 cards';
  ui.prompt.textContent = 'Choose a topic or depth, then draw a conversation prompt.';
  updateStatus();
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

async function load() {
  try {
    const response = await fetch('./data/prompt-bank.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`prompt bank HTTP ${response.status}`);
    const bank = await response.json();
    cards = materialize(bank);
    if (cards.length !== 96 || new Set(cards.map((card) => card.id)).size !== 96) throw new Error('96-card contract mismatch');
    populateCategories();
    ui.load.textContent = `Deck ready · ${cards.length} prompts · ${Object.keys(categoryLabels).length} topics`;
    ui.controls.hidden = false;
    ui.stage.hidden = false;
    resetUsed();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'The Grower Conversations prompt bank could not be loaded.';
  }
}

ui.next.addEventListener('click', draw);
ui.reset.addEventListener('click', resetUsed);
ui.shuffle.addEventListener('click', shuffleDeck);
ui.copy.addEventListener('click', copyPrompt);
ui.category.addEventListener('change', updateStatus);
ui.depth.addEventListener('change', updateStatus);
load();
