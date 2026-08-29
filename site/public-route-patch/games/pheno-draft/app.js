const RUN_CODE_LENGTH = 6;
const RUN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PHENOTYPES_PER_CROSS = 3;

const ui = {
  load: document.querySelector('#load-status'),
  round: document.querySelector('#round-stat'),
  score: document.querySelector('#score-stat'),
  fit: document.querySelector('#fit-stat'),
  refreshes: document.querySelector('#refresh-stat'),
  progress: document.querySelector('.round-track'),
  progressFill: document.querySelector('#round-progress-fill'),
  objective: document.querySelector('#objective-card'),
  current: document.querySelector('#current-line'),
  phaseTitle: document.querySelector('#phase-title'),
  phaseCopy: document.querySelector('#phase-copy'),
  phaseState: document.querySelector('#phase-state'),
  choices: document.querySelector('#choices'),
  refresh: document.querySelector('#refresh-draft'),
  selectedParent: document.querySelector('#selected-parent'),
  archive: document.querySelector('#archive'),
  result: document.querySelector('#run-result'),
  code: document.querySelector('#run-code'),
  newRun: document.querySelector('#new-run'),
  share: document.querySelector('#share-run'),
  announce: document.querySelector('#announce')
};

let data = null;
let state = null;
let cardById = new Map();
let goalById = new Map();
let restartArmed = false;
let restartTimer = null;
let actionLocked = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  if (!Array.isArray(payload?.traits) || !Array.isArray(payload?.cards) || !Array.isArray(payload?.goals)) throw new Error('Pheno Draft card data is required.');
  if (!Number.isInteger(payload.rounds) || payload.rounds < 1 || !Number.isInteger(payload.refreshTokens)) throw new Error('Pheno Draft run settings are invalid.');
}

function cardMap(payload) {
  return new Map(payload.cards.map((card) => [card.id, card]));
}

function goalMap(payload) {
  return new Map(payload.goals.map((goal) => [goal.id, goal]));
}

function normalizeRunCode(value) {
  const allowed = new Set(RUN_ALPHABET);
  return String(value ?? '').trim().toUpperCase().split('').filter((character) => allowed.has(character)).join('').slice(0, RUN_CODE_LENGTH);
}

function isValidRunCode(value) {
  return normalizeRunCode(value).length === RUN_CODE_LENGTH;
}

function goalFit(line, goal, payload) {
  requireData(payload);
  if (!line?.traits || !goal?.weights) return 0;
  let weighted = 0;
  let weightTotal = 0;
  for (const trait of payload.traits) {
    const weight = Number(goal.weights[trait.id] ?? 0);
    if (weight <= 0) continue;
    weighted += Number(line.traits[trait.id] ?? 0) * weight;
    weightTotal += 10 * weight;
  }
  return weightTotal ? Math.round((weighted / weightTotal) * 100) : 0;
}

function baseLine(card) {
  return { lineId: `founder-${card.id}`, label: card.label, family: card.family, hue: card.hue, generation: 0, traits: clone(card.traits), sourceCardIds: [card.id] };
}

function deterministicOrder(code, key, payload) {
  const length = payload.cards.length;
  const start = hash(`${code}:${key}:start`) % length;
  return Array.from({ length }, (_, offset) => payload.cards[(start + offset) % length]);
}

function offerIdsForState(inputState, payload, { blockCurrent = false } = {}) {
  const blocked = new Set(inputState.usedParentIds);
  for (const sourceId of inputState.currentLine.sourceCardIds ?? []) blocked.add(sourceId);
  if (blockCurrent) for (const id of inputState.offers ?? []) blocked.add(id);
  const key = `round:${inputState.round}:refresh:${inputState.refreshesUsed}`;
  const order = deterministicOrder(inputState.code, key, payload);
  let choices = order.filter((card) => !blocked.has(card.id)).slice(0, 3);
  if (choices.length < 3 && blockCurrent) {
    const fallbackBlocked = new Set(inputState.usedParentIds);
    for (const sourceId of inputState.currentLine.sourceCardIds ?? []) fallbackBlocked.add(sourceId);
    choices = order.filter((card) => !fallbackBlocked.has(card.id)).slice(0, 3);
  }
  if (choices.length < 3) throw new Error('Not enough parent cards remain to create a draft offer.');
  return choices.map((card) => card.id);
}

