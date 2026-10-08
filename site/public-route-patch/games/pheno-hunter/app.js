import {
  HUNTER_ALPHABET,
  HUNTER_CODE_LENGTH,
  OBSERVATION_BUDGET,
  SHORTLIST_LIMIT,
  createHunt,
  observe,
  toggleShortlist,
  finalizeKeeper,
  normalizeHunterCode,
  isValidHunterCode,
  isObserved,
  topCandidates
} from './engine.mjs';

const ui = Object.fromEntries([
  'load-status','token-stat','shortlist-stat','observed-stat','code-stat','brief-title','brief-summary','brief-weights','candidate-grid','shortlist','hunt-code','new-code','share-hunt','result-panel','result-title','result-score','result-breakdown','result-ranking','next-hunt','announce'
].map((id) => [id, document.getElementById(id)]));

let data;
let state;
const candidates = new Map();
const briefs = new Map();

function randomCode() {
  const bytes = new Uint32Array(HUNTER_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => HUNTER_ALPHABET[value % HUNTER_ALPHABET.length]).join('');
}

function codeFromUrl() {
  const value = new URLSearchParams(location.search).get('hunt');
  return isValidHunterCode(value) ? normalizeHunterCode(value) : randomCode();
}

function syncUrl() {
  const url = new URL(location.href);
  url.searchParams.set('hunt', state.code);
  window.history.replaceState(null, '', url);
}

function escapeText(value) {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span.innerHTML;
}

function qualityWord(value) {
  if (value >= 9) return 'Elite';
  if (value >= 8) return 'Strong';
  if (value >= 6) return 'Solid';
  if (value >= 4) return 'Mixed';
  return 'Weak';
}

function metricMarkup(traitId, value, hidden = false) {
  const label = data.traitLabels[traitId];
  return `<div class="metric${hidden ? ' hidden-metric' : ''}"><div><span>${escapeText(label)}</span><strong>${value}/10</strong></div><div class="meter" aria-hidden="true"><span style="width:${value * 10}%"></span></div></div>`;
}

function startHunt(code) {
  state = createHunt({ code }, data);
  ui['hunt-code'].value = state.code;
  ui['hunt-code'].setAttribute('aria-invalid', 'false');
  syncUrl();
  render();
  ui.announce.textContent = `Pheno Hunter cohort ${state.code} loaded. ${briefs.get(state.briefId).title}.`;
}

function renderBrief() {
  const brief = briefs.get(state.briefId);
  ui['brief-title'].textContent = brief.title;
  ui['brief-summary'].textContent = brief.summary;
  const weighted = Object.entries(brief.weights).sort((a, b) => b[1] - a[1] || data.traitLabels[a[0]].localeCompare(data.traitLabels[b[0]]));
  ui['brief-weights'].replaceChildren(...weighted.map(([traitId, weight]) => {
    const item = document.createElement('div');
    item.className = weight >= 20 ? 'weight-chip priority' : 'weight-chip';
    item.innerHTML = `<span>${escapeText(data.traitLabels[traitId])}</span><strong>${weight}%</strong>`;
    return item;
  }));
}

function scoutTrait(candidateId, traitId) {
  const candidate = candidates.get(candidateId);
  state = observe(state, { candidateId, traitId }, data);
  render();
  ui.announce.textContent = `${candidate.name}: ${data.traitLabels[traitId]} ${candidate.traits[traitId]} out of 10, ${qualityWord(candidate.traits[traitId])}.`;
}

function shortlistCandidate(candidateId) {
  const candidate = candidates.get(candidateId);
  try {
    const removing = state.shortlisted.includes(candidateId);
    state = toggleShortlist(state, candidateId, data);
    render();
    ui.announce.textContent = `${candidate.name} ${removing ? 'removed from' : 'added to'} the shortlist.`;
  } catch (error) {
    ui.announce.textContent = error.message;
  }
}

function lockKeeper(candidateId) {
  const candidate = candidates.get(candidateId);
  state = finalizeKeeper(state, candidateId, data);
  render();
  ui['result-panel'].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  ui.announce.textContent = `${candidate.name} selected. Final scouting score ${state.result.score}. ${state.result.rank}.`;
}

