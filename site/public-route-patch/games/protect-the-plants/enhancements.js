(() => {
  const PREF_KEY = 'burnBudsUxV3';
  const LEGACY_PREF_KEY = 'protectPlantsUxV2';
  const defaultPrefs = { sound: true, haptics: true, confirmShots: false };
  let prefs = { ...defaultPrefs };
  try {
    const stored = localStorage.getItem(PREF_KEY) || localStorage.getItem(LEGACY_PREF_KEY) || '{}';
    prefs = { ...defaultPrefs, ...JSON.parse(stored) };
    if (!localStorage.getItem(PREF_KEY) && stored !== '{}') localStorage.setItem(PREF_KEY, stored);
  } catch {}

  let audioCtx = null;
  let networkState = navigator.onLine ? 'online' : 'offline';
  let lastSyncAt = 0;
  let lastTurnPlayerId = null;
  let lastSoundEventId = '';
  let armedShotKey = '';
  let armedShotUntil = 0;
  let enhanceQueued = false;

  const savePrefs = () => localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  const coord = (row, col) => `${String.fromCharCode(65 + Number(row))}${Number(col) + 1}`;

  function unlockAudio() {
    if (!prefs.sound) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    } catch {}
  }

  function tone(freq, duration = 0.08, delay = 0, type = 'sine', volume = 0.035) {
    if (!prefs.sound) return;
    unlockAudio();
    if (!audioCtx || audioCtx.state !== 'running') return;
    const start = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function sfx(name) {
    if (!prefs.sound) return;
    if (name === 'place') {
      tone(320, 0.06, 0, 'triangle', 0.025);
      tone(440, 0.08, 0.04, 'triangle', 0.02);
    } else if (name === 'rotate') {
      tone(500, 0.05, 0, 'sine', 0.02);
      tone(620, 0.05, 0.04, 'sine', 0.018);
    } else if (name === 'miss') {
      tone(180, 0.11, 0, 'sine', 0.03);
      tone(140, 0.13, 0.06, 'sine', 0.022);
    } else if (name === 'hit') {
      tone(120, 0.09, 0, 'square', 0.035);
      tone(90, 0.12, 0.05, 'triangle', 0.03);
    } else if (name === 'lost') {
      tone(190, 0.12, 0, 'sawtooth', 0.03);
      tone(140, 0.18, 0.09, 'triangle', 0.025);
      tone(95, 0.22, 0.18, 'sine', 0.02);
    } else if (name === 'turn') {
      tone(520, 0.08, 0, 'sine', 0.024);
      tone(660, 0.09, 0.08, 'sine', 0.022);
    } else if (name === 'win') {
      tone(440, 0.11, 0, 'triangle', 0.03);
      tone(554, 0.11, 0.11, 'triangle', 0.03);
      tone(659, 0.18, 0.22, 'triangle', 0.035);
    } else if (name === 'loss') {
      tone(260, 0.13, 0, 'sine', 0.026);
      tone(220, 0.16, 0.11, 'sine', 0.022);
      tone(180, 0.18, 0.23, 'sine', 0.02);
    } else if (name === 'lock') {
      tone(300, 0.07, 0, 'triangle', 0.025);
      tone(480, 0.11, 0.08, 'triangle', 0.025);
    }
  }

  function vibrate(pattern) {
    if (!prefs.haptics || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch {}
  }

  function processEvent(ev, snapshot) {
    if (!ev?.id || ev.id === lastSoundEventId) return;
    lastSoundEventId = ev.id;
    const mine = ev.byPlayerId === identity?.playerId;
    if (ev.type === 'game-finished') {
      const won = snapshot?.winnerId === identity?.playerId;
      sfx(won ? 'win' : 'loss');
      vibrate(won ? [70, 45, 70, 45, 130] : [160, 70, 180]);
      return;
    }
    if (ev.type === 'formation-lost') {
      sfx('lost');
      vibrate(mine ? [55, 35, 90] : [110, 40, 110]);
      return;
    }
    if (ev.type === 'scout') {
      sfx(ev.hit ? 'hit' : 'miss');
      vibrate(ev.hit ? [45, 28, 55] : 24);
    }
  }

  function processState(snapshot) {
    if (!snapshot) return;
    processEvent(snapshot.lastEvent, snapshot);
    if (
      snapshot.status === 'playing' &&
      lastTurnPlayerId &&
      lastTurnPlayerId !== snapshot.turnPlayerId &&
      snapshot.turnPlayerId === identity?.playerId
    ) {
      sfx('turn');
      vibrate([35, 25, 35]);
    }
    lastTurnPlayerId = snapshot.turnPlayerId || null;
    if (snapshot.status === 'playing' && snapshot.turnPlayerId === identity?.playerId) {
      document.title = '● Your Turn · Burn Buds';
    } else if (snapshot.status === 'finished') {
      document.title = `${snapshot.winnerId === identity?.playerId ? 'Victory' : 'Match Over'} · Burn Buds`;
    } else {
      document.title = 'Burn Buds | DTF Genetics';
    }
  }

  function markNetwork(next) {
    networkState = next;
    if (next === 'online') lastSyncAt = Date.now();
    updateNetworkUi();
  }

  function networkLabel() {
    if (networkState === 'offline') return 'Offline';
    if (networkState === 'error') return 'Reconnecting';
    return 'Live';
  }

  function updateNetworkUi() {
    document.querySelectorAll('[data-ptp-network]').forEach(el => {
      el.dataset.state = networkState;
      el.textContent = networkLabel();
      el.title = lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString()}` : networkLabel();
    });
    document.body.classList.toggle('ptp-offline', networkState === 'offline');
  }

  function ensureDialog() {
    if (document.querySelector('#ptpUxDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'ptpUxDialog';
    dialog.className = 'ptp-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="ptp-dialog-card">
        <div class="ptp-dialog-head">
          <div>
            <small>BURN BUDS</small>
            <h2>How to Play & Game Settings</h2>
          </div>
          <button class="ptp-icon-btn" value="close" aria-label="Close">×</button>
        </div>
        <div class="ptp-dialog-grid">
          <section>
            <h3>Quick rules</h3>
            <ol>
              <li>Hide all five cannabis-leaf formations on your 15×15 stash grid.</li>
              <li>Players alternate firing on one opponent cell per turn.</li>
              <li>A hit stays marked. A full formation burns when every cell in it is hit.</li>
              <li>Burn all five opposing formations before your stash is destroyed.</li>
            </ol>
          </section>
          <section>
            <h3>Fast controls</h3>
            <ul>
              <li><kbd>R</kbd> rotate the selected formation.</li>
              <li><kbd>U</kbd> undo the latest placement.</li>
              <li><kbd>C</kbd> clear placement and start over.</li>
              <li>Arrow keys move board focus; <kbd>Enter</kbd> activates a focused cell.</li>
            </ul>
          </section>
        </div>
        <div class="ptp-setting-list">
          <label><span><strong>Sound effects</strong><small>Generated in-browser; no audio files or downloads.</small></span><input type="checkbox" data-ptp-pref="sound"></label>
          <label><span><strong>Haptic feedback</strong><small>Uses your device vibration API when supported.</small></span><input type="checkbox" data-ptp-pref="haptics"></label>
          <label><span><strong>Confirm firing taps</strong><small>Tap a target once to aim, then again to fire. Helps prevent mobile mis-taps.</small></span><input type="checkbox" data-ptp-pref="confirmShots"></label>
        </div>
        <div class="ptp-dialog-actions"><button class="btn primary" value="close">Done</button></div>
      </form>`;
    document.body.appendChild(dialog);
    syncDialogPrefs();
  }

  function syncDialogPrefs() {
    const dialog = document.querySelector('#ptpUxDialog');
    if (!dialog) return;
    dialog.querySelectorAll('[data-ptp-pref]').forEach(input => {
      input.checked = Boolean(prefs[input.dataset.ptpPref]);
    });
  }

  function openDialog() {
    ensureDialog();
    syncDialogPrefs();
    const dialog = document.querySelector('#ptpUxDialog');
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', '');
  }

  function ensureNavTools() {
    const nav = document.querySelector('.navlinks');
    if (!nav || nav.querySelector('.ptp-nav-tools')) return;
    const tools = document.createElement('span');
    tools.className = 'ptp-nav-tools';
    tools.innerHTML = `
      <span class="ptp-network" data-ptp-network data-state="${networkState}">${networkLabel()}</span>
      <button class="navlink ptp-tool-button" type="button" data-ptp-action="settings">Game Settings</button>`;
    nav.appendChild(tools);
    updateNetworkUi();
  }

  function ensureBattleTools() {
    const top = document.querySelector('.battle-top');
    if (top && !top.querySelector('[data-ptp-action="fullscreen"]')) {
      const full = document.createElement('button');
      full.type = 'button';
      full.className = 'btn ghost ptp-fullscreen';
      full.dataset.ptpAction = 'fullscreen';
      full.textContent = 'Full Screen';
      top.appendChild(full);
    }
    const roomActions = document.querySelector('.room-actions');
    if (roomActions && !roomActions.querySelector('[data-ptp-action="share"]')) {
      const share = document.createElement('button');
      share.type = 'button';
      share.className = 'btn ghost';
      share.dataset.ptpAction = 'share';
      share.textContent = 'Share Invite';
      roomActions.appendChild(share);
    }
  }

  function ensurePlacementTools() {
    const row = document.querySelector('.placement-panel .form-row');
    if (!row || row.querySelector('[data-ptp-action="undo"]')) return;
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'btn ghost';
    undo.dataset.ptpAction = 'undo';
    undo.textContent = 'Undo';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'btn ghost';
    clear.dataset.ptpAction = 'clear';
    clear.textContent = 'Clear';
    row.insertBefore(undo, row.firstChild);
    row.insertBefore(clear, undo.nextSibling);

    const help = document.createElement('div');
    help.className = 'ptp-placement-shortcuts muted';
    help.textContent = 'Preview before placing · R rotate · U undo · C clear';
    document.querySelector('.placement-panel')?.appendChild(help);
  }

  function ensureCoordinateReadouts() {
    document.querySelectorAll('.board-card').forEach(card => {
      const title = card.querySelector('.board-title');
      if (!title || title.querySelector('.ptp-coordinate-readout')) return;
      const readout = document.createElement('span');
      readout.className = 'ptp-coordinate-readout';
      readout.textContent = '—';
      title.appendChild(readout);
    });
  }

  function ensureRematch() {
    const banner = document.querySelector('.result-banner');
    if (!banner || banner.querySelector('[data-ptp-action="rematch"]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn primary';
    btn.dataset.ptpAction = 'rematch';
    const requested = Boolean(state?.rematch?.meRequested);
    const otherRequested = Boolean(state?.rematch?.opponentRequested);
    btn.textContent = requested ? 'Rematch Requested' : otherRequested ? 'Accept Rematch' : 'Rematch';
    btn.disabled = requested;
    banner.appendChild(btn);
    if (requested && !otherRequested) {
      const note = document.createElement('span');
      note.className = 'muted ptp-rematch-note';
      note.textContent = 'Waiting for the other grower…';
      banner.appendChild(note);
    }
  }

  function applyPersistedBattleLog() {
    if (!state?.events?.length) return;
    const list = document.querySelector('.battle-log .event-list');
    if (!list) return;
    const rows = state.events.slice(-12).reverse().map(ev => {
      const mine = ev.byPlayerId === state.me?.id;
      let label = 'UPDATE';
      let text = 'Battle state updated.';
      let cls = '';
      if (ev.type === 'scout') {
        label = ev.hit ? 'HIT' : 'MISS';
        text = `${mine ? 'You' : 'Opponent'} fired on ${coord(ev.row, ev.col)}: ${ev.hit ? 'HIT' : 'MISS'}.`;
        cls = ev.hit ? 'hit' : 'miss';
      } else if (ev.type === 'formation-lost') {
        const spec = FORMATIONS.find(f => f.id === ev.formationId);
        label = 'BUDS BURNED';
        text = `${mine ? 'You' : 'Opponent'} burned ${spec?.name || 'a full formation'}.`;
        cls = 'lost';
      } else if (ev.type === 'game-finished') {
        label = 'GAME OVER';
        text = ev.winnerId === state.me?.id ? 'You burned every opposing bud and won.' : 'Opponent burned every opposing bud.';
        cls = 'lost';
      } else if (ev.type === 'placement') {
        label = 'STASH READY';
        text = `${mine ? 'You' : 'Opponent'} locked a stash.`;
      } else if (ev.type === 'rematch-requested') {
        label = 'REMATCH';
        text = `${mine ? 'You' : 'Opponent'} requested another round.`;
      } else if (ev.type === 'rematch-started') {
        label = 'ROUND START';
        text = `Round ${ev.round || state.round || 2} is ready for new placements.`;
      }
      const at = ev.at ? new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="event ${cls}"><time>${at}</time><strong>${label}</strong><div>${esc(text)}</div></div>`;
    });
    list.innerHTML = rows.join('');
  }

  function enhanceCurrentView() {
    ensureDialog();
    ensureNavTools();
    ensureBattleTools();
    ensurePlacementTools();
    ensureCoordinateReadouts();
    ensureRematch();
    applyPersistedBattleLog();
    updateNetworkUi();
    if (typeof state !== 'undefined' && state) processState(state);
  }

  function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      enhanceCurrentView();
    });
  }

  function placementFootprint(row, col) {
    if (typeof state === 'undefined' || !state?.me || state.me.ready) return null;
    const spec = FORMATIONS.find(x => x.id === placement.selected);
    if (!spec) return null;
    const cells = Array.from({ length: spec.size }, (_, i) => ({
      row: row + (placement.horizontal ? 0 : i),
      col: col + (placement.horizontal ? i : 0)
    }));
    const occupied = new Set();
    for (const formation of placement.fleet) {
      if (formation.id === spec.id) continue;
      for (const cell of formation.cells) occupied.add(`${cell.row}:${cell.col}`);
    }
    const valid = cells.every(cell =>
      cell.row >= 0 && cell.col >= 0 && cell.row < GRID && cell.col < GRID && !occupied.has(`${cell.row}:${cell.col}`)
    );
    return { cells, valid };
  }

  function clearBoardHints(board) {
    if (!board) return;
    board.querySelectorAll('.ptp-preview-valid,.ptp-preview-invalid,.ptp-aimed').forEach(cell => {
      cell.classList.remove('ptp-preview-valid', 'ptp-preview-invalid', 'ptp-aimed');
    });
  }

  function previewPlacement(cell) {
    const board = cell?.closest('.board');
    if (!board) return;
    clearBoardHints(board);
    const raw = cell.dataset.place;
    if (!raw) return;
    const [row, col] = raw.split(',').map(Number);
    const footprint = placementFootprint(row, col);
    if (!footprint) return;
    for (const target of footprint.cells) {
      const targetCell = board.querySelector(`[data-place="${target.row},${target.col}"]`);
      if (targetCell) targetCell.classList.add(footprint.valid ? 'ptp-preview-valid' : 'ptp-preview-invalid');
    }
    cell.classList.add('ptp-aimed');
  }

  function updateReadout(cell) {
    const raw = cell?.dataset.place || cell?.dataset.fire;
    if (!raw) return;
    const [row, col] = raw.split(',').map(Number);
    const card = cell.closest('.board-card');
    const readout = card?.querySelector('.ptp-coordinate-readout');
    if (readout) readout.textContent = coord(row, col);
  }

  function undoPlacement() {
    if (!placement?.fleet?.length || state?.me?.ready) return toast('Nothing to undo.');
    const removed = placement.fleet.pop();
    if (removed?.id) placement.selected = removed.id;
    sfx('place');
    renderGame();
  }

  function clearPlacement() {
    if (state?.me?.ready) return;
    emptyPlacement();
    sfx('place');
    renderGame();
  }

  async function shareInvite() {
    if (!state?.code) return;
    const url = `${location.origin}${location.pathname}?room=${state.code}`;
    const text = `Join my Burn Buds game — room ${state.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Burn Buds', text, url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('Invite copied.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = `${text}\n${url}`;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Invite copied.');
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('Full screen is not available in this browser.');
    }
  }

  async function requestRematch() {
    if (!state || state.status !== 'finished') return;
    try {
      state = await api('rematch', { method: 'POST', body: {} });
      if (state.status === 'placement') {
        battleEvents = [];
        lastEventId = state.lastEvent?.id || '';
        emptyPlacement();
        toast(`Round ${state.round || 2} started.`);
      } else {
        toast('Rematch request sent.');
      }
      renderGame();
    } catch (err) {
      toast(err.message || 'Could not request a rematch.');
    }
  }

  const originalApi = api;
  api = async function enhancedApi(action, options = {}) {
    try {
      const result = await originalApi(action, options);
      markNetwork('online');
      if (result?.lastEvent) processEvent(result.lastEvent, result);
      if (result?.status) processState(result);
      if (action === 'place') sfx('lock');
      return result;
    } catch (err) {
      markNetwork(navigator.onLine ? 'error' : 'offline');
      throw err;
    }
  };

  const originalRenderGame = renderGame;
  renderGame = function enhancedRenderGame() {
    originalRenderGame();
    queueEnhance();
  };

  const originalRenderLobby = renderLobby;
  renderLobby = async function enhancedRenderLobby() {
    const result = await originalRenderLobby();
    queueEnhance();
    return result;
  };

  document.addEventListener('pointerdown', unlockAudio, { capture: true, once: true });
  document.addEventListener('keydown', unlockAudio, { capture: true, once: true });

  document.addEventListener('pointerover', event => {
    const cell = event.target.closest?.('.cell[data-place],.cell[data-fire]');
    if (!cell) return;
    updateReadout(cell);
    if (cell.dataset.place) previewPlacement(cell);
    if (cell.dataset.fire) cell.classList.add('ptp-aimed');
  });

  document.addEventListener('pointerout', event => {
    const cell = event.target.closest?.('.cell[data-place],.cell[data-fire]');
    if (!cell) return;
    const board = cell.closest('.board');
    if (!board?.contains(event.relatedTarget)) clearBoardHints(board);
  });

  document.addEventListener('focusin', event => {
    const cell = event.target.closest?.('.cell[data-place],.cell[data-fire]');
    if (!cell) return;
    updateReadout(cell);
    if (cell.dataset.place) previewPlacement(cell);
    if (cell.dataset.fire) cell.classList.add('ptp-aimed');
  });

  document.addEventListener('change', event => {
    const input = event.target.closest?.('[data-ptp-pref]');
    if (!input) return;
    prefs[input.dataset.ptpPref] = input.checked;
    savePrefs();
    if (input.dataset.ptpPref === 'sound' && input.checked) {
      unlockAudio();
      sfx('turn');
    }
  });

  document.addEventListener('click', event => {
    const actionButton = event.target.closest?.('[data-ptp-action]');
    if (actionButton) {
      const action = actionButton.dataset.ptpAction;
      if (action === 'settings') openDialog();
      if (action === 'undo') undoPlacement();
      if (action === 'clear') clearPlacement();
      if (action === 'share') shareInvite();
      if (action === 'fullscreen') toggleFullscreen();
      if (action === 'rematch') requestRematch();
      return;
    }

    const rotate = event.target.closest?.('[data-action="rotate"]');
    if (rotate) sfx('rotate');
    const random = event.target.closest?.('[data-action="random"]');
    if (random) sfx('place');
    const place = event.target.closest?.('[data-place]');
    if (place) {
      sfx('place');
      vibrate(18);
    }
  });

  document.addEventListener('click', event => {
    if (!prefs.confirmShots) return;
    const cell = event.target.closest?.('.cell[data-fire]');
    if (!cell || state?.status !== 'playing' || state?.turnPlayerId !== state?.me?.id) return;
    const key = cell.dataset.fire;
    const now = Date.now();
    if (armedShotKey === key && now <= armedShotUntil) {
      armedShotKey = '';
      armedShotUntil = 0;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelectorAll('.cell.ptp-shot-armed').forEach(el => el.classList.remove('ptp-shot-armed'));
    armedShotKey = key;
    armedShotUntil = now + 4000;
    cell.classList.add('ptp-shot-armed');
    const [row, col] = key.split(',').map(Number);
    toast(`Target ${coord(row, col)} armed — tap again to fire.`);
    vibrate(18);
  }, true);

  document.addEventListener('keydown', event => {
    const target = event.target;
    if (target?.matches?.('input,textarea,select') || target?.closest?.('dialog')) return;
    const key = event.key.toLowerCase();
    const placementActive = Boolean(state && ['waiting', 'placement'].includes(state.status) && !state.me?.ready);
    if (placementActive && key === 'r') {
      event.preventDefault();
      placement.horizontal = !placement.horizontal;
      sfx('rotate');
      renderGame();
      return;
    }
    if (placementActive && key === 'u') {
      event.preventDefault();
      undoPlacement();
      return;
    }
    if (placementActive && key === 'c') {
      event.preventDefault();
      clearPlacement();
      return;
    }

    const cell = target?.closest?.('.cell');
    if (!cell || !['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return;
    const board = cell.closest('.board');
    const cells = [...board.querySelectorAll('.cell')];
    const index = cells.indexOf(cell);
    if (index < 0) return;
    let next = index;
    if (key === 'arrowleft') next = Math.max(0, index - 1);
    if (key === 'arrowright') next = Math.min(cells.length - 1, index + 1);
    if (key === 'arrowup') next = Math.max(0, index - GRID);
    if (key === 'arrowdown') next = Math.min(cells.length - 1, index + GRID);
    if (next !== index) {
      event.preventDefault();
      cells[next].focus();
    }
  });

  window.addEventListener('online', () => markNetwork('online'));
  window.addEventListener('offline', () => markNetwork('offline'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof state !== 'undefined' && state) processState(state);
  });

  const observer = new MutationObserver(queueEnhance);
  observer.observe(app, { childList: true, subtree: true });
  queueEnhance();
})();