function phenoName(code, round, parentId, index) {
  const prefixes = ['Nova', 'Velvet', 'Frost', 'Prism', 'Solar', 'Lunar', 'Cobalt', 'Amber'];
  const suffixes = ['Relay', 'Bloom', 'Orbit', 'Signal', 'Drift', 'Current', 'Atlas', 'Circuit'];
  const prefix = prefixes[hash(`${code}:${round}:${parentId}:${index}:prefix`) % prefixes.length];
  const suffix = suffixes[hash(`${code}:${round}:${parentId}:${index}:suffix`) % suffixes.length];
  return `${prefix} ${suffix}`;
}

function generatePhenotypes(currentLine, parentCard, { code, round }, payload) {
  requireData(payload);
  if (!currentLine?.traits || !parentCard?.traits) throw new Error('Both parent trait profiles are required.');
  const results = [];
  for (let index = 0; index < PHENOTYPES_PER_CROSS; index += 1) {
    const traits = {};
    for (const trait of payload.traits) {
      const left = Number(currentLine.traits[trait.id]);
      const right = Number(parentCard.traits[trait.id]);
      const midpoint = Math.round((left + right) / 2);
      const variance = (hash(`${code}:${round}:${parentCard.id}:${index}:${trait.id}`) % 3) - 1;
      traits[trait.id] = clamp(midpoint + variance, 1, 10);
    }
    const sourceCardIds = [...new Set([...(currentLine.sourceCardIds ?? []), parentCard.id])];
    results.push({
      lineId: `r${round}-${parentCard.id}-${index + 1}`,
      label: phenoName(code, round, parentCard.id, index),
      family: `${currentLine.family} × ${parentCard.family}`,
      hue: Math.round((Number(currentLine.hue) + Number(parentCard.hue)) / 2) % 360,
      generation: round,
      traits,
      sourceCardIds,
      parentCardId: parentCard.id,
      phenotypeIndex: index
    });
  }
  return results;
}

function createRun({ code } = {}, payload) {
  requireData(payload);
  const normalized = normalizeRunCode(code);
  if (!isValidRunCode(normalized)) throw new Error('A six-character Pheno Draft run code is required.');
  const founder = payload.cards[hash(`${normalized}:founder`) % payload.cards.length];
  const goal = payload.goals[hash(`${normalized}:goal`) % payload.goals.length];
  const line = baseLine(founder);
  const next = {
    schemaVersion: 1, code: normalized, status: 'playing', phase: 'draft', round: 1, maxRounds: payload.rounds,
    goalId: goal.id, founderCardId: founder.id, currentLine: line, currentFit: goalFit(line, goal, payload), offers: [],
    selectedParentId: null, phenotypes: [], refreshesRemaining: payload.refreshTokens, refreshesUsed: 0,
    usedParentIds: [], archive: [], history: [], score: 0, finalRank: null
  };
  next.offers = offerIdsForState(next, payload);
  return next;
}

function refreshDraft(inputState, payload) {
  requireData(payload);
  const next = clone(inputState);
  if (next.status !== 'playing' || next.phase !== 'draft') throw new Error('Draft refresh is only available during the draft phase.');
  if (next.refreshesRemaining <= 0) throw new Error('No draft refresh tokens remain.');
  const previous = [...next.offers];
  next.refreshesRemaining -= 1;
  next.refreshesUsed += 1;
  next.offers = offerIdsForState({ ...next, offers: previous }, payload, { blockCurrent: true });
  next.history.push({ type: 'refresh', round: next.round, offers: [...next.offers] });
  return next;
}

function selectParent(inputState, parentId, payload) {
  requireData(payload);
  const next = clone(inputState);
  if (next.status !== 'playing' || next.phase !== 'draft') throw new Error('A parent can only be selected during the draft phase.');
  if (!next.offers.includes(parentId)) throw new Error('That parent card is not in the current draft offer.');
  const parent = cardMap(payload).get(parentId);
  if (!parent) throw new Error(`Unknown parent card: ${parentId}`);
  next.selectedParentId = parentId;
  next.phenotypes = generatePhenotypes(next.currentLine, parent, { code: next.code, round: next.round }, payload);
  next.phase = 'phenotype';
  next.history.push({ type: 'parent', round: next.round, parentId });
  return next;
}

