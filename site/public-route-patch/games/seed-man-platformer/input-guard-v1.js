'use strict';

(function installSproutRunInputGuard() {
  const interactiveSelector = 'a, button, input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="link"]';
  const SIGNATURES = Object.freeze({
    'nursery-night-shift': { name: 'Mist Pulse', detail: 'Propagation mist briefly lightens Seed Man in the air.', cycle: 5.2, active: 1.45 },
    'reservoir-run': { name: 'Current Reversal', detail: 'Reservoir flow reverses direction on a timed cycle.', cycle: 4.4, active: 2.2, boss: 'Pressure Wave' },
    'root-zone-rumble': { name: 'Root Snare', detail: 'Dense root pockets periodically tighten movement.', cycle: 5.6, active: 1.35 },
    'mycelium-mile': { name: 'Spore Bloom', detail: 'Spore blooms amplify lift through the fungal lanes.', cycle: 4.8, active: 1.15 },
    'trichome-transit': { name: 'Resin Combo', detail: 'Chain boost lanes to build a short resin-speed combo.', cycle: 6.0, active: 6.0, boss: 'Brood Rush' },
    'kief-cavern-climb': { name: 'Crystal Chain', detail: 'Consecutive cavern boosts recharge an air jump.', cycle: 6.0, active: 6.0 },
    'rosin-refinery-rush': { name: 'Press Cycle', detail: 'Refinery heat vents alternate between warmup and pressure phases.', cycle: 5.0, active: 1.5 },
    'terpene-tunnel': { name: 'Polarity Shift', detail: 'Terpene gust polarity flips across the tunnel.', cycle: 4.2, active: 2.1, boss: 'Phase Drift' },
    'frostline-canopy': { name: 'Frost Momentum', detail: 'Clean landings preserve extra speed across frozen lanes.', cycle: 6.0, active: 6.0 },
    'cloud-nine-citadel': { name: 'Sky Wind Cycle', detail: 'Citadel crosswinds rotate direction during the final climb.', cycle: 4.0, active: 2.0, boss: 'Pollen Gust' }
  });

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest(interactiveSelector));
  }

  function protectNativeKeyboardBehavior(event) {
    if (!isInteractiveTarget(event.target)) return;
    event.stopImmediatePropagation();
  }

  function normalizeGeneratedTerminalLanding(selectedLevelId) {
    try {
      if (typeof level === 'undefined' || !level || level.id !== selectedLevelId || Number(level.schemaVersion) < 3) return;
      const worldWidth = Number(level.worldWidth);
      if (!Number.isFinite(worldWidth) || worldWidth <= 0 || !Array.isArray(level.platforms) || !Array.isArray(level.hazards)) return;

      const terminalHazards = level.hazards.filter((hazard) =>
        Number(hazard?.y) === 500 &&
        Number(hazard?.height) === 40 &&
        Number.isFinite(Number(hazard?.x)) &&
        Number.isFinite(Number(hazard?.width)) &&
        Number(hazard.x) + Number(hazard.width) > worldWidth
      );

      for (const hazard of terminalHazards) {
        const hazardX = Number(hazard.x);
        const precedingGround = level.platforms
          .filter((platform) => Number(platform?.y) === 480 && Number(platform?.height) === 60)
          .find((platform) => Math.abs((Number(platform.x) + Number(platform.width)) - hazardX) <= 1);
        if (precedingGround) precedingGround.width = Math.max(Number(precedingGround.width), worldWidth - Number(precedingGround.x));
      }

      if (terminalHazards.length) {
        const removed = new Set(terminalHazards);
        level.hazards = level.hazards.filter((hazard) => !removed.has(hazard));
      }

      for (const platform of level.platforms) {
        const right = Number(platform.x) + Number(platform.width);
        if (right > worldWidth) platform.width = Math.max(1, worldWidth - Number(platform.x));
      }
      for (const hazard of level.hazards) {
        const right = Number(hazard.x) + Number(hazard.width);
        if (right > worldWidth) hazard.width = Math.max(1, worldWidth - Number(hazard.x));
      }

      const boss = level.boss;
      if (boss && Array.isArray(level.pickups)) {
        const arenaStart = Number(boss.arenaStartX) - 32;
        const arenaEnd = Number(boss.arenaEndX) + 32;
        const overhead = level.platforms.filter((platform) =>
          Number(platform?.y) < Number(boss.y) &&
          Number(platform?.x) < arenaEnd &&
          Number(platform?.x) + Number(platform?.width) > arenaStart
        );

        if (overhead.length) {
          const removed = new Set(overhead);
          const affectedPickups = level.pickups.filter((pickup) => overhead.some((platform) =>
            Number(pickup?.x) < Number(platform.x) + Number(platform.width) &&
            Number(pickup?.x) + Number(pickup?.width) > Number(platform.x) &&
            Number(pickup?.y) + Number(pickup?.height) <= Number(platform.y) + 8
          ));
          level.platforms = level.platforms.filter((platform) => !removed.has(platform));

          const approachGround = level.platforms
            .filter((platform) => Number(platform?.y) === 480 && Number(platform?.height) === 60 && Number(platform?.x) < arenaStart)
            .sort((a, b) => (Number(b.x) + Number(b.width)) - (Number(a.x) + Number(a.width)))[0];

          if (approachGround) {
            affectedPickups.forEach((pickup, index) => {
              const minX = Number(approachGround.x) + 36;
              const maxX = Number(approachGround.x) + Number(approachGround.width) - Number(pickup.width) - 36;
              pickup.x = Math.max(minX, Math.min(maxX, arenaStart - 72 - index * 34));
              pickup.y = 425;
            });
          }
        }
      }
    } catch (error) {
      console.error('Seed Man generated-level safety normalization failed.', error);
    }
  }

  function syncSignatureSelection(levelId) {
    const hud = document.querySelector('#seed-signature-hud');
    if (!hud) return;
    const signature = SIGNATURES[levelId] || null;
    const name = document.querySelector('#seed-signature-name');
    const state = document.querySelector('#seed-signature-state');
    const detail = document.querySelector('#seed-signature-detail');
    if (signature) {
      if (name) name.textContent = signature.name;
      if (state) state.textContent = `${signature.name} · cycling`;
      if (detail) detail.textContent = signature.detail;
    } else {
      if (name) name.textContent = 'Stage Feature';
      if (state) state.textContent = 'Greenhouse fundamentals';
      if (detail) detail.textContent = 'Moving tables, pests, bounce pads and power-ups establish the core run.';
    }
    hud.dataset.active = 'false';
  }

  function installSignatureRuntime() {
    try {
      if (typeof stepPlayer !== 'function') return;
      let signatureClock = 0;
      let lastLevelId = '';
      let resinCombo = 0;
      let crystalChain = 0;
      let lastZoneId = '';
      let uiTick = 0;

      const overlaps = (a, b) => a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      const activeZones = (next, levelData) => (levelData.mechanicZones || []).filter((zone) => overlaps(next, zone));
      const phaseFor = (signature) => signatureClock % signature.cycle;
      const isPulseActive = (signature) => phaseFor(signature) < signature.active;
      const phaseDirection = (signature) => phaseFor(signature) < signature.cycle / 2 ? 1 : -1;

      function ensureSignatureUi() {
        if (document.querySelector('#seed-signature-hud')) return;
        const shell = document.querySelector('.game-shell');
        if (!shell) return;
        const hud = document.createElement('div');
        hud.id = 'seed-signature-hud';
        hud.setAttribute('role', 'status');
        hud.setAttribute('aria-live', 'polite');
        hud.innerHTML = '<span id="seed-signature-name">Stage Feature</span><strong id="seed-signature-state">Greenhouse fundamentals</strong><small id="seed-signature-detail">Level-specific mechanics appear from Level 2 onward.</small>';
        shell.prepend(hud);
        const style = document.createElement('style');
        style.textContent = `
          #seed-signature-hud{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:8px 12px;align-items:center;margin:0 0 10px;padding:9px 12px;border:1px solid rgba(200,243,106,.22);border-radius:12px;background:rgba(7,22,15,.88);font:700 11px system-ui;color:#eef5e9}
          #seed-signature-name{font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#c8f36a}#seed-signature-state{color:#f3c867}#seed-signature-detail{color:#b7c5b3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          #seed-signature-hud[data-active="true"]{border-color:rgba(243,200,103,.58);box-shadow:0 0 22px rgba(243,200,103,.1)}
          @media(max-width:680px){#seed-signature-hud{grid-template-columns:1fr 1fr}#seed-signature-detail{grid-column:1/-1;white-space:normal;line-height:1.35}}
          @media(prefers-reduced-motion:reduce){#seed-signature-hud{transition:none!important}}
        `;
        document.head.append(style);
      }

      function signatureLabel(levelData, signature, active) {
        if (!signature) return { state: 'Greenhouse fundamentals', detail: 'Moving tables, pests, bounce pads and power-ups establish the core run.' };
        const bossSnapshot = window.__SPROUT_CAMPAIGN_EXPERIENCE__?.snapshot?.()?.boss;
        if (bossSnapshot && !bossSnapshot.defeated && signature.boss && player.x >= (levelData.boss?.arenaStartX || Infinity)) {
          return { state: `${signature.boss}${active ? ' · ACTIVE' : ' · charging'}`, detail: `${bossSnapshot.name}: ${bossSnapshot.hits}/${bossSnapshot.requiredHits} weak-point stomps.` };
        }
        if (levelData.id === 'trichome-transit') return { state: `${signature.name} · x${1 + resinCombo}`, detail: signature.detail };
        if (levelData.id === 'kief-cavern-climb') return { state: `${signature.name} · ${crystalChain}/2`, detail: signature.detail };
        return { state: `${signature.name}${active ? ' · ACTIVE' : ' · cycling'}`, detail: signature.detail };
      }

      function syncSignatureUi(levelData, signature, active) {
        uiTick += 1;
        if (uiTick % 8 !== 0) return;
        ensureSignatureUi();
        const hud = document.querySelector('#seed-signature-hud');
        if (!hud) return;
        const label = signatureLabel(levelData, signature, active);
        const name = document.querySelector('#seed-signature-name');
        const state = document.querySelector('#seed-signature-state');
        const detail = document.querySelector('#seed-signature-detail');
        if (name) name.textContent = signature?.name || 'Stage Feature';
        if (state) state.textContent = label.state;
        if (detail) detail.textContent = label.detail;
        hud.dataset.active = String(Boolean(active));
      }

      const baseStep = stepPlayer;
      stepPlayer = function seedManSignatureStep(inputPlayer, inputState, levelData, dt, config) {
        if (levelData.id !== lastLevelId) {
          signatureClock = 0;
          resinCombo = 0;
          crystalChain = 0;
          lastZoneId = '';
          lastLevelId = levelData.id;
        }
        signatureClock += Math.max(0, Math.min(Number(dt) || 0, 0.05));
        const previous = inputPlayer;
        const next = baseStep(inputPlayer, inputState, levelData, dt, config);
        const signature = SIGNATURES[levelData.id] || null;
        if (!signature || next.finished || next.deaths > previous.deaths) {
          if (next.deaths > previous.deaths) {
            resinCombo = 0;
            crystalChain = 0;
            lastZoneId = '';
          }
          syncSignatureUi(levelData, signature, false);
          return next;
        }

        const pulse = isPulseActive(signature);
        const direction = phaseDirection(signature);
        const zones = activeZones(next, levelData);
        const zone = zones[0] || null;

        if (levelData.id === 'nursery-night-shift' && pulse && !next.grounded) {
          next.vy = Math.max(-900, next.vy - 92 * dt);
        } else if (levelData.id === 'reservoir-run' && zone?.type === 'flow-zones') {
          next.vx = Math.max(-440, Math.min(440, next.vx + direction * 175 * dt));
        } else if (levelData.id === 'root-zone-rumble' && pulse && zone?.type === 'drag-zones') {
          next.vx *= Math.pow(0.76, dt * 8);
        } else if (levelData.id === 'mycelium-mile' && pulse && zone?.type === 'updraft-zones') {
          next.vy = Math.max(-900, next.vy - 150 * dt);
        } else if (levelData.id === 'trichome-transit' && zone?.type === 'boost-zones') {
          if (zone.id !== lastZoneId) resinCombo = Math.min(3, resinCombo + 1);
          lastZoneId = zone.id;
          next.vx = Math.max(-470, Math.min(470, next.vx * (1 + resinCombo * 0.012)));
        } else if (levelData.id === 'kief-cavern-climb' && zone?.type === 'bounce-pads' && next.state === 'boost-bounce') {
          if (zone.id !== lastZoneId) crystalChain += 1;
          lastZoneId = zone.id;
          if (crystalChain >= 2) {
            next.airJumpsRemaining = Math.max(1, next.airJumpsRemaining);
            crystalChain = 0;
          }
        } else if (levelData.id === 'rosin-refinery-rush' && pulse && zone?.type === 'heat-vents') {
          next.vy = Math.max(-900, next.vy - 190 * dt);
        } else if (levelData.id === 'terpene-tunnel' && zone?.type === 'gust-zones') {
          next.vx = Math.max(-460, Math.min(460, next.vx + direction * 210 * dt));
        } else if (levelData.id === 'frostline-canopy' && next.grounded && Math.abs(next.vx) > 180) {
          next.vx = Math.max(-410, Math.min(410, next.vx * Math.pow(1.006, dt * 60)));
        } else if (levelData.id === 'cloud-nine-citadel') {
          next.vx = Math.max(-470, Math.min(470, next.vx + direction * (pulse ? 150 : 70) * dt));
        }

        const boss = levelData.boss;
        const inArena = boss && next.x + next.width >= boss.arenaStartX && next.x <= boss.arenaEndX;
        if (inArena && !window.__SPROUT_CAMPAIGN_EXPERIENCE__?.snapshot?.()?.boss?.defeated) {
          if (levelData.id === 'reservoir-run' && pulse) {
            next.vx = Math.max(-480, Math.min(480, next.vx + direction * 260 * dt));
          } else if (levelData.id === 'trichome-transit' && pulse && next.grounded) {
            next.vx = Math.max(-480, Math.min(480, next.vx + (next.x < boss.x ? -220 : 220) * dt));
          } else if (levelData.id === 'terpene-tunnel' && pulse) {
            next.vy = Math.max(-900, Math.min(900, next.vy - 120 * dt));
            next.vx = Math.max(-480, Math.min(480, next.vx + direction * 190 * dt));
          } else if (levelData.id === 'cloud-nine-citadel' && pulse) {
            next.vx = Math.max(-500, Math.min(500, next.vx + direction * 320 * dt));
          }
        }

        syncSignatureUi(levelData, signature, pulse);
        return next;
      };

      ensureSignatureUi();
      syncSignatureSelection(typeof level !== 'undefined' ? level.id : 'sprout-run');
      window.__SPROUT_SIGNATURE_FEATURES__ = Object.freeze({
        version: 'seed-man-signature-features-v1',
        levels: Object.freeze(Object.keys(SIGNATURES)),
        features: Object.freeze(Object.fromEntries(Object.entries(SIGNATURES).map(([id, feature]) => [id, feature.name]))),
        bossAbilities: Object.freeze({
          'reservoir-run': 'Pressure Wave',
          'trichome-transit': 'Brood Rush',
          'terpene-tunnel': 'Phase Drift',
          'cloud-nine-citadel': 'Pollen Gust'
        })
      });
    } catch (error) {
      console.error('Seed Man signature mechanics failed to initialize.', error);
    }
  }

  window.addEventListener('keydown', protectNativeKeyboardBehavior, { capture: true });
  window.addEventListener('keyup', protectNativeKeyboardBehavior, { capture: true });
  window.addEventListener('sprout:level-selected', (event) => {
    const levelId = event?.detail?.levelId;
    if (!levelId) return;
    queueMicrotask(() => {
      normalizeGeneratedTerminalLanding(levelId);
      syncSignatureSelection(levelId);
    });
  });
  window.addEventListener('load', installSignatureRuntime, { once: true });

  window.__SPROUT_GENERATED_LEVEL_GUARD__ = Object.freeze({
    version: 'seed-man-generated-level-guard-v1',
    normalize: normalizeGeneratedTerminalLanding
  });
})();

