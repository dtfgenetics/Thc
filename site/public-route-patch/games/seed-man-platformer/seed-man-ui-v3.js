'use strict';

(function installSeedManUiV3() {
  const VERSION = 'seed-man-ui-v3';
  const VISUAL_VERSION = 'seed-man-visual-v4';
  const TOTAL_LEVELS = 15;
  let attempts = 0;

  function activeEntry() {
    const campaign = window.__SPROUT_CAMPAIGN__;
    if (!campaign?.listLevels) return null;
    const id = (() => {
      try { return level?.id || campaign.activeLevelId; } catch { return campaign.activeLevelId; }
    })();
    return campaign.listLevels().find((entry) => entry.id === id) || campaign.getLevel?.(id) || null;
  }

  function activeWorld(entry) {
    if (!entry) return null;
    const worlds = window.__SPROUT_CAMPAIGN__?.worlds || [];
    return worlds.find((world) => world.id === entry.worldId || world.levels?.some((candidate) => candidate.id === entry.id)) || null;
  }

  function phaseFor(percent) {
    if (percent <= 32) return { key: 'opening', label: 'Opening Route' };
    if (percent <= 65) return { key: 'mid', label: 'Mid Route' };
    return { key: 'final', label: 'Final Run' };
  }

  function ensureContextBar(shell) {
    let bar = shell.querySelector('.seed-run-context');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'seed-run-context';
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<span class="seed-run-context-world"></span><strong class="seed-run-context-level"></strong><span class="seed-run-context-order"></span>';
    shell.prepend(bar);
    return bar;
  }

  function installStyles() {
    if (document.querySelector('style[data-seed-ui-v3]')) return;
    const style = document.createElement('style');
    style.dataset.seedUiV3 = VERSION;
    style.textContent = `
      .game-shell[data-ui-v3="ready"]::before{display:none!important}
      .seed-run-context{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.65rem;align-items:center;margin:-.15rem 0 .7rem;padding:.45rem .58rem;border:1px solid rgba(200,243,106,.12);border-radius:.8rem;background:rgba(5,18,11,.72);font:850 .68rem/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.055em}
      .seed-run-context-world{color:var(--accent);text-transform:uppercase;letter-spacing:.11em}.seed-run-context-level{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eef5ef}.seed-run-context-order{color:#91a99a;white-space:nowrap}
      .game-shell[data-ui-v3="ready"] .course-kicker{color:var(--accent)}
      .game-shell[data-ui-v3="ready"] .course-status{grid-template-columns:minmax(220px,.48fr) minmax(0,1fr)}
      .game-shell[data-ui-v3="ready"] .course-status-copy strong{color:#f1f5ef}
      .game-shell[data-ui-v3="ready"][data-boss="active"] .course-status{border-color:rgba(243,200,103,.48);box-shadow:0 0 26px rgba(243,200,103,.09)}
      .game-shell[data-ui-v3="ready"][data-boss="active"] .course-kicker{color:var(--gold)}
      @media(max-width:680px){.seed-run-context{grid-template-columns:1fr auto;gap:.25rem .55rem}.seed-run-context-level{grid-column:1/-1;grid-row:2}.seed-run-context-world{font-size:.62rem}.seed-run-context-order{font-size:.62rem}.game-shell[data-ui-v3="ready"] .course-status{grid-template-columns:1fr}.game-shell[data-ui-v3="ready"] .course-status-copy{grid-template-columns:1fr}.game-shell[data-ui-v3="ready"] .course-status-copy strong{white-space:normal}}
    `;
    document.head.append(style);
  }

  function loadVisualV4() {
    if (window.__SPROUT_VISUAL_V4__?.version === VISUAL_VERSION || document.querySelector('script[data-seed-visual-v4]')) return;
    const release = document.querySelector('meta[name="dtf-sprout-release"]')?.content || '20260907-r9';
    const script = document.createElement('script');
    script.src = `./seed-man-visual-v4.js?v=${release}`;
    script.async = false;
    script.dataset.seedVisualV4 = 'v4';
    script.addEventListener('error', () => console.error('Seed Man visual v4 failed to load.'), { once: true });
    document.body.append(script);
  }

  function sync() {
    const shell = document.querySelector('.game-shell');
    const progressNode = document.querySelector('#progress-count');
    const stageNode = document.querySelector('#course-stage');
    const kicker = document.querySelector('.course-kicker');
    if (!shell || !stageNode || !kicker || !window.__SPROUT_CAMPAIGN__?.listLevels) return false;

    const entry = activeEntry();
    if (!entry) return false;
    const world = activeWorld(entry);
    const order = Number(entry.order) || window.__SPROUT_CAMPAIGN__.listLevels().findIndex((candidate) => candidate.id === entry.id) + 1;
    const worldTitle = entry.worldTitle || world?.title || 'Seed Man Campaign';
    const levelTitle = entry.title || String(entry.id || 'Current Level');
    const percent = Math.min(100, Math.max(0, Number.parseInt(progressNode?.textContent || '0', 10) || 0));
    const phase = phaseFor(percent);
    const boss = (() => {
      try { return window.__SPROUT_CAMPAIGN_EXPERIENCE__?.snapshot?.()?.boss || null; } catch { return null; }
    })();

    const bar = ensureContextBar(shell);
    bar.querySelector('.seed-run-context-world').textContent = worldTitle;
    bar.querySelector('.seed-run-context-level').textContent = levelTitle;
    bar.querySelector('.seed-run-context-order').textContent = `LEVEL ${order} / ${TOTAL_LEVELS}`;

    kicker.textContent = boss && !boss.defeated ? `BOSS · ${boss.name}` : `${worldTitle} · LEVEL ${order}`;
    stageNode.textContent = `${phase.label} · ${levelTitle}`;
    const course = shell.querySelector('.course-status');
    if (course) course.setAttribute('aria-label', `${levelTitle} route progress`);

    shell.dataset.uiV3 = 'ready';
    shell.dataset.world = entry.worldId || world?.id || '';
    shell.dataset.worldLabel = worldTitle;
    shell.dataset.levelId = entry.id;
    shell.dataset.levelLabel = levelTitle;
    shell.dataset.levelOrder = String(order);
    shell.dataset.routePhase = phase.key;
    shell.dataset.boss = boss && !boss.defeated ? 'active' : 'none';
    document.documentElement.dataset.seedManUi = VERSION;
    window.__SPROUT_VISUAL_V4__?.sync?.();
    return true;
  }

  function tryInstall() {
    if (sync()) {
      installStyles();
      sync();
      loadVisualV4();
      const progress = document.querySelector('#progress-count');
      const finish = document.querySelector('#finish-panel');
      if (typeof MutationObserver === 'function') {
        const observer = new MutationObserver(() => sync());
        for (const node of [progress, finish, document.querySelector('#seed-campaign-title')].filter(Boolean)) {
          observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true });
        }
      }
      window.addEventListener('sprout:level-selected', () => requestAnimationFrame(sync));
      const select = document.querySelector('#seed-man-level-select');
      if (select) select.addEventListener('change', () => requestAnimationFrame(sync));
      window.__SPROUT_UI_V3__ = Object.freeze({ version: VERSION, visualVersion: VISUAL_VERSION, sync, phaseFor, loadVisualV4 });
      return;
    }
    attempts += 1;
    if (attempts <= 120) window.setTimeout(tryInstall, 25);
    else console.error('Seed Man UI v3 could not find campaign shell bindings.');
  }

  if (document.readyState === 'complete') tryInstall();
  else window.addEventListener('load', tryInstall, { once: true });
})();