function rankForState(inputState, payload) {
  const goal = goalMap(payload).get(inputState.goalId);
  const fit = goalFit(inputState.currentLine, goal, payload);
  if (fit >= 88 && inputState.score >= 4200) return 'Legacy Builder';
  if (fit >= 82 && inputState.score >= 3400) return 'Draft Architect';
  if (fit >= 76 && inputState.score >= 2700) return 'Selection Specialist';
  if (fit >= 68) return 'Keeper Hunter';
  return 'Foundation Scout';
}

function selectPhenotype(inputState, lineId, payload) {
  requireData(payload);
  const next = clone(inputState);
  if (next.status !== 'playing' || next.phase !== 'phenotype') throw new Error('A phenotype can only be kept after a parent is selected.');
  const selected = next.phenotypes.find((line) => line.lineId === lineId);
  if (!selected) throw new Error('That phenotype is not available in the current cross.');
  const goal = goalMap(payload).get(next.goalId);
  if (!goal) throw new Error(`Unknown goal: ${next.goalId}`);
  const previousFit = goalFit(next.currentLine, goal, payload);
  const nextFit = goalFit(selected, goal, payload);
  const improvement = nextFit - previousFit;
  const roundScore = Math.max(0, Math.round((nextFit * 8) + (improvement * 15)));
  next.currentLine = clone(selected);
  next.currentFit = nextFit;
  next.score += roundScore;
  if (!next.usedParentIds.includes(next.selectedParentId)) next.usedParentIds.push(next.selectedParentId);
  next.archive.push({ round: next.round, parentId: next.selectedParentId, line: clone(selected), fit: nextFit, improvement, roundScore });
  next.history.push({ type: 'keep', round: next.round, parentId: next.selectedParentId, lineId: selected.lineId, fit: nextFit, improvement, roundScore });
  if (next.round >= next.maxRounds) {
    next.score += (nextFit * 10) + (next.refreshesRemaining * 75);
    next.status = 'complete';
    next.phase = 'complete';
    next.selectedParentId = null;
    next.phenotypes = [];
    next.offers = [];
    next.finalRank = rankForState(next, payload);
    return next;
  }
  next.round += 1;
  next.phase = 'draft';
  next.selectedParentId = null;
  next.phenotypes = [];
  next.offers = offerIdsForState(next, payload);
  return next;
}

function runRank(inputState, payload) {
  requireData(payload);
  return inputState.finalRank ?? rankForState(inputState, payload);
}

