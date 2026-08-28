import { fetchJson } from './_runtime/src/data/fetch-json.js';
import { canUsePairingRule } from './_runtime/src/engine/breeding.js';
import { addStoredUnit } from './_runtime/src/engine/game-state.js';
import {
  addLineageTimer,
  createLineageTimer,
  refreshLineageTimers,
  removeLineageTimer
} from './_runtime/src/engine/lineage-timers.js';
import { createLineageResult } from './_runtime/src/engine/lineage-result-factory.js';
import { loadSave, writeSave } from './_runtime/src/engine/save.js';
import { renderVaultGardenPanel } from './_runtime/src/ui/vault-garden-ui.js';

const lineagePanel = document.querySelector('#lineage-lab-panel');
const vaultGardenPanel = document.querySelector('#vault-garden-panel');
const CROSS_DURATION_SECONDS = 12;

let cachedDataPromise = null;
let hydrateQueued = false;

function loadLineageData() {
  cachedDataPromise ??= Promise.all([
    fetchJson('./_runtime/data/breeding/pairing_rules_mvp.json'),
    fetchJson('./_runtime/data/breeding/result_units_mvp.json')
  ]).then(([pairingRules, resultUnits]) => ({ pairingRules, resultUnits }));
  return cachedDataPromise;
}

function getProgressionState(saveData) {
  return {
    rank: saveData.player?.rank,
    unlockedRegions: saveData.world?.unlockedRegions ?? []
  };
}

function refreshAndPersist(saveData = loadSave()) {
  const before = saveData.vaultGarden?.lineageTimers ?? [];
  const refreshed = refreshLineageTimers(saveData);
  const after = refreshed.vaultGarden?.lineageTimers ?? [];
  const changed = before.some((timer, index) => timer.status !== after[index]?.status);
  if (changed) writeSave(refreshed);
  return refreshed;
}

function getStatusNode() {
  if (!lineagePanel) return null;
  let node = lineagePanel.querySelector('[data-lineage-runtime-status]');
  if (!node) {
    node = document.createElement('p');
    node.className = 'helper-text';
    node.dataset.lineageRuntimeStatus = 'true';
    lineagePanel.querySelector('.lineage-lab-panel')?.append(node);
  }
  return node;
}

function setStatus(message) {
  const node = getStatusNode();
  if (node && node.textContent !== message) node.textContent = message;
}

function renderVault(saveData) {
  renderVaultGardenPanel({
    container: vaultGardenPanel,
    vaultGarden: saveData.vaultGarden
  });
}

async function hydrateControls() {
  hydrateQueued = false;
  if (!lineagePanel) return;

  const { pairingRules } = await loadLineageData();
  const saveData = refreshAndPersist();
  const timers = saveData.vaultGarden?.lineageTimers ?? [];
  const progression = getProgressionState(saveData);

  lineagePanel.querySelectorAll('[data-lineage-start]').forEach((button) => {
    const rule = pairingRules.find((candidate) => candidate.id === button.dataset.lineageStart);
    if (!rule) {
      button.disabled = true;
      if (button.textContent !== 'Cross unavailable') button.textContent = 'Cross unavailable';
      return;
    }

    const timer = timers.find((candidate) => candidate.pairingRuleId === rule.id) ?? null;
    const allowed = canUsePairingRule(rule, progression);
    button.disabled = !allowed;
    button.dataset.lineageTimerId = timer?.id ?? '';

    const nextLabel = !allowed
      ? 'Cross locked'
      : !timer
        ? 'Start Cross'
        : timer.status === 'ready'
          ? 'Claim Offspring'
          : 'Refresh Cross';

    if (button.textContent !== nextLabel) button.textContent = nextLabel;
  });
}

function queueHydrate() {
  if (hydrateQueued) return;
  hydrateQueued = true;
  queueMicrotask(() => hydrateControls().catch((error) => {
    hydrateQueued = false;
    console.error('PhenoQuest lineage control hydration failed.', error);
  }));
}

async function startCross(rule) {
  let saveData = refreshAndPersist();
  if (!canUsePairingRule(rule, getProgressionState(saveData))) {
    setStatus('This cross is still locked by rank or region progress.');
    return;
  }

  const existing = (saveData.vaultGarden?.lineageTimers ?? []).find((timer) => timer.pairingRuleId === rule.id);
  if (existing) return handleExistingTimer(existing, rule, saveData);

  const timer = createLineageTimer({
    id: `${rule.id}_${Date.now()}`,
    pairingRuleId: rule.id,
    parentA: rule.parentA,
    parentB: rule.parentB,
    durationSeconds: CROSS_DURATION_SECONDS,
    weatherAtStart: saveData.world?.weather ?? null,
    cueAtStart: saveData.world?.cue ?? null
  });

  saveData = addLineageTimer(saveData, timer);
  writeSave(saveData);
  renderVault(saveData);
  setStatus(`Cross started. The demo batch will be ready in about ${CROSS_DURATION_SECONDS} seconds.`);
  queueHydrate();
}

async function handleExistingTimer(timer, rule, saveData = refreshAndPersist()) {
  const currentTimer = (saveData.vaultGarden?.lineageTimers ?? []).find((candidate) => candidate.id === timer.id) ?? timer;
  if (currentTimer.status !== 'ready') {
    writeSave(saveData);
    renderVault(saveData);
    setStatus('Cross is still developing. Refresh again after the timer finishes.');
    queueHydrate();
    return;
  }

  const { resultUnits } = await loadLineageData();
  const result = createLineageResult({ pairingRule: rule, resultUnits, timer: currentTimer });
  if (!result) {
    setStatus('This cross has no valid offspring result in the current MVP data.');
    return;
  }

  const withoutTimer = removeLineageTimer(saveData, currentTimer.id);
  const nextSave = addStoredUnit(withoutTimer, result);
  writeSave(nextSave);
  renderVault(nextSave);
  setStatus(`${result.displayName} was produced and stored in the Vault Garden (${result.quality}).`);
  queueHydrate();
}

lineagePanel?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-lineage-start]');
  if (!button) return;

  event.preventDefault();
  button.disabled = true;
  try {
    const { pairingRules } = await loadLineageData();
    const rule = pairingRules.find((candidate) => candidate.id === button.dataset.lineageStart);
    if (!rule) {
      setStatus('Pairing rule not found.');
      return;
    }
    await startCross(rule);
  } catch (error) {
    console.error('PhenoQuest lineage action failed.', error);
    setStatus('The Lineage Lab action failed. Check the browser console and game data.');
  } finally {
    queueHydrate();
  }
});

if (lineagePanel) {
  const observer = new MutationObserver((records) => {
    const externalChange = records.some((record) => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      return target && !target.closest('[data-lineage-runtime-status]');
    });
    if (externalChange) queueHydrate();
  });
  observer.observe(lineagePanel, { childList: true, subtree: true });
  queueHydrate();
}
