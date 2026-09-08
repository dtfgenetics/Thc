'use strict';

(function installSeedManUiV3() {
  const VERSION = 'seed-man-ui-v3';
  const VISUAL_VERSION = 'seed-man-visual-v4';
  const GAME_TITLE = 'Seed Man: Greenhouse Gauntlet';
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
  const PHENOTYPE_LABELS = Object.freeze({
    'static-haze': 'Static Haze',
    'frost-resin': 'Frost Resin',
    'solar-flare': 'Solar Flare',
    'hydro-surge': 'Hydro Surge',
    'terpene-tempest': 'Terpene Tempest',
    'vine-lash': 'Vine Lash',
    'mycelium-mind': 'Mycelium Mind',
    rootbreaker: 'Rootbreaker',
    'trichome-crystal': 'Trichome Crystal',
    'gravity-haze': 'Gravity Haze'
  });
  const WORLD_SEQUENCE = Object.freeze([
    { id: 'world-01', number: '01', title: 'Greenhouse Valley', levelId: 'sprout-run' },
    { id: 'world-02', number: '02', title: 'Forest Ruins', levelId: 'root-zone-rumble' },
    { id: 'world-03', number: '03', title: 'Desert Canyon', levelId: 'kief-cavern-climb' },
    { id: 'world-04', number: '04', title: 'Frozen Peak', levelId: 'frostline-canopy' },
    { id: 'world-05', number: '05', title: 'Eco City', levelId: 'chromosome-crossing' }
  ]);
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

  function combatSnapshot() {
    try { return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null; } catch { return null; }
  }

  function displayWorldTitle(value) {
    return DISPLAY_WORLD_TITLES[value] || value || 'Seed Man Campaign';
  }

  function phaseFor(percent) {
    if (percent <= 32) return { key: 'opening', label: 'Opening Route' };
    if (percent <= 65) return { key: 'mid', label: 'Mid Route' };
    return { key: 'final', label: 'Final Run' };
  }

  function ensureWorldRail(hero) {
    let rail = hero.querySelector('.seed-world-rail');
    if (rail) return rail;
    rail = document.createElement('nav');
    rail.className = 'seed-world-rail';
    rail.setAttribute('aria-label', 'Seed Man campaign worlds');
    rail.innerHTML = WORLD_SEQUENCE.map((world) => `
      <button type="button" class="seed-world-card" data-world-id="${world.id}" data-level-id="${world.levelId}">
        <span>${world.number}</span><strong>${world.title}</strong>
      </button>`).join('');
    rail.addEventListener('click', (event) => {
      const button = event.target.closest('.seed-world-card');
      if (!button) return;
      const id = button.dataset.levelId;
      if (!id) return;
      try {
        window.__SPROUT_CAMPAIGN_EXPERIENCE__?.selectLevel?.(id);
        document.querySelector('#game')?.focus?.({ preventScroll: true });
      } catch (error) {
        console.error('Seed Man world selection failed.', error);
      }
    });
    const summary = hero.querySelector('.seed-campaign-summary');
    (summary || hero.querySelector('.lede'))?.insertAdjacentElement('afterend', rail);
    return rail;
  }

  function syncWorldRail(entry) {
    const rail = document.querySelector('.seed-world-rail');
    if (!rail || !entry) return;
    for (const button of rail.querySelectorAll('.seed-world-card')) {
      const active = button.dataset.worldId === entry.worldId;
      button.dataset.active = active ? 'true' : 'false';
      if (active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
  }

  function ensureCampaignIdentity() {
    const hero = document.querySelector('.hero');
    if (!hero) return null;
    document.title = `${GAME_TITLE} | DTF Genetics`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Play Seed Man: Greenhouse Gauntlet, the DTF Genetics platform adventure spanning five worlds and 15 levels with six bosses, phenotype combat, authored character animation and responsive desktop and touch controls.';
    const eyebrow = hero.querySelector('.eyebrow');
    const title = hero.querySelector('h1');
    const lede = hero.querySelector('.lede');
    if (eyebrow) eyebrow.textContent = 'Greenhouse Gauntlet · Grow. Fight. Restore.';
    if (title) title.textContent = 'Seed Man';
    if (lede) lede.textContent = 'Cross Greenhouse Valley, Forest Ruins, Desert Canyon and Frozen Peak on the way to Eco City. Absorb temporary phenotype powers, master responsive platforming, defeat six bosses and restore every world.';
    let subtitle = hero.querySelector('.seed-game-subtitle');
    if (!subtitle) {
      subtitle = document.createElement('p');
      subtitle.className = 'seed-game-subtitle';
      subtitle.textContent = 'GREENHOUSE GAUNTLET';
      title?.insertAdjacentElement('afterend', subtitle);
    }
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
    ensureWorldRail(hero);
    const marker = hero.querySelector('#seed-ui-release-marker');
    if (marker) marker.textContent = 'GROW · FIGHT · RESTORE · 15 LEVELS';
    hero.dataset.campaignIdentity = 'greenhouse-gauntlet';
    hero.dataset.gameIdentity = 'seed-man';
    document.documentElement.dataset.seedManCampaignIdentity = 'greenhouse-gauntlet';
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

  function ensureEncounterHud(shell) {
    let hud = shell.querySelector('.seed-encounter-hud');
    if (hud) return hud;
    hud = document.createElement('div');
    hud.className = 'seed-encounter-hud';
    hud.setAttribute('aria-live', 'polite');
    hud.innerHTML = `
      <section class="seed-pheno-banner" hidden>
        <span>ABSORBED PHENOTYPE</span>
        <strong class="seed-pheno-name">None</strong>
        <em class="seed-pheno-time"></em>
      </section>
      <section class="seed-boss-banner" hidden>
        <div><span class="seed-boss-rank">BOSS ENCOUNTER</span><strong class="seed-boss-name"></strong></div>
        <div class="seed-boss-health"><i></i></div>
        <em class="seed-boss-value"></em>
      </section>`;
    const context = shell.querySelector('.seed-run-context');
    context?.insertAdjacentElement('afterend', hud);
    return hud;
  }

  function syncEncounterHud(shell) {
    const hud = ensureEncounterHud(shell);
    const combat = combatSnapshot();
    const boss = combat?.enemies?.find((enemy) => enemy?.bossRank && !enemy.defeated) || null;
    const phenotypeId = combat?.activePhenotype || null;
    const phenotype = hud.querySelector('.seed-pheno-banner');
    const bossBanner = hud.querySelector('.seed-boss-banner');
    if (phenotype) {
      phenotype.hidden = !phenotypeId;
      phenotype.querySelector('.seed-pheno-name').textContent = phenotypeId ? (PHENOTYPE_LABELS[phenotypeId] || phenotypeId) : 'None';
      phenotype.querySelector('.seed-pheno-time').textContent = phenotypeId ? `${Math.max(0, Math.ceil(Number(combat?.phenotypeRemaining) || 0))}s REMAINING · K / PHENO` : '';
    }
    if (bossBanner) {
      bossBanner.hidden = !boss;
      const health = boss ? Math.max(0, Number(boss.health) || 0) : 0;
      const maxHealth = boss ? Math.max(1, Number(boss.maxHealth) || 1) : 1;
      const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
      bossBanner.querySelector('.seed-boss-rank').textContent = boss?.bossRank === 'major' ? 'MAJOR BOSS ENCOUNTER' : 'BOSS ENCOUNTER';
      bossBanner.querySelector('.seed-boss-name').textContent = boss?.name || '';
      bossBanner.querySelector('.seed-boss-health i').style.width = `${healthPercent}%`;
      bossBanner.querySelector('.seed-boss-value').textContent = boss ? `${health} / ${maxHealth}` : '';
    }
    hud.dataset.phenotype = phenotypeId ? 'active' : 'none';
    hud.dataset.boss = boss ? 'active' : 'none';
    shell.dataset.combatBoss = boss ? 'active' : 'none';
    shell.dataset.combatPhenotype = phenotypeId || 'none';
    return { boss, phenotypeId };
  }

  function installStyles() {
    if (document.querySelector('style[data-seed-ui-v3]')) return;
    const style = document.createElement('style');
    style.dataset.seedUiV3 = VERSION;
    style.textContent = `
      .hero[data-campaign-identity="greenhouse-gauntlet"]{position:relative;overflow:hidden;padding-block:clamp(2rem,5vw,4.5rem)}
      .hero[data-campaign-identity="greenhouse-gauntlet"]::after{content:"";position:absolute;inset:auto -8% -42% 42%;height:72%;pointer-events:none;background:radial-gradient(circle at center,rgba(200,243,106,.16),transparent 68%);filter:blur(8px)}
      .hero[data-campaign-identity="greenhouse-gauntlet"] h1{max-width:11ch;font-size:clamp(3.1rem,8vw,7rem);line-height:.86;letter-spacing:-.055em;text-wrap:balance;margin-bottom:.35rem}
      .seed-game-subtitle{margin:0 0 1rem;color:var(--gold);font:950 clamp(.82rem,1.4vw,1rem)/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.2em}
      .hero[data-campaign-identity="greenhouse-gauntlet"] .lede{max-width:760px;font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.65;color:#c8d6cc}
      .seed-campaign-summary{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:.65rem;margin:1.25rem 0 1rem}.seed-campaign-summary span{display:grid;gap:.08rem;min-width:7.1rem;padding:.72rem .88rem;border:1px solid rgba(200,243,106,.18);border-radius:.8rem;background:rgba(5,18,11,.62);font:800 .68rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;color:#91a99a}.seed-campaign-summary strong{font:900 1.2rem/1.05 system-ui,sans-serif;letter-spacing:-.03em;color:#f1f5ef}
      .seed-world-rail{position:relative;z-index:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.55rem;margin:1rem 0 1.35rem}.seed-world-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.55rem;align-items:center;min-width:0;padding:.72rem .75rem;border:1px solid rgba(255,255,255,.08);border-radius:.85rem;background:linear-gradient(180deg,rgba(16,38,26,.86),rgba(7,21,13,.9));color:#cbd8ce;text-align:left;cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}.seed-world-card>span{display:grid;place-items:center;width:1.8rem;height:1.8rem;border-radius:50%;background:#0a1c12;color:#7f9787;font:900 .66rem/1 ui-monospace,SFMono-Regular,Menlo,monospace}.seed-world-card>strong{min-width:0;font-size:.76rem;line-height:1.15}.seed-world-card:hover,.seed-world-card:focus-visible{transform:translateY(-2px);border-color:rgba(200,243,106,.4);outline:none}.seed-world-card[data-active="true"]{border-color:rgba(200,243,106,.62);background:linear-gradient(180deg,rgba(31,68,43,.94),rgba(10,30,19,.96));box-shadow:0 0 26px rgba(200,243,106,.09)}.seed-world-card[data-active="true"]>span{background:var(--accent);color:#102013}.seed-world-card[data-active="true"]>strong{color:#fff}
      .game-shell[data-ui-v3="ready"]::before{display:none!important}.seed-run-context{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.65rem;align-items:center;margin:-.15rem 0 .7rem;padding:.45rem .58rem;border:1px solid rgba(200,243,106,.12);border-radius:.8rem;background:rgba(5,18,11,.72);font:850 .68rem/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.055em}.seed-run-context-world{color:var(--accent);text-transform:uppercase;letter-spacing:.11em}.seed-run-context-level{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eef5ef}.seed-run-context-order{color:#91a99a;white-space:nowrap}
      .seed-encounter-hud{display:grid;gap:.55rem;margin:0 0 .7rem}.seed-pheno-banner,.seed-boss-banner{border-radius:.85rem;background:rgba(5,15,10,.94);backdrop-filter:blur(12px)}.seed-pheno-banner{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.65rem;align-items:center;padding:.62rem .78rem;border:1px solid color-mix(in srgb,var(--seed-pheno-accent,#c8f36a) 55%,transparent);box-shadow:0 0 24px color-mix(in srgb,var(--seed-pheno-accent,#c8f36a) 12%,transparent)}.seed-pheno-banner[hidden],.seed-boss-banner[hidden]{display:none!important}.seed-pheno-banner span,.seed-boss-rank{font:900 .62rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:#91a99a}.seed-pheno-name{color:var(--seed-pheno-accent,#c8f36a);font-size:.95rem}.seed-pheno-time{font:900 .67rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;font-style:normal;color:#d9e3db;white-space:nowrap}
      .seed-boss-banner{display:grid;grid-template-columns:minmax(11rem,.42fr) minmax(0,1fr) auto;gap:.8rem;align-items:center;padding:.72rem .82rem;border:1px solid rgba(255,157,134,.54);box-shadow:0 0 28px rgba(255,120,90,.09)}.seed-boss-banner>div:first-child{display:grid;gap:.18rem}.seed-boss-name{font-size:1rem;color:#fff}.seed-boss-health{height:.62rem;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.09)}.seed-boss-health i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#f3c867,#ff806e);transition:width .16s linear}.seed-boss-value{min-width:3.8rem;text-align:right;font:900 .72rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;font-style:normal;color:#ffd9d0}
      .game-shell[data-ui-v3="ready"] .course-kicker{color:var(--accent)}.game-shell[data-ui-v3="ready"] .course-status{grid-template-columns:minmax(220px,.48fr) minmax(0,1fr)}.game-shell[data-ui-v3="ready"] .course-status-copy strong{color:#f1f5ef}.game-shell[data-ui-v3="ready"][data-boss="active"] .course-status,.game-shell[data-combat-boss="active"] .course-status{border-color:rgba(243,200,103,.48);box-shadow:0 0 26px rgba(243,200,103,.09)}.game-shell[data-ui-v3="ready"][data-boss="active"] .course-kicker,.game-shell[data-combat-boss="active"] .course-kicker{color:var(--gold)}
      @media(max-width:900px){.seed-world-rail{grid-template-columns:repeat(5,minmax(9rem,1fr));overflow-x:auto;padding-bottom:.25rem;scrollbar-width:thin}.seed-world-card{min-width:9rem}}
      @media(max-width:680px){.hero[data-campaign-identity="greenhouse-gauntlet"]{padding-block:1.7rem 2.2rem}.hero[data-campaign-identity="greenhouse-gauntlet"] h1{font-size:clamp(2.7rem,15vw,4.35rem);max-width:9ch}.seed-game-subtitle{font-size:.72rem;letter-spacing:.16em}.seed-campaign-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}.seed-campaign-summary span{min-width:0}.seed-world-rail{margin-inline:calc(50% - 50vw);padding-inline:3vw;grid-template-columns:repeat(5,minmax(8.4rem,1fr))}.seed-world-card{min-width:8.4rem}.seed-run-context{grid-template-columns:1fr auto;gap:.25rem .55rem}.seed-run-context-level{grid-column:1/-1;grid-row:2}.seed-run-context-world,.seed-run-context-order{font-size:.62rem}.seed-pheno-banner{grid-template-columns:1fr auto}.seed-pheno-banner span{grid-column:1/-1}.seed-boss-banner{grid-template-columns:1fr auto}.seed-boss-health{grid-column:1/-1;grid-row:2}.seed-boss-value{grid-column:2;grid-row:1}.game-shell[data-ui-v3="ready"] .course-status{grid-template-columns:1fr}.game-shell[data-ui-v3="ready"] .course-status-copy{grid-template-columns:1fr}.game-shell[data-ui-v3="ready"] .course-status-copy strong{white-space:normal}}
      @media(prefers-reduced-motion:reduce){.seed-world-card{transition:none}.seed-boss-health i{transition:none}}
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
    const campaignBoss = (() => { try { return window.__SPROUT_CAMPAIGN_EXPERIENCE__?.snapshot?.()?.boss || null; } catch { return null; } })();
    syncWorldRail(entry);
    const bar = ensureContextBar(shell);
    bar.querySelector('.seed-run-context-world').textContent = worldTitle;
    bar.querySelector('.seed-run-context-level').textContent = levelTitle;
    bar.querySelector('.seed-run-context-order').textContent = `LEVEL ${order} / ${TOTAL_LEVELS}`;
    const encounter = syncEncounterHud(shell);
    const bossName = encounter.boss?.name || campaignBoss?.name || '';
    const bossActive = Boolean(encounter.boss || (campaignBoss && !campaignBoss.defeated));
    kicker.textContent = bossActive ? `BOSS · ${bossName}` : `${worldTitle} · LEVEL ${order}`;
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
    shell.dataset.boss = bossActive ? 'active' : 'none';
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
      const combatNodes = ['#combat-phenotype-count', '#combat-phenotype-time', '#combat-threat-count'].map((selector) => document.querySelector(selector));
      if (typeof MutationObserver === 'function') {
        const observer = new MutationObserver(() => sync());
        for (const node of [progress, finish, document.querySelector('#seed-campaign-title'), ...combatNodes].filter(Boolean)) {
          observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true });
        }
      }
      window.addEventListener('sprout:level-selected', () => requestAnimationFrame(sync));
      const select = document.querySelector('#seed-man-level-select');
      if (select) select.addEventListener('change', () => requestAnimationFrame(sync));
      window.__SPROUT_UI_V3__ = Object.freeze({ version: VERSION, visualVersion: VISUAL_VERSION, gameTitle: GAME_TITLE, sync, phaseFor, displayWorldTitle, combatSnapshot, syncEncounterHud, loadVisualV4, ensureCampaignIdentity, syncWorldRail });
      return;
    }
    attempts += 1;
    if (attempts <= 120) window.setTimeout(tryInstall, 25);
    else console.error('Seed Man UI v3 could not find campaign shell bindings.');
  }

  if (document.readyState === 'complete') tryInstall();
  else window.addEventListener('load', tryInstall, { once: true });
})();