function projectedCrossLine(currentLine, parentCard, payload) {
  if (!currentLine?.traits || !parentCard?.traits || !Array.isArray(payload?.traits)) throw new Error('Current line, parent card, and trait data are required for a projection.');
  const traits = {};
  for (const trait of payload.traits) {
    const left = Number(currentLine.traits[trait.id]);
    const right = Number(parentCard.traits[trait.id]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error(`Missing numeric trait values for ${trait.id}.`);
    traits[trait.id] = Math.round((left + right) / 2);
  }
  return {
    lineId: `projection-${parentCard.id}`, label: `${currentLine.label} × ${parentCard.label}`,
    family: `${currentLine.family} × ${parentCard.family}`,
    hue: Math.round((Number(currentLine.hue) + Number(parentCard.hue)) / 2) % 360,
    generation: Number(currentLine.generation ?? 0) + 1, traits,
    sourceCardIds: [...new Set([...(currentLine.sourceCardIds ?? []), parentCard.id])]
  };
}

function projectionSummary(currentLine, parentCard, goal, payload) {
  const line = projectedCrossLine(currentLine, parentCard, payload);
  const fit = goalFit(line, goal, payload);
  const currentFit = goalFit(clone(currentLine), goal, payload);
  return { fit, delta: fit - currentFit, line };
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function validateData(payload) {
  if (payload?.schemaVersion !== 1 || payload?.rounds !== 6 || payload?.refreshTokens !== 2 || payload?.traits?.length !== 7 || payload?.goals?.length !== 6 || payload?.cards?.length !== 20) throw new Error('Pheno Draft data contract mismatch.');
  const traitIds = new Set(payload.traits.map((trait) => trait.id));
  const cardIds = new Set(payload.cards.map((card) => card.id));
  const goalIds = new Set(payload.goals.map((goal) => goal.id));
  if (traitIds.size !== 7 || cardIds.size !== 20 || goalIds.size !== 6) throw new Error('Pheno Draft data contains duplicate IDs.');
  for (const card of payload.cards) {
    for (const trait of payload.traits) {
      const value = Number(card.traits?.[trait.id]);
      if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error(`${card.id} has an invalid ${trait.id} trait.`);
    }
  }
  for (const goal of payload.goals) {
    if (![...traitIds].some((id) => Number(goal.weights?.[id] ?? 0) > 0)) throw new Error(`${goal.id} has no weighted traits.`);
  }
}

function randomCode() {
  const values = new Uint32Array(RUN_CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  return [...values].map((number) => RUN_ALPHABET[number % RUN_ALPHABET.length]).join('');
}

function challengeUrl() {
  const params = new URLSearchParams({ draft: state.code });
  return `${location.origin}${location.pathname}?${params}`;
}

function replaceChallengeUrl() {
  try { globalThis.history?.replaceState?.(null, '', challengeUrl()); } catch { /* gameplay is independent of History API */ }
}

function setCode(value) {
  const normalized = normalizeRunCode(value);
  ui.code.value = normalized;
  ui.code.setAttribute('aria-invalid', String(normalized.length > 0 && !isValidRunCode(normalized)));
}

function currentGoal() {
  return goalById.get(state.goalId);
}

function traitRows(line, { compact = false } = {}) {
  const goal = currentGoal();
  return `<div class="trait-grid${compact ? ' compact' : ''}">${data.traits.map((trait) => {
    const value = Number(line.traits[trait.id]);
    const weight = Number(goal?.weights?.[trait.id] ?? 0);
    return `<div class="trait-row${weight >= 2 ? ' priority' : ''}"><div class="trait-label"><span>${escapeHtml(trait.label)}</span><b>${value}</b></div><div class="trait-track" aria-label="${escapeHtml(trait.label)} ${value} of 10"><span style="--trait-value:${value}"></span></div></div>`;
  }).join('')}</div>`;
}

function seedArt(line) {
  const hue = Number(line.hue ?? 150);
  return `<div class="genetic-art" style="--line-hue:${hue}" aria-hidden="true"><span class="helix helix-a"></span><span class="helix helix-b"></span><span class="seed-emblem"><i></i></span><span class="gene-dot dot-a"></span><span class="gene-dot dot-b"></span><span class="gene-dot dot-c"></span></div>`;
}

function lineCard(line, { heading = 'Current Line', action = '', actionValue = '', actionShortcut = '', cardClass = '', fitLabel = '', footer = '' } = {}) {
  const fit = goalFit(line, currentGoal(), data);
  const displayedFit = fitLabel || `${fit}% fit`;
  const actionMarkup = action ? `<button type="button" class="card-action" data-choice="${escapeHtml(actionValue)}"${actionShortcut ? ` aria-keyshortcuts="${escapeHtml(actionShortcut)}"` : ''}>${escapeHtml(action)}</button>` : '';
  return `<article class="genetics-card ${cardClass}" style="--line-hue:${Number(line.hue ?? 150)}"><div class="card-topline"><span>${escapeHtml(heading)}</span><b>${escapeHtml(displayedFit)}</b></div>${seedArt(line)}<div class="card-copy"><strong>${escapeHtml(line.label)}</strong><small>${escapeHtml(line.family ?? '')}</small></div>${traitRows(line, { compact: true })}${footer}${actionMarkup}</article>`;
}

function parentAsLine(card) {
  return { lineId: `card-${card.id}`, label: card.label, family: card.family, hue: card.hue, traits: card.traits };
}

function projectionFooter(card) {
  const summary = projectionSummary(state.currentLine, card, currentGoal(), data);
  const sign = summary.delta > 0 ? '+' : '';
  const tone = summary.delta > 0 ? 'positive' : summary.delta < 0 ? 'negative' : 'neutral';
  return `<div class="fit-delta ${tone}"><strong>Projected ${summary.fit}%</strong><span>${sign}${summary.delta}% vs current · midpoint projection</span></div>`;
}

function renderStats() {
  ui.round.textContent = `${state.round} / ${state.maxRounds}`;
  ui.score.textContent = String(state.score);
  ui.fit.textContent = `${state.currentFit}%`;
  ui.refreshes.textContent = String(state.refreshesRemaining);
  const completedUnits = state.status === 'complete' ? state.maxRounds : (state.round - 1) + (state.phase === 'phenotype' ? 0.5 : 0);
  const progress = Math.max(0, Math.min(100, Math.round((completedUnits / state.maxRounds) * 100)));
  ui.progressFill.style.width = `${progress}%`;
  ui.progress.setAttribute('aria-valuenow', String(state.status === 'complete' ? state.maxRounds : state.round));
  document.body.classList.toggle('fit-strong', state.currentFit >= 80);
}

function renderObjective() {
  const goal = currentGoal();
  const priorities = data.traits.filter((trait) => Number(goal.weights[trait.id] ?? 0) > 0).sort((a, b) => Number(goal.weights[b.id]) - Number(goal.weights[a.id])).map((trait) => `<span class="goal-chip weight-${goal.weights[trait.id]}">${escapeHtml(trait.label)} ×${goal.weights[trait.id]}</span>`).join('');
  ui.objective.innerHTML = `<span class="panel-kicker">RUN OBJECTIVE</span><strong>${escapeHtml(goal.label)}</strong><p>${escapeHtml(goal.description)}</p><div class="goal-chips">${priorities}</div>`;
}

function renderCurrent() {
  ui.current.innerHTML = lineCard(state.currentLine, { heading: state.currentLine.generation ? `Generation ${state.currentLine.generation}` : 'Founder Line' });
}

function renderDraftChoices() {
  ui.phaseState.textContent = 'PARENT DRAFT';
  ui.phaseTitle.textContent = `Round ${state.round}: Draft a parent`;
  ui.phaseCopy.textContent = 'Compare projected midpoint fit, commit to one parent, then reveal three actual phenotype cards with hidden variance.';
  ui.selectedParent.hidden = true;
  ui.refresh.hidden = false;
  ui.refresh.disabled = state.refreshesRemaining <= 0 || actionLocked;
  ui.refresh.textContent = `Refresh Draft (${state.refreshesRemaining})`;
  ui.refresh.setAttribute('aria-keyshortcuts', 'R');
  ui.choices.className = 'choice-grid draft-grid';
  ui.choices.innerHTML = state.offers.map((id, index) => {
    const card = cardById.get(id);
    const parentLine = parentAsLine(card);
    const projection = projectionSummary(state.currentLine, card, currentGoal(), data);
    const parentFit = goalFit(parentLine, currentGoal(), data);
    const trendClass = projection.delta > 0 ? 'projected-up' : projection.delta < 0 ? 'projected-down' : 'projected-flat';
    return lineCard(parentLine, {
      heading: `Parent ${index + 1}`,
      action: `Cross with ${card.label}`,
      actionValue: card.id,
      actionShortcut: String(index + 1),
      cardClass: `parent-card ${trendClass}`,
      fitLabel: `Parent ${parentFit}%`,
      footer: projectionFooter(card)
    });
  }).join('');
}

function renderPhenotypeChoices() {
  const parent = cardById.get(state.selectedParentId);
  ui.phaseState.textContent = 'KEEPER PICK';
  ui.phaseTitle.textContent = `Round ${state.round}: Keep one phenotype`;
  ui.phaseCopy.textContent = 'Variance is revealed. Compare the actual generated cards against your current keeper and objective.';
  ui.refresh.hidden = true;
  ui.selectedParent.hidden = false;
  ui.selectedParent.innerHTML = `<span class="panel-kicker">SELECTED PARENT</span><strong>${escapeHtml(parent.label)}</strong><span>${escapeHtml(parent.family)}</span>`;
  ui.choices.className = 'choice-grid phenotype-grid';
  ui.choices.innerHTML = state.phenotypes.map((line, index) => {
    const fit = goalFit(line, currentGoal(), data);
    const delta = fit - state.currentFit;
    const deltaCopy = delta > 0 ? `+${delta}` : String(delta);
    const tone = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
    const footer = `<div class="fit-delta ${tone}"><strong>${deltaCopy}% vs current</strong><span>${fit}% objective fit</span></div>`;
    return lineCard(line, {
      heading: `Phenotype ${String.fromCharCode(65 + index)}`,
      action: `Keep ${line.label}`,
      actionValue: line.lineId,
      actionShortcut: String(index + 1),
      cardClass: delta > 0 ? 'pheno-card improving' : delta < 0 ? 'pheno-card declining' : 'pheno-card even',
      footer
    });
  }).join('');
}

function renderComplete() {
  ui.phaseState.textContent = 'COMPLETE';
  ui.phaseTitle.textContent = 'Draft complete';
  ui.phaseCopy.textContent = 'Your six-round line is locked. Start another run code to chase a different founder and objective.';
  ui.refresh.hidden = true;
  ui.selectedParent.hidden = true;
  ui.choices.className = 'choice-grid complete-grid';
  ui.choices.innerHTML = lineCard(state.currentLine, { heading: 'Final Keeper', cardClass: 'final-card' });
}

function renderChoices() {
  if (state.phase === 'draft') renderDraftChoices();
  else if (state.phase === 'phenotype') renderPhenotypeChoices();
  else renderComplete();
}

function renderArchive() {
  ui.archive.replaceChildren();
  if (!state.archive.length) {
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.textContent = 'Kept phenotype cards will build your run archive here.';
    ui.archive.append(item);
    return;
  }
  for (const entry of [...state.archive].reverse()) {
    const item = document.createElement('li');
    const sign = entry.improvement > 0 ? '+' : '';
    item.className = entry.improvement > 0 ? 'archive-up' : entry.improvement < 0 ? 'archive-down' : 'archive-even';
    item.innerHTML = `<span class="archive-round">R${entry.round}</span><div><strong>${escapeHtml(entry.line.label)}</strong><small>${entry.fit}% fit · ${sign}${entry.improvement}% change · +${entry.roundScore} pts</small></div>`;
    ui.archive.append(item);
  }
}

function renderResult() {
  if (state.status !== 'complete') {
    ui.result.className = 'result-panel waiting';
    ui.result.innerHTML = `<span class="panel-kicker">RUN STATUS</span><strong>${state.phase === 'phenotype' ? 'Phenotypes revealed.' : 'Build the line.'}</strong><p>${state.archive.length} of ${state.maxRounds} keepers locked · ${state.refreshesRemaining} refresh${state.refreshesRemaining === 1 ? '' : 'es'} left.</p>`;
    return;
  }
  ui.result.className = 'result-panel complete';
  ui.result.innerHTML = `<span class="panel-kicker">FINAL RANK</span><strong>${escapeHtml(runRank(state, data))}</strong><p>${escapeHtml(state.currentLine.label)} finished at <b>${state.currentFit}% objective fit</b> with <b>${state.score} points</b>.</p><div class="rank-badge" aria-hidden="true"><span>PD</span></div>`;
}

function render() {
  renderStats();
  renderObjective();
  renderCurrent();
  renderChoices();
  renderArchive();
  renderResult();
  setCode(state.code);
  document.body.classList.toggle('phase-phenotype', state.phase === 'phenotype');
  document.body.classList.toggle('run-complete', state.status === 'complete');
}

function disarmRestart() {
  restartArmed = false;
  window.clearTimeout(restartTimer);
  restartTimer = null;
  ui.newRun.classList.remove('restart-armed');
  ui.newRun.textContent = 'New Run';
}

function resetRun(code) {
  actionLocked = false;
  disarmRestart();
  state = createRun({ code }, data);
  replaceChallengeUrl();
  render();
}

function runHasProgress() {
  return state?.status === 'playing' && (state.archive.length > 0 || state.history.length > 0 || state.phase === 'phenotype');
}

function chooseVisibleCard(index) {
  if (!state || state.status !== 'playing' || actionLocked) return;
  const buttons = [...ui.choices.querySelectorAll('button[data-choice]')];
  buttons[index]?.click();
}

ui.choices.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-choice]');
  if (!button || state.status !== 'playing' || actionLocked) return;
  actionLocked = true;
  try {
    if (state.phase === 'draft') {
      const card = cardById.get(button.dataset.choice);
      const projection = projectionSummary(state.currentLine, card, currentGoal(), data);
      state = selectParent(state, button.dataset.choice, data);
      render();
      ui.announce.textContent = `${card.label} selected. Projected cross was ${projection.fit} percent fit; three actual phenotype cards are now revealed.`;
    } else if (state.phase === 'phenotype') {
      const chosen = state.phenotypes.find((line) => line.lineId === button.dataset.choice);
      state = selectPhenotype(state, button.dataset.choice, data);
      render();
      ui.announce.textContent = state.status === 'complete' ? `${chosen.label} kept. Draft complete. Final rank ${state.finalRank}.` : `${chosen.label} kept. Round ${state.round} parent draft ready.`;
    }
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    actionLocked = false;
  }
});

