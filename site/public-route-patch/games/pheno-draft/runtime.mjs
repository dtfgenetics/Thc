import {
  RUN_CODE_LENGTH,
  RUN_ALPHABET,
  normalizeRunCode,
  isValidRunCode,
  goalFit,
  createRun,
  refreshDraft,
  selectParent,
  selectPhenotype,
  runRank
} from './engine.mjs';

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

function resetChoiceViewport() {
  const reducedMotion = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  window.requestAnimationFrame(() => {
    try {
      ui.choices.scrollTo({ left: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    } catch {
      ui.choices.scrollLeft = 0;
    }
  });
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
  resetChoiceViewport();
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
      resetChoiceViewport();
      ui.announce.textContent = `${card.label} selected. Projected cross was ${projection.fit} percent fit; three actual phenotype cards are now revealed.`;
    } else if (state.phase === 'phenotype') {
      const chosen = state.phenotypes.find((line) => line.lineId === button.dataset.choice);
      state = selectPhenotype(state, button.dataset.choice, data);
      render();
      resetChoiceViewport();
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
    resetChoiceViewport();
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
  const copied = await copyText(text);
  ui.announce.textContent = copied
    ? 'Pheno Draft challenge copied.'
    : `Copy failed. Share run code ${state.code}: ${url}`;
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
    resetChoiceViewport();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Pheno Draft could not initialize.';
    ui.newRun.disabled = true;
  }
}

window.addEventListener('pagehide', () => window.clearTimeout(restartTimer));
load();