function renderCandidate(candidateId, index) {
  const candidate = candidates.get(candidateId);
  const shortlisted = state.shortlisted.includes(candidateId);
  const complete = state.status === 'complete';
  const shortlistFull = state.shortlisted.length >= SHORTLIST_LIMIT;
  const article = document.createElement('article');
  article.className = `candidate-card${shortlisted ? ' shortlisted' : ''}${complete && state.result.selectedCandidateId === candidateId ? ' selected-keeper' : ''}`;
  article.style.setProperty('--vigor', candidate.traits.vigor);
  article.style.setProperty('--structure', candidate.traits.structure);

  const visible = data.visibleTraits.map((traitId) => metricMarkup(traitId, candidate.traits[traitId])).join('');
  const hidden = data.hiddenTraits.map((traitId) => {
    const revealed = complete || isObserved(state, candidateId, traitId);
    if (revealed) return metricMarkup(traitId, candidate.traits[traitId], true);
    const disabled = state.observationBudget <= 0;
    return `<button type="button" class="scout-button" data-scout="${candidateId}:${traitId}" ${disabled ? 'disabled' : ''}><span>Scout ${escapeText(data.traitLabels[traitId])}</span><small>1 token</small></button>`;
  }).join('');

  const fit = complete ? topCandidates(state, data).find((item) => item.candidateId === candidateId)?.fit : null;
  article.innerHTML = `
    <div class="candidate-top">
      <div class="plant-avatar" aria-hidden="true"><span class="avatar-stem"></span><i class="av-leaf l1"></i><i class="av-leaf l2"></i><i class="av-leaf l3"></i><i class="av-leaf l4"></i><i class="av-leaf l5"></i><span class="avatar-pot"></span></div>
      <div class="candidate-id"><span class="candidate-number">PHENO ${String(index + 1).padStart(2, '0')}</span><h3>${escapeText(candidate.name)}</h3><p>${escapeText(candidate.family)}</p></div>
      ${shortlisted ? '<span class="keeper-pin">SHORTLIST</span>' : ''}
    </div>
    <p class="tagline">${escapeText(candidate.tagline)}</p>
    <div class="metric-group"><p class="panel-label">Visible field notes</p>${visible}</div>
    <div class="hidden-group"><p class="panel-label">Scout-only traits</p>${hidden}</div>
    ${complete ? `<div class="fit-reveal"><span>Brief fit</span><strong>${fit}/100</strong></div>` : ''}
    <button type="button" class="shortlist-button${shortlisted ? ' active' : ''}" data-shortlist="${candidateId}" ${complete || (!shortlisted && shortlistFull) ? 'disabled' : ''}>${shortlisted ? 'Remove from shortlist' : shortlistFull ? 'Shortlist full' : 'Add to shortlist'}</button>
  `;

  article.querySelectorAll('[data-scout]').forEach((button) => button.addEventListener('click', () => {
    const [, traitId] = button.dataset.scout.split(':');
    scoutTrait(candidateId, traitId);
  }));
  article.querySelector('[data-shortlist]')?.addEventListener('click', () => shortlistCandidate(candidateId));
  return article;
}

function renderCandidates() {
  ui['candidate-grid'].replaceChildren(...state.cohortIds.map(renderCandidate));
}

function renderShortlist() {
  if (!state.shortlisted.length) {
    ui.shortlist.innerHTML = '<p class="empty-state">No candidates shortlisted yet.</p>';
    return;
  }
  ui.shortlist.replaceChildren(...state.shortlisted.map((candidateId, index) => {
    const candidate = candidates.get(candidateId);
    const row = document.createElement('div');
    row.className = `shortlist-row${state.status === 'complete' && state.result.selectedCandidateId === candidateId ? ' winner' : ''}`;
    row.innerHTML = `<span><small>#${index + 1}</small><strong>${escapeText(candidate.name)}</strong></span>${state.status === 'scouting' ? `<button type="button" data-lock="${candidateId}">Lock keeper</button>` : state.result.selectedCandidateId === candidateId ? '<em>Selected</em>' : '<em>Finalist</em>'}`;
    row.querySelector('[data-lock]')?.addEventListener('click', () => lockKeeper(candidateId));
    return row;
  }));
}

