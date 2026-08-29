(() => {
  const candidates = document.querySelector('#candidate-grid');
  const questions = document.querySelector('#question-groups');
  const heading = document.querySelector('#candidates-heading');
  const candidatesLeft = document.querySelector('#candidates-left');
  const announce = document.querySelector('#announce');
  if (!candidates || !heading || !candidatesLeft) return;

  let selectedButton = null;
  let allowNextGuess = false;

  const panel = candidates.closest('.panel');
  const controls = document.createElement('div');
  controls.className = 'guess-confirm-bar';
  controls.hidden = true;
  controls.innerHTML = `
    <div class="guess-confirm-copy">
      <span>GUESS READY</span>
      <strong id="guess-confirm-name">Select a candidate</strong>
      <small>A guess is only spent after confirmation.</small>
    </div>
    <div class="guess-confirm-actions">
      <button id="confirm-guess" class="control primary" type="button">Confirm Guess</button>
      <button id="cancel-guess" class="control ghost" type="button">Cancel</button>
    </div>`;

  const progress = document.createElement('div');
  progress.className = 'candidate-progress';
  progress.innerHTML = `
    <div class="candidate-progress-copy"><span>ELIMINATION PROGRESS</span><strong id="candidate-progress-label">0 eliminated</strong></div>
    <div class="candidate-progress-track" aria-hidden="true"><i id="candidate-progress-fill"></i></div>`;

  panel.insertBefore(progress, candidates);
  panel.insertBefore(controls, candidates);

  const name = controls.querySelector('#guess-confirm-name');
  const confirm = controls.querySelector('#confirm-guess');
  const cancel = controls.querySelector('#cancel-guess');
  const progressLabel = progress.querySelector('#candidate-progress-label');
  const progressFill = progress.querySelector('#candidate-progress-fill');

  function liveCandidates() {
    return [...candidates.querySelectorAll('button[data-guess]:not(:disabled)')];
  }

  function updateProgress() {
    const remaining = Number.parseInt(candidatesLeft.textContent || '20', 10);
    const safeRemaining = Number.isFinite(remaining) ? Math.max(0, Math.min(20, remaining)) : liveCandidates().length;
    const eliminated = 20 - safeRemaining;
    const percent = Math.round((eliminated / 20) * 100);
    progressLabel.textContent = `${eliminated} eliminated · ${safeRemaining} remain`;
    progressFill.style.width = `${percent}%`;
    progress.setAttribute('aria-label', `${eliminated} of 20 candidates eliminated; ${safeRemaining} remain.`);
  }

  function clearSelection({ focusGrid = false } = {}) {
    for (const button of candidates.querySelectorAll('button[data-guess]')) {
      button.classList.remove('guess-selected');
      button.setAttribute('aria-pressed', 'false');
    }
    selectedButton = null;
    controls.hidden = true;
    if (focusGrid) candidates.querySelector('button[data-guess]:not(:disabled)')?.focus();
  }

  function selectCandidate(button) {
    if (!button || button.disabled) return;
    for (const candidate of candidates.querySelectorAll('button[data-guess]')) {
      const selected = candidate === button;
      candidate.classList.toggle('guess-selected', selected);
      candidate.setAttribute('aria-pressed', String(selected));
    }
    selectedButton = button;
    const candidateName = button.querySelector('strong')?.textContent?.trim() || 'Selected candidate';
    name.textContent = candidateName;
    controls.hidden = false;
    confirm.disabled = false;
    announce.textContent = `${candidateName} selected. Confirm Guess to spend one guess, or Cancel.`;
    confirm.focus({ preventScroll: true });
  }

  candidates.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-guess]');
    if (!button || button.disabled) return;
    if (allowNextGuess) {
      allowNextGuess = false;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    selectCandidate(button);
  }, true);

  confirm.addEventListener('click', () => {
    if (!selectedButton || !selectedButton.isConnected || selectedButton.disabled) {
      clearSelection();
      announce.textContent = 'That candidate is no longer available. Choose another candidate.';
      return;
    }
    const target = selectedButton;
    allowNextGuess = true;
    controls.hidden = true;
    target.click();
    queueMicrotask(() => {
      allowNextGuess = false;
      selectedButton = null;
      updateProgress();
    });
  });

  cancel.addEventListener('click', () => {
    const label = selectedButton?.querySelector('strong')?.textContent?.trim() || 'Guess';
    clearSelection({ focusGrid: true });
    announce.textContent = `${label} guess cancelled. No guess was spent.`;
  });

  questions?.addEventListener('click', (event) => {
    if (!event.target.closest('button[data-question]')) return;
    if (selectedButton) clearSelection();
  }, true);

  const observer = new MutationObserver(() => {
    if (selectedButton && !selectedButton.isConnected) {
      selectedButton = null;
      controls.hidden = true;
    }
    for (const button of candidates.querySelectorAll('button[data-guess]')) {
      if (!button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', 'false');
    }
    updateProgress();
  });
  observer.observe(candidates, { childList: true, subtree: true });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && selectedButton) {
      event.preventDefault();
      clearSelection({ focusGrid: true });
      announce.textContent = 'Prepared guess cancelled. No guess was spent.';
    }
  });

  for (const button of candidates.querySelectorAll('button[data-guess]')) button.setAttribute('aria-pressed', 'false');
  updateProgress();
})();
