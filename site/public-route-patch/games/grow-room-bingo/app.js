const CARD_CODE_LENGTH = 6;
const CARD_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SAVE_VERSION = 1;
const SAVE_PREFIX = 'dtf-bingo-card-v1:';

function normalizeCardCode(value) {
  const allowed = new Set(CARD_CODE_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, CARD_CODE_LENGTH);
}

function isValidCardCode(value) {
  return normalizeCardCode(value).length === CARD_CODE_LENGTH;
}

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
const newButton = document.querySelector('#new');
const copyButton = document.querySelector('#copy');

const clearButton = document.createElement('button');
clearButton.id = 'clear-marks';
clearButton.type = 'button';
clearButton.textContent = 'Clear marks';
copyButton.parentNode.insertBefore(clearButton, copyButton);

let data;
let mode = 'grow-room';
let code = '';
let cells = [];
let marked = new Set([12]);
let clearArmedUntil = 0;
let clearResetTimer = null;

function readEmbeddedData() {
  const node = document.querySelector('#bingo-data');
  if (!node) throw new Error('Embedded bingo data is missing.');
  const parsed = JSON.parse(node.textContent || '{}');
  if (!Array.isArray(parsed.modes) || parsed.modes.length < 1) throw new Error('Bingo modes are unavailable.');
  if (!Array.isArray(parsed.prompts) || parsed.prompts.length < 24) throw new Error('Bingo prompt data is incomplete.');
  for (const item of parsed.modes) {
    if (!item?.id || !item?.title) throw new Error('Bingo mode data is invalid.');
    if (item.id !== 'mixed') {
      const count = parsed.prompts.filter((prompt) => prompt.mode === item.id && prompt.text).length;
      if (count < 24) throw new Error(`${item.title} needs at least 24 prompts.`);
    }
  }
  return parsed;
}

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
  const values = new Uint32Array(CARD_CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  }
  return [...values].map((number) => CARD_CODE_ALPHABET[number % CARD_CODE_ALPHABET.length]).join('');
}

function pool() {
  return mode === 'mixed' ? data.prompts : data.prompts.filter((prompt) => prompt.mode === mode);
}

function makeCard(seedCode) {
  const random = rng(hash(`${mode}:${seedCode}`));
  const items = [...pool()];
  if (items.length < 24) throw new Error(`Not enough prompts are available for ${mode}.`);
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
    const value = Number(globalThis.localStorage?.getItem(bestKey()) || 0);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try { globalThis.localStorage?.setItem(bestKey(), String(value)); } catch {}
}

function saveKey(cardMode = mode, cardCode = code) {
  return `${SAVE_PREFIX}${cardMode}:${cardCode}`;
}

function validMarkedIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < 25;
}

function readSavedMarks(cardMode = mode, cardCode = code) {
  try {
    const raw = globalThis.localStorage?.getItem(saveKey(cardMode, cardCode));
    if (!raw) return { marks: new Set([12]), restored: false };
    const payload = JSON.parse(raw);
    if (payload?.version !== SAVE_VERSION || payload.mode !== cardMode || payload.code !== cardCode || !Array.isArray(payload.marked)) {
      throw new Error('Saved bingo card is invalid.');
    }
    const unique = [...new Set(payload.marked)];
    if (unique.some((index) => !validMarkedIndex(index))) throw new Error('Saved bingo marks are invalid.');
    const marks = new Set(unique);
    marks.add(12);
    return { marks, restored: marks.size > 1 };
  } catch (error) {
    console.warn('Discarding invalid bingo save.', error);
    try { globalThis.localStorage?.removeItem(saveKey(cardMode, cardCode)); } catch {}
    return { marks: new Set([12]), restored: false };
  }
}

function persistMarks() {
  try {
    const payload = { version: SAVE_VERSION, mode, code, marked: [...marked].sort((a, b) => a - b) };
    if (marked.size <= 1) globalThis.localStorage?.removeItem(saveKey());
    else globalThis.localStorage?.setItem(saveKey(), JSON.stringify(payload));
  } catch (error) {
    console.warn('Bingo autosave unavailable.', error);
  }
}

function removeSavedMarks() {
  try { globalThis.localStorage?.removeItem(saveKey()); } catch {}
}

function safeReplaceUrl() {
  try { globalThis.history?.replaceState?.(null, '', `?mode=${encodeURIComponent(mode)}&card=${encodeURIComponent(code)}`); } catch {}
}

function updateCellAccessibility(element, index) {
  if (index === 12) return;
  const state = marked.has(index) ? 'marked' : 'not marked';
  element.setAttribute('aria-label', `Bingo square ${index + 1}: ${element.textContent}. ${state}.`);
}

