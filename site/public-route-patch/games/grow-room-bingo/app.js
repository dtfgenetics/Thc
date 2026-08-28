import { CARD_CODE_ALPHABET, isValidCardCode, normalizeCardCode } from './code-utils.mjs';

const board = document.querySelector('#board');
const modesEl = document.querySelector('#modes');
const titleEl = document.querySelector('#title');
const descEl = document.querySelector('#description');
const codeInput = document.querySelector('#code');
const codeReadout = document.querySelector('#code-readout');
const markedEl = document.querySelector('#marked');
const linesEl = document.querySelector('#lines');
const bestEl = document.querySelector('#best');
const announce = document.querySelector('#announce');

let data;
let mode = 'grow-room';
let code = '';
let cells = [];
let marked = new Set([12]);

function hash(value) {
  let h = 2166136261;
  for (const character of value) {
    h ^= character.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return [...values].map((number) => CARD_CODE_ALPHABET[number % CARD_CODE_ALPHABET.length]).join('');
}

function pool() {
  return mode === 'mixed' ? data.prompts : data.prompts.filter((prompt) => prompt.mode === mode);
}

function makeCard(seedCode) {
  const random = rng(hash(`${mode}:${seedCode}`));
  const items = [...pool()];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, 24);
}

const patterns = [
  ...[0, 1, 2, 3, 4].map((row) => [0, 1, 2, 3, 4].map((col) => row * 5 + col)),
  ...[0, 1, 2, 3, 4].map((col) => [0, 1, 2, 3, 4].map((row) => row * 5 + col)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];

function wins() {
  return patterns.filter((pattern) => pattern.every((index) => marked.has(index)));
}

function bestKey() {
  return `dtf-bingo-best-${mode}`;
}

function readBest() {
  try {
    return Number(localStorage.getItem(bestKey()) || 0);
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(bestKey(), String(value));
  } catch {}
}

function update() {
  const completed = wins();
  markedEl.textContent = `${marked.size} / 25`;
  linesEl.textContent = String(completed.length);
  const nextBest = Math.max(readBest(), completed.length);
  writeBest(nextBest);
  bestEl.textContent = String(nextBest);
  board.querySelectorAll('.cell').forEach((element, index) => {
    element.classList.toggle('line', completed.some((pattern) => pattern.includes(index)));
  });
  announce.textContent = completed.length
    ? `BINGO! ${completed.length} completed line${completed.length === 1 ? '' : 's'}.`
    : 'Mark a square when it happens.';
}

function render() {
  board.replaceChildren();
  let promptIndex = 0;
  for (let index = 0; index < 25; index += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell';
    if (index === 12) {
      button.textContent = 'FREE · DTF';
      button.classList.add('free');
      button.disabled = true;
      button.setAttribute('aria-pressed', 'true');
    } else {
      const prompt = cells[promptIndex++];
      button.textContent = prompt.text;
      button.setAttribute('aria-pressed', String(marked.has(index)));
      button.addEventListener('click', () => {
        if (marked.has(index)) marked.delete(index);
        else marked.add(index);
        button.setAttribute('aria-pressed', String(marked.has(index)));
        update();
      });
    }
    board.append(button);
  }
  update();
}

function loadCard(nextCode) {
  const normalized = normalizeCardCode(nextCode);
  if (!isValidCardCode(normalized)) return false;
  code = normalized;
  codeInput.value = code;
  codeInput.setAttribute('aria-invalid', 'false');
  codeReadout.textContent = code;
  cells = makeCard(code);
  marked = new Set([12]);
  render();
  history.replaceState(null, '', `?mode=${encodeURIComponent(mode)}&card=${encodeURIComponent(code)}`);
  return true;
}

function loadEnteredCode() {
  const normalized = normalizeCardCode(codeInput.value);
  if (!isValidCardCode(normalized)) {
    codeInput.setAttribute('aria-invalid', 'true');
    announce.textContent = 'Enter a complete 6-character card code.';
    codeInput.focus();
    return;
  }
  loadCard(normalized);
}

function selectMode(id) {
  mode = id;
  const selected = data.modes.find((item) => item.id === id) || data.modes[0];
  titleEl.textContent = selected.title;
  descEl.textContent = selected.description;
  modesEl.querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  loadCard(code || randomCode());
}

function renderModes() {
  for (const item of data.modes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode-btn';
    button.dataset.mode = item.id;
    button.textContent = item.title;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectMode(item.id));
    modesEl.append(button);
  }
}

document.querySelector('#new').addEventListener('click', () => loadCard(randomCode()));
document.querySelector('#load').addEventListener('click', loadEnteredCode);
codeInput.addEventListener('input', () => {
  codeInput.value = normalizeCardCode(codeInput.value);
  codeInput.setAttribute('aria-invalid', String(codeInput.value.length > 0 && !isValidCardCode(codeInput.value)));
});
codeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loadEnteredCode();
});
document.querySelector('#copy').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?mode=${encodeURIComponent(mode)}&card=${encodeURIComponent(code)}`;
  const text = `Grow Room Bingo card ${code} · mode ${mode}\n${url}`;
  try {
    await navigator.clipboard.writeText(text);
    announce.textContent = 'Card code and link copied.';
  } catch {
    announce.textContent = `Share card code: ${code}`;
  }
});

fetch('./data/prompts.json', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`Prompt data failed (${response.status})`);
    return response.json();
  })
  .then((loaded) => {
    data = loaded;
    renderModes();
    const params = new URLSearchParams(location.search);
    const requestedMode = params.get('mode');
    mode = data.modes.some((item) => item.id === requestedMode) ? requestedMode : 'grow-room';
    const requestedCode = normalizeCardCode(params.get('card'));
    code = isValidCardCode(requestedCode) ? requestedCode : randomCode();
    selectMode(mode);
  })
  .catch((error) => {
    board.innerHTML = `<p role="alert">Bingo could not load. ${String(error.message)}</p>`;
    console.error(error);
  });
