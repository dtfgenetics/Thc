'use strict';

(function installSeedManVisualV4() {
  const VERSION = 'seed-man-visual-v4';
  const WORLD_THEMES = Object.freeze({
    'world-01': { key: 'greenhouse', accent: '#c8f36a', secondary: '#5bbf76', glow: 'rgba(200,243,106,.22)', sky: '#9ddcc8' },
    'world-02': { key: 'rootworks', accent: '#e6b76f', secondary: '#8b5a35', glow: 'rgba(230,183,111,.23)', sky: '#765c46' },
    'world-03': { key: 'resin', accent: '#f3c867', secondary: '#d9973e', glow: 'rgba(243,200,103,.24)', sky: '#725d86' },
    'world-04': { key: 'sky', accent: '#8fe7ff', secondary: '#aeb8ff', glow: 'rgba(143,231,255,.22)', sky: '#8ccdf4' },
    'world-05': { key: 'genetic', accent: '#d6c0ff', secondary: '#ff85c8', glow: 'rgba(214,192,255,.24)', sky: '#463b78' }
  });

  let attempts = 0;
  let observer = null;

  function installStyles() {
    if (document.querySelector('style[data-seed-visual-v4]')) return;
    const style = document.createElement('style');
    style.dataset.seedVisualV4 = VERSION;
    style.textContent = `
      .game-shell[data-visual-v4="ready"]{--world-accent:var(--accent);--world-secondary:#5bbf76;--world-glow:rgba(200,243,106,.2);position:relative;isolation:isolate;overflow:hidden;transition:background .28s ease,border-color .2s ease,box-shadow .2s ease}
      .game-shell[data-visual-v4="ready"]::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.82;background:var(--world-scene,none);background-size:cover;mix-blend-mode:screen;transition:opacity .25s ease}
      .game-shell[data-visual-v4="ready"]::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--world-accent) 20%,transparent),inset 0 30px 80px color-mix(in srgb,var(--world-accent) 5%,transparent);z-index:0}
      .game-shell[data-visual-v4="ready"]>*{position:relative;z-index:1}
      .game-shell[data-visual-v4="ready"] .seed-run-context{border-color:color-mix(in srgb,var(--world-accent) 35%,transparent);background:linear-gradient(90deg,color-mix(in srgb,var(--world-accent) 10%,#06110c),rgba(5,18,11,.76));box-shadow:0 8px 24px rgba(0,0,0,.18)}
      .game-shell[data-visual-v4="ready"] .seed-run-context-world,.game-shell[data-visual-v4="ready"] .course-kicker{color:var(--world-accent)}
      .game-shell[data-visual-v4="ready"] .course-status{border-color:color-mix(in srgb,var(--world-accent) 28%,#244832);background:linear-gradient(90deg,color-mix(in srgb,var(--world-accent) 7%,#081a11),#081a11 70%)}
      .game-shell[data-visual-v4="ready"] #course-progress-fill{background:linear-gradient(90deg,var(--world-secondary),var(--world-accent),var(--gold));box-shadow:0 0 18px var(--world-glow)}
      .game-shell[data-visual-v4="ready"] canvas{border-color:color-mix(in srgb,var(--world-accent) 42%,#315c43);box-shadow:0 20px 55px rgba(0,0,0,.42),0 0 34px var(--world-glow);transition:border-color .18s ease,box-shadow .18s ease}
      .game-shell[data-visual-v4="ready"] .hud-stat--primary{border-color:color-mix(in srgb,var(--world-accent) 23%,transparent)}
      .game-shell[data-visual-v4="ready"] .touch-controls button{border-color:color-mix(in srgb,var(--world-accent) 24%,#315a43)}
      .game-shell[data-visual-v4="ready"] .touch-controls .jump{background:linear-gradient(135deg,var(--world-accent),color-mix(in srgb,var(--world-accent) 66%,white));color:#102013;box-shadow:inset 0 -4px 0 rgba(0,0,0,.16),0 0 26px var(--world-glow)}
      .game-shell[data-visual-v4="ready"][data-combat-boss="active"]{--boss-accent:#ffcf66}
      .game-shell[data-visual-v4="ready"][data-combat-boss="active"] .seed-run-context{border-color:rgba(255,207,102,.72);box-shadow:0 0 34px rgba(255,207,102,.14)}
      .game-shell[data-visual-v4="ready"][data-combat-boss="active"] .seed-run-context::before{content:"BOSS ENCOUNTER";display:inline-flex;align-items:center;justify-content:center;padding:.22rem .45rem;border-radius:.45rem;background:#ffcf66;color:#2b1b05;font:950 .55rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;grid-column:1/-1;width:max-content}
      .game-shell[data-visual-v4="ready"][data-combat-boss="active"] canvas{border-color:#ffcf66;box-shadow:0 20px 55px rgba(0,0,0,.48),0 0 46px rgba(255,207,102,.26)}
      .game-shell[data-visual-v4="ready"][data-combat-boss="active"]::after{box-shadow:inset 0 0 0 1px rgba(255,207,102,.42),inset 0 34px 90px rgba(255,207,102,.07),0 0 44px rgba(255,207,102,.1)}
      html[data-seed-pheno-active="true"] .game-shell[data-visual-v4="ready"] .hud-stat[data-metric="power"]{border-color:var(--seed-pheno-accent,#d6c0ff);box-shadow:0 0 22px color-mix(in srgb,var(--seed-pheno-accent,#d6c0ff) 25%,transparent)}
      html[data-seed-pheno-active="true"] .game-shell[data-visual-v4="ready"] canvas{box-shadow:0 20px 55px rgba(0,0,0,.42),0 0 38px color-mix(in srgb,var(--seed-pheno-accent,#d6c0ff) 24%,transparent)}
      .game-shell[data-world-theme="greenhouse"]{--world-scene:linear-gradient(90deg,transparent 0 8%,rgba(200,243,106,.08) 8% 9%,transparent 9% 18%,rgba(200,243,106,.06) 18% 19%,transparent 19%),radial-gradient(ellipse at 50% -8%,rgba(200,243,106,.24),transparent 34rem),linear-gradient(180deg,#10281b,#07120c 68%)}
      .game-shell[data-world-theme="rootworks"]{--world-scene:radial-gradient(ellipse at 16% 8%,rgba(139,90,53,.26),transparent 24rem),radial-gradient(ellipse at 84% 42%,rgba(230,183,111,.08),transparent 20rem),repeating-linear-gradient(118deg,transparent 0 44px,rgba(230,183,111,.045) 45px 48px,transparent 49px 86px);background:linear-gradient(180deg,#17140d,#08100b)}
      .game-shell[data-world-theme="resin"]{--world-scene:radial-gradient(circle at 88% 4%,rgba(243,200,103,.24),transparent 17rem),radial-gradient(circle at 20% 56%,rgba(217,151,62,.1),transparent 18rem),repeating-linear-gradient(165deg,transparent 0 58px,rgba(243,200,103,.045) 59px 63px,transparent 64px 112px);background:linear-gradient(180deg,#18130f,#0a1010)}
      .game-shell[data-world-theme="sky"]{--world-scene:radial-gradient(ellipse at 50% 0,rgba(143,231,255,.24),transparent 28rem),radial-gradient(ellipse at 15% 36%,rgba(174,184,255,.1),transparent 18rem),linear-gradient(165deg,transparent 0 48%,rgba(255,255,255,.055) 49% 51%,transparent 52%);background:linear-gradient(180deg,#0c1b25,#071014)}
      .game-shell[data-world-theme="genetic"]{--world-scene:radial-gradient(circle at 18% 0,rgba(214,192,255,.22),transparent 24rem),radial-gradient(circle at 86% 8%,rgba(255,133,200,.16),transparent 22rem),repeating-linear-gradient(90deg,transparent 0 54px,rgba(214,192,255,.04) 55px 57px,transparent 58px 108px),repeating-linear-gradient(0deg,transparent 0 54px,rgba(255,133,200,.03) 55px 57px,transparent 58px 108px);background:linear-gradient(180deg,#151026,#090b15)}
      @media(max-width:680px){.game-shell[data-visual-v4="ready"] .touch-controls{grid-template-columns:1fr 1fr 1.28fr;gap:.5rem}.game-shell[data-visual-v4="ready"] .touch-controls button{min-height:76px;border-radius:18px;font-size:1.25rem}.game-shell[data-visual-v4="ready"] .touch-controls .jump{font-size:1.02rem}.game-shell[data-visual-v4="ready"] .seed-run-context::before{font-size:.5rem}.game-shell[data-visual-v4="ready"]::before{opacity:.6}}
      @media(prefers-reduced-motion:reduce){.game-shell[data-visual-v4="ready"],.game-shell[data-visual-v4="ready"] canvas,.game-shell[data-visual-v4="ready"] .touch-controls button{transition:none!important}}
    `;
    document.head.append(style);
  }

  function sync() {
    const shell = document.querySelector('.game-shell');
    if (!shell || shell.dataset.uiV3 !== 'ready') return false;
    const worldId = shell.dataset.world || 'world-01';
    const theme = WORLD_THEMES[worldId] || WORLD_THEMES['world-01'];
    shell.dataset.visualV4 = 'ready';
    shell.dataset.worldTheme = theme.key;
    shell.style.setProperty('--world-accent', theme.accent);
    shell.style.setProperty('--world-secondary', theme.secondary);
    shell.style.setProperty('--world-glow', theme.glow);
    document.documentElement.dataset.seedManVisual = VERSION;
    document.documentElement.dataset.seedManWorld = theme.key;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', theme.sky);
    return true;
  }

  function install() {
    if (!sync()) {
      attempts += 1;
      if (attempts <= 160) window.setTimeout(install, 25);
      else console.error('Seed Man visual v4 could not bind to UI v3.');
      return;
    }
    installStyles();
    sync();
    const shell = document.querySelector('.game-shell');
    if (typeof MutationObserver === 'function' && shell) {
      observer?.disconnect?.();
      observer = new MutationObserver(() => sync());
      observer.observe(shell, { attributes: true, attributeFilter: ['data-world', 'data-combat-boss', 'data-level-id', 'data-ui-v3'] });
    }
    window.addEventListener('sprout:level-selected', () => requestAnimationFrame(sync));
    window.__SPROUT_VISUAL_V4__ = Object.freeze({ version: VERSION, themes: WORLD_THEMES, sync });
  }

  if (document.readyState === 'complete') install();
  else window.addEventListener('load', install, { once: true });
})();