(async function installSproutRunSharedPlatform() {
  try {
    const { createGameAudioManager, createGameSettingsStore } = await import('/games/shared-platform/index.mjs');
    const settingsStore = createGameSettingsStore({ gameId: 'seed-man-platformer' });
    const audio = createGameAudioManager({ settingsStore });
    const shell = document.querySelector('.game-shell');
    if (!shell) return;

    let audioStatus = 'locked';
    let toneEvents = 0;
    const observers = [];
    const style = document.createElement('style');
    style.id = 'seed-shared-platform-styles';
    style.textContent = `
      .seed-game-settings{margin:0 0 10px;border:1px solid rgba(200,243,106,.22);border-radius:12px;background:rgba(7,22,15,.88);color:#eef5e9;font:700 calc(12px * var(--dtf-ui-scale,1)) system-ui;overflow:hidden}
      .seed-game-settings summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;cursor:pointer;color:#c8f36a;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.seed-game-settings summary::after{content:'Preferences + sound';color:#a9b8a7;font-size:.9em;font-weight:700;letter-spacing:0;text-transform:none}
      .seed-game-settings[open] summary{border-bottom:1px solid rgba(200,243,106,.16)}.seed-game-settings-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:12px}.seed-game-settings label{display:grid;gap:5px;color:#c7d4c4;font-size:.92em}
      .seed-game-settings select,.seed-game-settings input,.seed-game-settings button{min-height:44px;border:1px solid rgba(200,243,106,.3);border-radius:10px;background:#10291d;color:#f5f8f2;font:inherit;padding:7px 9px}.seed-game-settings button{cursor:pointer;font-weight:900}.seed-game-settings button:hover,.seed-game-settings button:focus-visible{border-color:#c8f36a;outline:2px solid transparent}
      .seed-game-audio-state{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#a9b8a7;min-height:24px}html[data-dtf-high-contrast="true"] .seed-game-settings{background:#000;border-color:CanvasText;color:CanvasText}html[data-dtf-high-contrast="true"] .game-shell{outline:3px solid CanvasText;outline-offset:3px}
      html[data-dtf-reduced-motion="true"] .game-shell *,html[data-dtf-reduced-motion="true"] .seed-game-settings *{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}@media(max-width:760px){.seed-game-settings-grid{grid-template-columns:1fr 1fr}}@media(max-width:480px){.seed-game-settings-grid{grid-template-columns:1fr}}
    `;
    document.head.append(style);

    const panel = document.createElement('details');
    panel.id = 'seed-game-settings';
    panel.className = 'seed-game-settings';
    panel.innerHTML = `
      <summary>Game settings</summary>
      <div class="seed-game-settings-grid">
        <label>Reduced motion<select id="seed-motion-setting"><option value="system">Use device setting</option><option value="on">On</option><option value="off">Off</option></select></label>
        <label>High contrast<select id="seed-contrast-setting"><option value="system">Use device setting</option><option value="on">On</option><option value="off">Off</option></select></label>
        <label>UI size<input id="seed-ui-scale" type="range" min="0.9" max="1.35" step="0.05"></label>
        <label>Sound<button id="seed-sound-toggle" type="button" aria-pressed="false">Sound on</button></label>
        <div class="seed-game-audio-state"><span id="seed-audio-status" role="status" aria-live="polite"></span><button id="seed-test-sound" type="button">Test sound</button></div>
      </div>`;
    shell.prepend(panel);

    const $ = (selector) => document.querySelector(selector);
    const syncUi = () => {
      const settings = settingsStore.get();
      settingsStore.applyAccessibility(document.documentElement);
      document.documentElement.dataset.dtfMuted = settings.muted ? 'true' : 'false';
      $('#seed-motion-setting').value = settings.reducedMotion;
      $('#seed-contrast-setting').value = settings.highContrast;
      $('#seed-ui-scale').value = String(settings.uiScale);
      $('#seed-sound-toggle').textContent = settings.muted ? 'Sound off' : 'Sound on';
      $('#seed-sound-toggle').setAttribute('aria-pressed', settings.muted ? 'true' : 'false');
      $('#seed-audio-status').textContent = `${settings.muted ? 'Muted' : audioStatus === 'ready' ? 'Sound ready' : 'Sound unlocks on first input'} · settings saved on this device`;
    };

    const unlockAudio = async () => {
      const ready = audio.isUnlocked() || await audio.unlock();
      audioStatus = ready ? 'ready' : 'unavailable';
      syncUi();
      return ready;
    };

    const playCue = (kind) => {
      if (settingsStore.get().muted || !audio.isUnlocked()) return false;
      const cue = {
        sprout: [760, 70, 0.028, 'sine'], power: [520, 110, 0.032, 'triangle'], hurt: [145, 150, 0.026, 'sawtooth'],
        pause: [280, 80, 0.022, 'triangle'], resume: [390, 80, 0.022, 'triangle'], ready: [620, 80, 0.025, 'sine'], finish: [880, 170, 0.032, 'triangle']
      }[kind] || [620, 80, 0.025, 'sine'];
      const played = audio.playTone({ frequency: cue[0], durationMs: cue[1], gain: cue[2], type: cue[3], category: 'sfx' });
      if (played) toneEvents += 1;
      return played;
    };

    const observeText = (selector, callback) => {
      const target = $(selector);
      if (!target) return;
      let previous = target.textContent || '';
      const observer = new MutationObserver(() => {
        const next = target.textContent || '';
        if (next === previous) return;
        const before = previous;
        previous = next;
        callback(next, before);
      });
      observer.observe(target, { childList: true, characterData: true, subtree: true });
      observers.push(observer);
    };

    $('#seed-motion-setting').addEventListener('change', (event) => settingsStore.update({ reducedMotion: event.target.value }));
    $('#seed-contrast-setting').addEventListener('change', (event) => settingsStore.update({ highContrast: event.target.value }));
    $('#seed-ui-scale').addEventListener('input', (event) => settingsStore.update({ uiScale: Number(event.target.value) }));
    $('#seed-sound-toggle').addEventListener('click', async () => {
      const muted = !settingsStore.get().muted;
      settingsStore.update({ muted });
      if (!muted && await unlockAudio()) playCue('ready');
    });
    $('#seed-test-sound').addEventListener('click', async () => { if (await unlockAudio()) playCue('ready'); });

    observeText('#sprout-count', (next, previous) => {
      if (Number.parseInt(next, 10) > Number.parseInt(previous, 10)) playCue('sprout');
    });
    observeText('#power-count', (next, previous) => { if (next.trim() !== 'None' && next !== previous) playCue('power'); });
    observeText('#death-count', (next, previous) => {
      if (Number.parseInt(next, 10) > Number.parseInt(previous, 10)) playCue('hurt');
    });

    $('#pause')?.addEventListener('click', () => queueMicrotask(() => playCue($('#pause').getAttribute('aria-pressed') === 'true' ? 'pause' : 'resume')));
    const finishPanel = $('#finish-panel');
    if (finishPanel) {
      const observer = new MutationObserver(() => { if (!finishPanel.hidden) { playCue('finish'); setTimeout(() => playCue('ready'), 110); } });
      observer.observe(finishPanel, { attributes: true, attributeFilter: ['hidden'] });
      observers.push(observer);
    }

    const unlockOnInput = async (event) => {
      if (event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(event.key)) return;
      if (!await unlockAudio()) return;
      window.removeEventListener('pointerdown', unlockOnInput, true);
      window.removeEventListener('keydown', unlockOnInput, true);
    };
    window.addEventListener('pointerdown', unlockOnInput, true);
    window.addEventListener('keydown', unlockOnInput, true);

    syncUi();
    const unsubscribe = settingsStore.subscribe(syncUi);
    window.addEventListener('pagehide', () => {
      unsubscribe();
      observers.forEach((observer) => observer.disconnect());
      audio.close();
    }, { once: true });

    window.__SPROUT_SHARED_PLATFORM__ = Object.freeze({
      version: 'seed-man-shared-platform-v1',
      settingsStore,
      audio,
      updateSettings: (patch) => settingsStore.update(patch),
      playCue,
      snapshot: () => ({
        version: 'seed-man-shared-platform-v1',
        settings: { ...settingsStore.get() },
        accessibility: settingsStore.resolveAccessibility(),
        audioStatus,
        audioUnlocked: audio.isUnlocked(),
        audioContextState: audio.contextState(),
        toneEvents
      })
    });
  } catch (error) {
    console.warn('Seed Man shared platform adapter could not initialize.', error);
  }
})();
