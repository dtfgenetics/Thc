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
const progressFill = document.querySelector('#progress-fill');
const progressLabel = document.querySelector('#progress-label');
const progressRail = document.querySelector('.progress-rail');

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
  const progressPercent = Math.round((marked.size / 25) * 100);
  markedEl.textContent = `${marked.size} / 25`;
  linesEl.textContent = String(completed.length);
  progressFill.style.width = `${progressPercent}%`;
  progressLabel.textContent = `${progressPercent}%`;
  progressRail.setAttribute('aria-valuenow', String(marked.size));
  board.dataset.lines = String(completed.length);
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
  document.documentElement.dataset.mode = mode;
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

// BEGIN GROW ROOM BINGO AGENT BRIDGE
const BINGO_AGENT_VERSION='grow-room-bingo-agent-bridge-v1';
const BINGO_AGENT_MAX_EVENTS=32;
const BINGO_AGENT_STALL_MS=8000;
const bingoAgentTelemetry={actions:[],errors:[],lastProgressKey:'',lastProgressAt:0,lastActionAt:0};
function bingoAgentNow(){return typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();}
function pushBingoAgentEvent(list,event){list.push(Object.freeze(event));if(list.length>BINGO_AGENT_MAX_EVENTS)list.splice(0,list.length-BINGO_AGENT_MAX_EVENTS);}
function recordBingoAgentAction(action,detail=null){const now=bingoAgentNow();bingoAgentTelemetry.lastActionAt=now;pushBingoAgentEvent(bingoAgentTelemetry.actions,{atMs:Math.round(now),action,detail});}
function recordBingoAgentError(kind,messageText,source=null){pushBingoAgentEvent(bingoAgentTelemetry.errors,{atMs:Math.round(bingoAgentNow()),kind,message:String(messageText||kind||'unknown error').slice(0,500),source:source?String(source).slice(0,500):null});}
function observeBingoAgentProgress(){const key=[mode,code,[...marked].sort((a,b)=>a-b).join(','),wins().length,clearArmedUntil>Date.now()?1:0].join('|');if(key!==bingoAgentTelemetry.lastProgressKey){bingoAgentTelemetry.lastProgressKey=key;bingoAgentTelemetry.lastProgressAt=bingoAgentNow();}}
function bingoAgentTelemetrySnapshot(){observeBingoAgentProgress();const now=bingoAgentNow();const noProgressMs=bingoAgentTelemetry.lastProgressAt?Math.max(0,now-bingoAgentTelemetry.lastProgressAt):0;const sinceActionMs=bingoAgentTelemetry.lastActionAt?Math.max(0,now-bingoAgentTelemetry.lastActionAt):0;const actionPending=bingoAgentTelemetry.lastActionAt>bingoAgentTelemetry.lastProgressAt;return{errors:bingoAgentTelemetry.errors.slice(),recentActions:bingoAgentTelemetry.actions.slice(),noProgressMs:Math.round(noProgressMs),sinceActionMs:Math.round(sinceActionMs),stallSuspected:Boolean(actionPending&&sinceActionMs>=BINGO_AGENT_STALL_MS&&noProgressMs>=BINGO_AGENT_STALL_MS),stallThresholdMs:BINGO_AGENT_STALL_MS};}
function bingoAgentSnapshot(){
  const buttons=[...board.querySelectorAll('.cell')];
  const completed=wins();
  return{
    version:BINGO_AGENT_VERSION,
    ready:Boolean(data&&code&&cells.length===24),
    mode:{id:mode,available:data?.modes?.map(item=>({id:item.id,title:item.title}))||[]},
    card:{code,markedCount:marked.size,lineCount:completed.length,bestLineCount:readBest(),clearArmed:clearArmedUntil>Date.now(),cells:buttons.map((button,index)=>({index,text:button.textContent,marked:marked.has(index),free:index===12,line:button.classList.contains('line'),disabled:Boolean(button.disabled)}))},
    legalActions:['toggle-cell','select-mode','load-code','new-card','clear-marks'],
    telemetry:bingoAgentTelemetrySnapshot()
  };
}
function toggleBingoAgentCell(index){const normalized=Number(index);if(!Number.isInteger(normalized)||normalized<0||normalized>=25)throw new Error(`Unsupported Bingo cell index: ${index}`);if(normalized===12)return false;const button=[...board.querySelectorAll('.cell')][normalized];if(!button||button.disabled)return false;recordBingoAgentAction('toggle-cell',normalized);button.click();return true;}
function selectBingoAgentMode(id){const normalized=String(id||'');if(!data?.modes?.some(item=>item.id===normalized))throw new Error(`Unsupported Bingo mode: ${id}`);const button=[...modesEl.querySelectorAll('button')].find(candidate=>candidate.dataset.mode===normalized);if(!button)return false;recordBingoAgentAction('select-mode',normalized);button.click();return true;}
function loadBingoAgentCode(value){const normalized=normalizeCardCode(value);if(!isValidCardCode(normalized))throw new Error(`Unsupported Bingo card code: ${value}`);recordBingoAgentAction('load-code',normalized);codeInput.value=normalized;const loaded=loadCard(normalized);return Boolean(loaded);}
function installBingoAgentTelemetry(){if(typeof window?.addEventListener!=='function')return;window.addEventListener('error',event=>{const target=event?.target;const resource=target&&target!==window&&(target.currentSrc||target.src||target.href);if(resource)recordBingoAgentError('resource-error','Browser resource failed to load',resource);else recordBingoAgentError('runtime-error',event?.message||event?.error?.message||'Browser runtime error',event?.filename||null);},true);window.addEventListener('unhandledrejection',event=>recordBingoAgentError('unhandled-rejection',event?.reason?.message||event?.reason||'Unhandled promise rejection'));}
function installBingoAgentBridge(){installBingoAgentTelemetry();const api=Object.freeze({
 version:BINGO_AGENT_VERSION,
 snapshot:bingoAgentSnapshot,
 toggleCell:toggleBingoAgentCell,
 selectMode:selectBingoAgentMode,
 loadCode:loadBingoAgentCode,
 newCard:()=>{recordBingoAgentAction('new-card');newButton.click();return true;},
 clearMarks:()=>{if(marked.size<=1)return false;recordBingoAgentAction('clear-marks');clearButton.click();return true;},
 telemetry:bingoAgentTelemetrySnapshot
});Object.defineProperty(window,'__GROW_ROOM_BINGO_AGENT__',{value:api,enumerable:false,configurable:false,writable:false});Object.defineProperty(window,'__GROW_ROOM_BINGO_GAME_STATE__',{get:bingoAgentSnapshot,enumerable:false,configurable:false});document.documentElement.dataset.growRoomBingoAgentBridge=BINGO_AGENT_VERSION;bingoAgentTelemetry.lastProgressAt=bingoAgentNow();return api;}
installBingoAgentBridge();
// END GROW ROOM BINGO AGENT BRIDGE

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
async function copyText(value) {
  const text = String(value || '');
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    field.style.pointerEvents = 'none';
    document.body.append(field);
    field.select();
    field.setSelectionRange(0, text.length);
    const copied = document.execCommand?.('copy') === true;
    field.remove();
    return copied;
  } catch {
    return false;
  }
}

copyButton.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?mode=${encodeURIComponent(mode)}&card=${encodeURIComponent(code)}`;
  const text = `Grow Room Bingo card ${code} · mode ${mode}\n${url}`;
  const copied = await copyText(text);
  announce.textContent = copied
    ? 'Card code and link copied.'
    : `Copy failed. Share card code ${code} and this page address manually.`;
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
