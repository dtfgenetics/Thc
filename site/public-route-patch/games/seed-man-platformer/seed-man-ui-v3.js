'use strict';

(function installSeedManUiV3() {
  const VERSION = 'seed-man-ui-v3';
  const VISUAL_VERSION = 'seed-man-visual-v4';
  const TOTAL_LEVELS = 15;
  const TOTAL_WORLDS = 5;
  const TOTAL_BOSSES = 6;
  const DISPLAY_WORLD_TITLES = Object.freeze({
    'Greenhouse District': 'Greenhouse Valley',
    Rootworks: 'Forest Ruins',
    'Resin Works': 'Desert Canyon',
    'Sky Garden': 'Frozen Peak',
    'Genetic Frontier': 'Eco City'
  });
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

  function displayWorldTitle(value) {
    return DISPLAY_WORLD_TITLES[value] || value || 'Seed Man Campaign';
  }

  function phaseFor(percent) {
    if (percent <= 32) return { key: 'opening', label: 'Opening Route' };
    if (percent <= 65) return { key: 'mid', label: 'Mid Route' };
    return { key: 'final', label: 'Final Run' };
  }

  function ensureCampaignIdentity() {
    const hero = document.querySelector('.hero');
    if (!hero) return null;

    document.title = 'Seed Man: Sprout Run | DTF Genetics';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Play Seed Man: Sprout Run, the DTF Genetics platform adventure spanning Greenhouse Valley, Forest Ruins, Desert Canyon, Frozen Peak and Eco City across 15 levels with six bosses and phenotype combat.';

    const eyebrow = hero.querySelector('.eyebrow');
    const title = hero.querySelector('h1');
    const lede = hero.querySelector('.lede');
    if (eyebrow) eyebrow.textContent = 'Sprout Run · Grow. Fight. Restore.';
    if (title) title.textContent = 'Seed Man';
    if (lede) lede.textContent = 'Run Seed Man from Greenhouse Valley through Forest Ruins, Desert Canyon and Frozen Peak to Eco City. Absorb temporary phenotype powers, master responsive platforming, defeat six bosses and restore each world.';

    let summary = hero.querySelector('.seed-campaign-summary');
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'seed-campaign-summary';
      summary.setAttribute('aria-label', 'Seed Man campaign overview');
      summary.innerHTML = [
        `<span><strong>${TOTAL_WORLDS}</strong> WORLDS</span>`,
        `<span><strong>${TOTAL_LEVELS}</strong> LEVELS</span>`,
        `<span><strong>${TOTAL_BOSSES}</strong> BOSSES</span>`,
        '<span><strong>10</strong> PHENOTYPES</span>'
      ].join('');
      const status = hero.querySelector('#load-status');
      hero.insertBefore(summary, status || null);
    }

    const marker = hero.querySelector('#seed-ui-release-marker');
    if (marker) marker.textContent = 'GROW · FIGHT · RESTORE · 15 LEVELS';
    hero.dataset.campaignIdentity = 'greenhouse-gauntlet';
    hero.dataset.gameIdentity = 'sprout-run';
    document.documentElement.dataset.seedManCampaignIdentity = 'sprout-run';
    return hero;
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
      .hero[data-campaign-identity="greenhouse-gauntlet"]{position:relative;overflow:hidden;padding-block:clamp(2rem,5vw,4.5rem)}
      .hero[data-campaign-identity="greenhouse-gauntlet"]::after{content:"";position:absolute;inset:auto -8% -42% 42%;height:72%;pointer-events:none;background:radial-gradient(circle at center,rgba(200,243,106,.16),transparent 68%);filter:blur(8px)}
      .hero[data-campaign-identity="greenhouse-gauntlet"] h1{max-width:11ch;font-size:clamp(3.1rem,8vw,7rem);line-height:.86;letter-spacing:-.055em;text-wrap:balance}
      .hero[data-campaign-identity="greenhouse-gauntlet"] .lede{max-width:760px;font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.65;color:#c8d6cc}
      .seed-campaign-summary{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:.65rem;margin:1.25rem 0 1rem}
      .seed-campaign-summary span{display:grid;gap:.08rem;min-width:7.1rem;padding:.72rem .88rem;border:1px solid rgba(200,243,106,.18);border-radius:.8rem;background:rgba(5,18,11,.62);font:800 .68rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;color:#91a99a}
      .seed-campaign-summary strong{font:900 1.2rem/1.05 system-ui,sans-serif;letter-spacing:-.03em;color:#f1f5ef}
      .game-shell[data-ui-v3="ready"]::before{display:none!important}
      .seed-run-context{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.65rem;align-items:center;margin:-.15rem 0 .7rem;padding:.45rem .58rem;border:1px solid rgba(200,243,106,.12);border-radius:.8rem;background:rgba(5,18,11,.72);font:850 .68rem/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.055em}
      .seed-run-context-world{color:var(--accent);text-transform:uppercase;letter-spacing:.11em}.seed-run-context-level{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eef5ef}.seed-run-context-order{color:#91a99a;white-space:nowrap}
      .game-shell[data-ui-v3="ready"] .course-kicker{color:var(--accent)}
      .game-shell[data-ui-v3="ready"] .course-status{grid-template-columns:minmax(220px,.48fr) minmax(0,1fr)}
      .game-shell[data-ui-v3="ready"] .course-status-copy strong{color:#f1f5ef}
      .game-shell[data-ui-v3="ready"][data-boss="active"] .course-status{border-color:rgba(243,200,103,.48);box-shadow:0 0 26px rgba(243,200,103,.09)}
      .game-shell[data-ui-v3="ready"][data-boss="active"] .course-kicker{color:var(--gold)}
      @media(max-width:680px){.hero[data-campaign-identity="greenhouse-gauntlet"]{padding-block:1.7rem 2.2rem}.hero[data-campaign-identity="greenhouse-gauntlet"] h1{font-size:clamp(2.7rem,15vw,4.35rem);max-width:9ch}.seed-campaign-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}.seed-campaign-summary span{min-width:0}.seed-run-context{grid-template-columns:1fr auto;gap:.25rem .55rem}.seed-run-context-level{grid-column:1/-1;grid-row:2}.seed-run-context-world{font-size:.62rem}.seed-run-context-order{font-size:.62rem}.game-shell[data-ui-v3="ready"] .course-status{grid-template-columns:1fr}.game-shell[data-ui-v3="ready"] .course-status-copy{grid-template-columns:1fr}.game-shell[data-ui-v3="ready"] .course-status-copy strong{white-space:normal}}
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

    ensureCampaignIdentity();
    const entry = activeEntry();
    if (!entry) return false;
    const world = activeWorld(entry);
    const canonicalWorldTitle = entry.worldTitle || world?.title || 'Seed Man Campaign';
    const worldTitle = displayWorldTitle(canonicalWorldTitle);
    const order = Number(entry.order) || window.__SPROUT_CAMPAIGN__.listLevels().findIndex((candidate) => candidate.id === entry.id) + 1;
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
    shell.dataset.canonicalWorldLabel = canonicalWorldTitle;
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
    ensureCampaignIdentity();
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
      window.__SPROUT_UI_V3__ = Object.freeze({ version: VERSION, visualVersion: VISUAL_VERSION, sync, phaseFor, displayWorldTitle, loadVisualV4, ensureCampaignIdentity });
      return;
    }
    attempts += 1;
    if (attempts <= 120) window.setTimeout(tryInstall, 25);
    else console.error('Seed Man UI v3 could not find campaign shell bindings.');
  }

  if (document.readyState === 'complete') tryInstall();
  else window.addEventListener('load', tryInstall, { once: true });
})();