ui.refresh.addEventListener('click', () => {
  if (actionLocked) return;
  actionLocked = true;
  try {
    state = refreshDraft(state, data);
    render();
    ui.announce.textContent = `Draft refreshed. ${state.refreshesRemaining} refresh token${state.refreshesRemaining === 1 ? '' : 's'} remaining.`;
  } catch (error) {
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    actionLocked = false;
  }
});

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidRunCode(ui.code.value)) {
    ui.announce.textContent = 'Enter a complete six-character Pheno Draft code.';
    return;
  }
  const requested = normalizeRunCode(ui.code.value);
  if (requested === state.code) {
    ui.announce.textContent = `Run ${state.code} is already loaded.`;
    return;
  }
  resetRun(requested);
  ui.announce.textContent = `Pheno Draft code ${state.code} loaded.`;
});

ui.newRun.addEventListener('click', () => {
  if (runHasProgress() && !restartArmed) {
    restartArmed = true;
    ui.newRun.classList.add('restart-armed');
    ui.newRun.textContent = 'Confirm New Run';
    restartTimer = window.setTimeout(disarmRestart, 4500);
    ui.announce.textContent = 'Current draft has progress. Press Confirm New Run to discard it.';
    return;
  }
  resetRun(randomCode());
  ui.announce.textContent = `New Pheno Draft run ${state.code}.`;
});

ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `Pheno Draft · run ${state.code}\n${url}`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Pheno Draft challenge copied.';
  } catch {
    ui.announce.textContent = `Share run code ${state.code}: ${url}`;
  }
});

