(() => {
  const gamePanel = document.querySelector('#game-panel');
  if (!gamePanel) return;

  const panel = document.createElement('section');
  panel.className = 'panel career-log-panel';
  panel.id = 'career-log-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="section-title">
      <div><p class="eyebrow">CAREER LOG</p><h2>Recent decisions</h2></div>
      <button type="button" class="log-toggle" id="career-log-toggle" aria-expanded="true">Hide log</button>
    </div>
    <p class="hint">Review what changed before choosing the next move. Keyboard: 1–6 chooses an available action, Enter continues after an event.</p>
    <div class="career-log" id="career-log"></div>
  `;
  gamePanel.append(panel);

  const log = panel.querySelector('#career-log');
  const toggle = panel.querySelector('#career-log-toggle');

  function summarizeDelta(delta = {}) {
    const entries = Object.entries(delta);
    if (!entries.length) return 'No resource change';
    return entries.map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${resourceLabels?.[key] || key}`).join(' · ');
  }

  function renderCareerLog() {
    if (!state || !Array.isArray(state.history) || !state.history.length) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    const recent = state.history.slice(-4).reverse();
    log.replaceChildren(...recent.map((record) => {
      const article = document.createElement('article');
      article.className = 'career-log-entry';
      const combined = {};
      for (const source of [record.action?.resourceChange || {}, record.event?.resourceChange || {}]) {
        for (const [key, value] of Object.entries(source)) combined[key] = (combined[key] || 0) + value;
      }
      article.innerHTML = `
        <div class="career-log-turn"><span>TURN ${record.turn}</span><strong>${record.action?.label || 'Decision'}</strong></div>
        <p>${record.event?.title || 'Event'} · ${summarizeDelta(combined)}</p>
        ${record.transition ? `<small>Era gate: ${record.transition.met}/${record.transition.total} requirements met</small>` : ''}
      `;
      return article;
    }));
  }

  function refreshActionShortcuts() {
    document.querySelectorAll('.action-card').forEach((button, index) => {
      if (index >= 9) return;
      const shortcut = String(index + 1);
      if (button.dataset.shortcut !== shortcut) button.dataset.shortcut = shortcut;
      if (button.getAttribute('aria-keyshortcuts') !== shortcut) button.setAttribute('aria-keyshortcuts', shortcut);
      if (!button.querySelector('.action-shortcut')) {
        const key = document.createElement('kbd');
        key.className = 'action-shortcut';
        key.textContent = shortcut;
        button.append(key);
      }
    });
  }

  function refresh() {
    renderCareerLog();
    refreshActionShortcuts();
  }

  toggle.addEventListener('click', () => {
    const collapsed = log.hidden = !log.hidden;
    toggle.textContent = collapsed ? 'Show log' : 'Hide log';
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

    if (/^[1-6]$/.test(event.key) && !document.querySelector('#game-panel')?.hidden && document.querySelector('#event-panel')?.hidden) {
      const button = [...document.querySelectorAll('.action-card.available')].find((candidate) => candidate.dataset.shortcut === event.key);
      if (button && !button.disabled) {
        event.preventDefault();
        button.click();
      }
      return;
    }

    if (event.key === 'Enter' && !document.querySelector('#event-panel')?.hidden) {
      const continueButton = document.querySelector('#continue-button');
      if (continueButton && !continueButton.disabled) {
        event.preventDefault();
        continueButton.click();
      }
    }
  });

  const observer = new MutationObserver((mutations) => {
    const externalChange = mutations.some((mutation) => !mutation.target.closest?.('#career-log-panel'));
    if (externalChange) queueMicrotask(refresh);
  });
  observer.observe(gamePanel, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });
  document.addEventListener('click', () => queueMicrotask(refresh));
  refresh();
})();