function update() {
  const completed = wins();
  markedEl.textContent = `${marked.size} / 25`;
  linesEl.textContent = String(completed.length);
  const nextBest = Math.max(readBest(), completed.length);
  writeBest(nextBest);
  bestEl.textContent = String(nextBest);
  board.classList.toggle('has-bingo', completed.length > 0);
  board.querySelectorAll('.cell').forEach((element, index) => {
    element.classList.toggle('line', completed.some((pattern) => pattern.includes(index)));
    updateCellAccessibility(element, index);
  });
  clearButton.disabled = marked.size <= 1;
  announce.textContent = completed.length
    ? `BINGO! ${completed.length} completed line${completed.length === 1 ? '' : 's'}. Progress saved on this device.`
    : marked.size > 1
      ? 'Card progress saved on this device.'
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
      button.setAttribute('aria-label', 'Center free space, marked.');
    } else {
      const prompt = cells[promptIndex++];
      if (!prompt?.text) throw new Error('A bingo square is missing prompt text.');
      button.textContent = prompt.text;
      button.setAttribute('aria-pressed', String(marked.has(index)));
      updateCellAccessibility(button, index);
      button.addEventListener('click', () => {
        if (marked.has(index)) marked.delete(index);
        else marked.add(index);
        button.setAttribute('aria-pressed', String(marked.has(index)));
        button.classList.remove('mark-pop');
        requestAnimationFrame(() => button.classList.add('mark-pop'));
        persistMarks();
        update();
      });
    }
    board.append(button);
  }
  update();
}

function clearClearArm() {
  clearArmedUntil = 0;
  clearTimeout(clearResetTimer);
  clearResetTimer = null;
  clearButton.textContent = 'Clear marks';
  clearButton.removeAttribute('data-armed');
}

function clearMarks() {
  if (marked.size <= 1) return;
  const now = Date.now();
  if (now > clearArmedUntil) {
    clearArmedUntil = now + 3500;
    clearButton.textContent = 'Confirm clear';
    clearButton.dataset.armed = 'true';
    announce.textContent = 'Tap Confirm clear within 3.5 seconds to erase this card’s saved marks.';
    clearTimeout(clearResetTimer);
    clearResetTimer = setTimeout(clearClearArm, 3600);
    return;
  }
  marked = new Set([12]);
  removeSavedMarks();
  clearClearArm();
  render();
  announce.textContent = 'Marks cleared for this card.';
}

function loadCard(nextCode) {
  const normalized = normalizeCardCode(nextCode);
  if (!isValidCardCode(normalized)) return false;
  clearClearArm();
  code = normalized;
  codeInput.value = code;
  codeInput.setAttribute('aria-invalid', 'false');
  codeReadout.textContent = code;
  cells = makeCard(code);
  const saved = readSavedMarks(mode, code);
  marked = saved.marks;
  render();
  safeReplaceUrl();
  if (saved.restored) announce.textContent = `Saved progress restored for card ${code}.`;
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
  const selected = data.modes.find((item) => item.id === id) || data.modes[0];
  mode = selected.id;
  titleEl.textContent = selected.title;
  descEl.textContent = selected.description;
  modesEl.querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  loadCard(code || randomCode());
}

function renderModes() {
  modesEl.replaceChildren();
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

newButton.addEventListener('click', () => loadCard(randomCode()));
document.querySelector('#load').addEventListener('click', loadEnteredCode);
clearButton.addEventListener('click', clearMarks);
codeInput.addEventListener('input', () => {
  codeInput.value = normalizeCardCode(codeInput.value);
  codeInput.setAttribute('aria-invalid', String(codeInput.value.length > 0 && !isValidCardCode(codeInput.value)));
});
codeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loadEnteredCode();
});
copyButton.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?mode=${encodeURIComponent(mode)}&card=${encodeURIComponent(code)}`;
  const text = `Grow Room Bingo card ${code} · mode ${mode}\n${url}`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
    await navigator.clipboard.writeText(text);
    announce.textContent = 'Card code and link copied.';
  } catch {
    announce.textContent = `Share card code: ${code}`;
  }
});

try {
  data = readEmbeddedData();
  renderModes();
  const params = new URLSearchParams(location.search);
  const requestedMode = params.get('mode');
  mode = data.modes.some((item) => item.id === requestedMode) ? requestedMode : 'grow-room';
  const requestedCode = normalizeCardCode(params.get('card'));
  code = isValidCardCode(requestedCode) ? requestedCode : randomCode();
  selectMode(mode);
} catch (error) {
  board.innerHTML = `<p role="alert">Bingo could not load. ${String(error.message)}</p>`;
  announce.textContent = 'Bingo could not load. Refresh the page or return to the Game Hub.';
  console.error(error);
}