function shortcutTarget(target) {
  return typeof Element !== 'undefined' && target instanceof Element && Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"]'));
}

document.addEventListener('keydown', (event) => {
  if (shortcutTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey || actionLocked) return;
  if ((event.key === 'r' || event.key === 'R') && state?.phase === 'draft' && state.refreshesRemaining > 0) {
    event.preventDefault();
    ui.refresh.click();
    return;
  }
  if (!['1', '2', '3'].includes(event.key) || state?.status !== 'playing') return;
  event.preventDefault();
  chooseVisibleCard(Number(event.key) - 1);
});

function load() {
  try {
    const embedded = document.querySelector('#pheno-draft-data');
    if (!embedded?.textContent) throw new Error('Embedded Pheno Draft data is missing.');
    data = JSON.parse(embedded.textContent);
    validateData(data);
    cardById = new Map(data.cards.map((card) => [card.id, card]));
    goalById = new Map(data.goals.map((goal) => [goal.id, goal]));
    const requested = normalizeRunCode(new URLSearchParams(location.search).get('draft'));
    const code = isValidRunCode(requested) ? requested : randomCode();
    state = createRun({ code }, data);
    replaceChallengeUrl();
    ui.load.textContent = 'Ready · 6 rounds · hidden phenotype variance · 2 refreshes';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Pheno Draft could not initialize.';
    ui.newRun.disabled = true;
  }
}

window.addEventListener('pagehide', () => window.clearTimeout(restartTimer));
load();
