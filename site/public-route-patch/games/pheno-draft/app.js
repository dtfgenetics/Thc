import {
  RUN_ALPHABET,
  createRun,
  goalFit,
  isValidRunCode,
  normalizeRunCode,
  refreshDraft,
  runRank,
  selectParent,
  selectPhenotype
} from './engine.mjs';
import { projectionSummary } from './projection.mjs';

const ui = {
  load: document.querySelector('#load-status'),
  round: document.querySelector('#round-stat'),
  score: document.querySelector('#score-stat'),
  fit: document.querySelector('#fit-stat'),
  refreshes: document.querySelector('#refresh-stat'),
  objective: document.querySelector('#objective-card'),
  current: document.querySelector('#current-line'),
  phaseTitle: document.querySelector('#phase-title'),
  phaseCopy: document.querySelector('#phase-copy'),
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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return [...values].map((number) => RUN_ALPHABET[number % RUN_ALPHABET.length]).join('');
}

function challengeUrl() {
  const params = new URLSearchParams({ draft: state.code });
  return `${location.origin}${location.pathname}?${params}`;
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
    return `<div class="trait-row${weight >= 2 ? ' priority' : ''}">
      <div class="trait-label"><span>${escapeHtml(trait.label)}</span><b>${value}</b></div>
      <div class="trait-track" aria-label="${escapeHtml(trait.label)} ${value} of 10"><span style="--trait-value:${value}"></span></div>
    </div>`;
  }).join('')}</div>`;
}

function seedArt(line) {
  const hue = Number(line.hue ?? 150);
  return `<div class="genetic-art" style="--line-hue:${hue}" aria-hidden="true">
    <span class="helix helix-a"></span>
    <span class="helix helix-b"></span>
    <span class="seed-emblem"><i></i></span>
    <span class="gene-dot dot-a"></span><span class="gene-dot dot-b"></span><span class="gene-dot dot-c"></span>
  </div>`;
}

function lineCard(line, {
  heading = 'Current Line',
  action = '',
  actionValue = '',
  actionShortcut = '',
  cardClass = '',
  fitLabel = '',
  footer = ''
} = {}) {
  const fit = goalFit(line, currentGoal(), data);
  const displayedFit = fitLabel || `${fit}% fit`;
  const actionMarkup = action
    ? `<button type="button" class="card-action" data-choice="${escapeHtml(actionValue)}"${actionShortcut ? ` aria-keyshortcuts="${escapeHtml(actionShortcut)}"` : ''}>${escapeHtml(action)}</button>`
    : '';
  return `<article class="genetics-card ${cardClass}" style="--line-hue:${Number(line.hue ?? 150)}">
    <div class="card-topline"><span>${escapeHtml(heading)}</span><b>${escapeHtml(displayedFit)}</b></div>
    ${seedArt(line)}
    <div class="card-copy">
      <strong>${escapeHtml(line.label)}</strong>
      <small>${escapeHtml(line.family ?? '')}</small>
    </div>
    ${traitRows(line, { compact: true })}
    ${footer}
    ${actionMarkup}
  </article>`;
}

function parentAsLine(card) {
  return {
    lineId: `card-${card.id}`,
    label: card.label,
    family: card.family,
    hue: card.hue,
    traits: card.traits
  };
}

function projectionFooter(card) {
  const summary = projectionSummary(state.currentLine, card, currentGoal(), data);
  const sign = summary.delta > 0 ? '+' : '';
  const tone = summary.delta >= 0 ? 'positive' : 'negative';
  return `<div class="fit-delta ${tone}"><strong>Projected cross ${summary.fit}%</strong><span>${sign}${summary.delta}% vs current line · midpoint estimate, hidden phenotypes vary</span></div>`;
}

function renderStats() {
  ui.round.textContent = `${state.round} / ${state.maxRounds}`;
  ui.score.textContent = String(state.score);
  ui.fit.textContent = `${state.currentFit}%`;
  ui.refreshes.textContent = String(state.refreshesRemaining);
}

function renderObjective() {
  const goal = currentGoal();
  const priorities = data.traits
    .filter((trait) => Number(goal.weights[trait.id] ?? 0) > 0)
    .sort((a, b) => Number(goal.weights[b.id]) - Number(goal.weights[a.id]))
    .map((trait) => `<span class="goal-chip weight-${goal.weights[trait.id]}">${escapeHtml(trait.label)} ×${goal.weights[trait.id]}</span>`)
    .join('');
  ui.objective.innerHTML = `
    <span class="panel-kicker">RUN OBJECTIVE</span>
    <strong>${escapeHtml(goal.label)}</strong>
    <p>${escapeHtml(goal.description)}</p>
    <div class="goal-chips">${priorities}</div>`;
}

function renderCurrent() {
  ui.current.innerHTML = lineCard(state.currentLine, {
    heading: state.currentLine.generation ? `Generation ${state.currentLine.generation}` : 'Founder Line'
  });
}

function renderDraftChoices() {
  ui.phaseTitle.textContent = `Round ${state.round}: Draft a parent`;
  ui.phaseCopy.textContent = 'Choose one parent. Projection shows the trait midpoint against your objective; the three actual phenotype cards stay hidden until you commit.';
  ui.selectedParent.hidden = true;
  ui.refresh.hidden = false;
  ui.refresh.disabled = state.refreshesRemaining <= 0;
  ui.refresh.textContent = `Refresh Draft (${state.refreshesRemaining})`;
  ui.refresh.setAttribute('aria-keyshortcuts', 'R');
  ui.choices.className = 'choice-grid draft-grid';
  ui.choices.innerHTML = state.offers.map((id, index) => {
    const card = cardById.get(id);
    const parentLine = parentAsLine(card);
    const parentFit = goalFit(parentLine, currentGoal(), data);
    return lineCard(parentLine, {
      heading: `Parent ${index + 1}`,
      action: `Cross with ${card.label}`,
      actionValue: card.id,
      actionShortcut: String(index + 1),
      cardClass: 'parent-card',
      fitLabel: `Parent ${parentFit}%`,
      footer: projectionFooter(card)
    });
  }).join('');
}

function renderPhenotypeChoices() {
  const parent = cardById.get(state.selectedParentId);
  ui.phaseTitle.textContent = `Round ${state.round}: Keep one phenotype`;
  ui.phaseCopy.textContent = 'The hidden variance is now revealed. Compare the three generated cards against the objective, then keep one line for the next round.';
  ui.refresh.hidden = true;
  ui.selectedParent.hidden = false;
  ui.selectedParent.innerHTML = `<span class="panel-kicker">SELECTED PARENT</span><strong>${escapeHtml(parent.label)}</strong><span>${escapeHtml(parent.family)}</span>`;
  ui.choices.className = 'choice-grid phenotype-grid';
  ui.choices.innerHTML = state.phenotypes.map((line, index) => {
    const fit = goalFit(line, currentGoal(), data);
    const delta = fit - state.currentFit;
    const deltaCopy = delta > 0 ? `+${delta}` : String(delta);
    const footer = `<div class="fit-delta ${delta >= 0 ? 'positive' : 'negative'}">${deltaCopy}% vs current line</div>`;
    return lineCard(line, {
      heading: `Phenotype ${String.fromCharCode(65 + index)}`,
      action: `Keep ${line.label}`,
      actionValue: line.lineId,
      actionShortcut: String(index + 1),
      cardClass: delta > 0 ? 'pheno-card improving' : 'pheno-card',
      footer
    });
  }).join('');
}

function renderComplete() {
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
    item.innerHTML = `<span class="archive-round">R${entry.round}</span><div><strong>${escapeHtml(entry.line.label)}</strong><small>${entry.fit}% fit · ${sign}${entry.improvement}% change · +${entry.roundScore} pts</small></div>`;
    ui.archive.append(item);
  }
}

function renderResult() {
  if (state.status !== 'complete') {
    ui.result.className = 'result-panel waiting';
    ui.result.innerHTML = '<span class="panel-kicker">RUN STATUS</span><strong>Build the line.</strong><p>Six rounds. Two refreshes. One final keeper.</p>';
    return;
  }
  ui.result.className = 'result-panel complete';
  ui.result.innerHTML = `
    <span class="panel-kicker">FINAL RANK</span>
    <strong>${escapeHtml(runRank(state, data))}</strong>
    <p>${escapeHtml(state.currentLine.label)} finished at <b>${state.currentFit}% objective fit</b> with <b>${state.score} points</b>.</p>
    <div class="rank-badge" aria-hidden="true"><span>PD</span></div>`;
}

function render() {
  renderStats();
  renderObjective();
  renderCurrent();
  renderChoices();
  renderArchive();
  renderResult();
  setCode(state.code);
}

function resetRun(code) {
  state = createRun({ code }, data);
  window.history.replaceState(null, '', challengeUrl());
  render();
}

function chooseVisibleCard(index) {
  if (!state || state.status !== 'playing') return;
  const buttons = [...ui.choices.querySelectorAll('button[data-choice]')];
  const button = buttons[index];
  if (button) button.click();
}

ui.choices.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-choice]');
  if (!button || state.status !== 'playing') return;
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
      ui.announce.textContent = state.status === 'complete'
        ? `${chosen.label} kept. Draft complete. Final rank ${state.finalRank}.`
        : `${chosen.label} kept. Round ${state.round} parent draft ready.`;
    }
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error.message;
  }
});

ui.refresh.addEventListener('click', () => {
  try {
    state = refreshDraft(state, data);
    render();
    ui.announce.textContent = `Draft refreshed. ${state.refreshesRemaining} refresh token${state.refreshesRemaining === 1 ? '' : 's'} remaining.`;
  } catch (error) {
    ui.announce.textContent = error.message;
  }
});

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidRunCode(ui.code.value)) {
    ui.announce.textContent = 'Enter a complete six-character Pheno Draft code.';
    return;
  }
  resetRun(ui.code.value);
  ui.announce.textContent = `Pheno Draft code ${state.code} loaded.`;
});

ui.newRun.addEventListener('click', () => {
  resetRun(randomCode());
  ui.announce.textContent = `New Pheno Draft run ${state.code}.`;
});

ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `Pheno Draft · run ${state.code}\n${url}`;
  try {
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Pheno Draft challenge copied.';
  } catch {
    ui.announce.textContent = `Share run code ${state.code}: ${url}`;
  }
});

function shortcutTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"]'));
}

document.addEventListener('keydown', (event) => {
  if (shortcutTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
  if ((event.key === 'r' || event.key === 'R') && state?.phase === 'draft' && state.refreshesRemaining > 0) {
    event.preventDefault();
    ui.refresh.click();
    return;
  }
  if (!['1', '2', '3'].includes(event.key) || state?.status !== 'playing') return;
  event.preventDefault();
  chooseVisibleCard(Number(event.key) - 1);
});

async function load() {
  try {
    const response = await fetch('./data/cards.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Pheno Draft data HTTP ${response.status}`);
    data = await response.json();
    if (data.schemaVersion !== 1 || data.rounds !== 6 || data.refreshTokens !== 2 || data.traits?.length !== 7 || data.goals?.length !== 6 || data.cards?.length !== 20) {
      throw new Error('Pheno Draft data contract mismatch');
    }
    cardById = new Map(data.cards.map((card) => [card.id, card]));
    goalById = new Map(data.goals.map((goal) => [goal.id, goal]));

    const requested = normalizeRunCode(new URLSearchParams(location.search).get('draft'));
    const code = isValidRunCode(requested) ? requested : randomCode();
    state = createRun({ code }, data);
    window.history.replaceState(null, '', challengeUrl());
    ui.load.textContent = '6 rounds · projected crosses · hidden phenotype variance · 2 refreshes';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Pheno Draft could not load its card data.';
  }
}

load();