function renderResult() {
  const complete = state.status === 'complete';
  ui['result-panel'].hidden = !complete;
  if (!complete) return;
  const result = state.result;
  const selected = candidates.get(result.selectedCandidateId);
  const best = candidates.get(result.bestCandidateId);
  const foundBest = result.selectedCandidateId === result.bestCandidateId;
  ui['result-title'].textContent = result.rank;
  ui['result-score'].innerHTML = `<strong>${result.score}</strong><span>/100 scouting score</span><p>${foundBest ? `You found the top-fit keeper: ${escapeText(selected.name)}.` : `${escapeText(selected.name)} scored ${result.selectedFit} fit. The cohort's top fit was ${escapeText(best.name)} at ${result.bestFit}.`}</p>`;
  ui['result-breakdown'].innerHTML = `
    <div><span>Objective fit</span><strong>${result.qualityScore}/70</strong></div>
    <div><span>Keeper evidence</span><strong>${result.evidenceScore}/20</strong></div>
    <div><span>Comparison</span><strong>${result.comparisonScore}/10</strong></div>`;
  const ranking = topCandidates(state, data).slice(0, 3);
  ui['result-ranking'].innerHTML = `<p class="panel-label">True top three for this brief</p>${ranking.map((entry, index) => `<div><span>${index + 1}. ${escapeText(candidates.get(entry.candidateId).name)}</span><strong>${entry.fit}</strong></div>`).join('')}`;
}

function renderStatus() {
  ui['token-stat'].textContent = state.observationBudget;
  ui['shortlist-stat'].textContent = `${state.shortlisted.length} / ${SHORTLIST_LIMIT}`;
  ui['observed-stat'].textContent = `${state.observations.length} ${state.observations.length === 1 ? 'trait' : 'traits'}`;
  ui['code-stat'].textContent = state.code;
}

function render() {
  renderStatus();
  renderBrief();
  renderCandidates();
  renderShortlist();
  renderResult();
}

ui['hunt-code'].addEventListener('input', () => {
  const normalized = normalizeHunterCode(ui['hunt-code'].value);
  ui['hunt-code'].value = normalized;
  ui['hunt-code'].setAttribute('aria-invalid', String(normalized.length > 0 && normalized.length !== HUNTER_CODE_LENGTH));
});

ui['hunt-code'].addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidHunterCode(ui['hunt-code'].value)) {
    ui['hunt-code'].setAttribute('aria-invalid', 'true');
    ui.announce.textContent = 'Enter a full six-character hunt code.';
    return;
  }
  startHunt(ui['hunt-code'].value);
});

ui['new-code'].addEventListener('click', () => startHunt(randomCode()));
ui['next-hunt'].addEventListener('click', () => startHunt(randomCode()));
ui['share-hunt'].addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('hunt', state.code);
  try {
    await navigator.clipboard.writeText(url.toString());
    ui['share-hunt'].textContent = 'Link copied';
  } catch {
    ui['share-hunt'].textContent = state.code;
  }
  setTimeout(() => { ui['share-hunt'].textContent = 'Copy challenge link'; }, 1800);
});

async function boot() {
  try {
    const response = await fetch('./data/phenos.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (data.candidates?.length !== 18) throw new Error('Expected 18 fictional candidates.');
    if (data.briefs?.length !== 6) throw new Error('Expected six keeper briefs.');
    data.candidates.forEach((candidate) => candidates.set(candidate.id, candidate));
    data.briefs.forEach((brief) => briefs.set(brief.id, brief));
    ui['load-status'].textContent = 'Greenhouse online';
    ui['load-status'].classList.add('ready');
    startHunt(codeFromUrl());
  } catch (error) {
    console.error(error);
    ui['load-status'].textContent = 'Cohort data unavailable';
    ui['candidate-grid'].innerHTML = '<div class="load-error"><strong>Pheno Hunter could not open the candidate bank.</strong><p>Return to the Game Hub and try again.</p></div>';
  }
}

boot();
