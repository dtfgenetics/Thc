const debugEnabled = (() => {
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    return params.get('debug') === '1' || ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname || '');
  } catch {
    return false;
  }
})();

if (debugEnabled) {
  const { createReplayRecorder, serializeReplayBundle } = await import('/games/shared-platform/index.mjs');

  const $ = (selector) => document.querySelector(selector);
  let recorder = null;
  let completionRecorded = false;
  let lastPresentedQuestionId = null;

  function datasetVersion() {
    return ($('#hero-version')?.textContent || 'current').trim() || 'current';
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function selectedLetter() {
    return $('#answer-options [aria-pressed="true"]')?.dataset?.letter || null;
  }

  function currentQuestionId() {
    return ($('#question-id')?.textContent || '').trim() || null;
  }

  function recordQuestionPresented() {
    if (!recorder) return;
    const questionId = currentQuestionId();
    if (!questionId || questionId === lastPresentedQuestionId) return;
    lastPresentedQuestionId = questionId;
    recorder.record('question_presented', {
      questionId,
      category: ($('#question-category')?.textContent || '').trim(),
      difficulty: ($('#question-difficulty')?.textContent || '').trim(),
      pointsText: ($('#question-points')?.textContent || '').trim(),
      progressText: ($('#progress-text')?.textContent || '').trim(),
    });
  }

  function beginRun(mode) {
    const version = datasetVersion();
    const dailyCode = mode === 'daily' ? `${localDateKey()}|${version}` : null;
    recorder = createReplayRecorder({
      gameId: 'high-iq',
      releaseVersion: `high-iq-v3.3/data-${version}`,
      seedOrCode: dailyCode,
      saveVersion: 1,
      client: {
        viewport: `${globalThis.innerWidth || 0}x${globalThis.innerHeight || 0}`,
        inputMode: globalThis.matchMedia?.('(pointer: coarse)')?.matches ? 'touch' : 'pointer',
      },
    });
    completionRecorded = false;
    lastPresentedQuestionId = null;
    recorder.record('session_start', {
      mode,
      category: $('#category-filter')?.value || 'all',
      difficulty: $('#difficulty-filter')?.value || 'all',
      requestedCount: Number.parseInt($('#question-count')?.value || '0', 10) || null,
      datasetVersion: version,
    });
    setTimeout(recordQuestionPresented, 0);
  }

  function recordCompletion() {
    if (!recorder || completionRecorded || $('#results-panel')?.hidden) return;
    completionRecorded = true;
    const result = {
      scoreText: ($('#result-score')?.textContent || '').trim(),
      accuracyText: ($('#result-accuracy')?.textContent || '').trim(),
      rank: ($('#result-rank')?.textContent || '').trim(),
      bestStreakText: ($('#result-streak')?.textContent || '').trim(),
      detail: ($('#result-detail')?.textContent || '').trim(),
    };
    recorder.record('session_complete', result);
    recorder.setResult(result);
    recorder.setStateSnapshot({
      progressText: ($('#progress-text')?.textContent || '').trim(),
      liveScoreText: ($('#live-score')?.textContent || '').trim(),
      liveAccuracyText: ($('#live-accuracy')?.textContent || '').trim(),
    });
  }

  $('#start-quiz')?.addEventListener('click', () => beginRun($('#question-mode')?.value || 'balanced'));
  $('#daily-start')?.addEventListener('click', () => beginRun('daily'));
  $('#daily-hero-start')?.addEventListener('click', () => beginRun('daily'));
  $('#practice-missed')?.addEventListener('click', () => beginRun('missed'));
  $('#restart-quiz')?.addEventListener('click', () => {
    recorder?.record('return_to_setup');
  });

  $('#answer-options')?.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-letter]');
    if (!recorder || !button) return;
    recorder.record('answer_select', {
      questionId: currentQuestionId(),
      letter: button.dataset.letter,
    });
  });

  $('#lock-answer')?.addEventListener('click', () => {
    if (!recorder) return;
    const questionId = currentQuestionId();
    const letter = selectedLetter();
    setTimeout(() => {
      recorder?.record('answer_lock', {
        questionId,
        selectedLetter: letter,
        correct: Boolean($('#answer-feedback')?.classList.contains('correct')),
      });
    }, 0);
  });

  $('#next-question')?.addEventListener('click', () => {
    const fromQuestionId = lastPresentedQuestionId || currentQuestionId();
    recorder?.record('advance', { fromQuestionId });
    setTimeout(() => {
      recordQuestionPresented();
      recordCompletion();
    }, 0);
  });

  const resultsPanel = $('#results-panel');
  if (resultsPanel) {
    new MutationObserver(recordCompletion).observe(resultsPanel, { attributes: true, attributeFilter: ['hidden'] });
  }

  globalThis.__DTF_HIGH_IQ_DEBUG__ = Object.freeze({
    enabled: true,
    exportReplay: () => recorder?.exportBundle() ?? null,
    exportReplayText: () => recorder ? serializeReplayBundle(recorder.exportBundle()) : null,
    actionCount: () => recorder?.getActions().length ?? 0,
    clear: () => {
      recorder?.clear();
      recorder = null;
      completionRecorded = false;
      lastPresentedQuestionId = null;
    },
  });

  console.info('High IQ shared replay debug adapter enabled');
}
