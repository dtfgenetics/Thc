'use strict';

(function installSeedManCampaignUiV15() {
  const VERSION = 'seed-man-campaign-ui-v15';
  const TOTAL_LEVELS = 15;
  const TOTAL_WORLDS = 5;
  const TOTAL_BOSSES = 6;
  const PROGRESS_KEY = 'dtf-seed-man-campaign-v3';

  function readCompletedCount() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      const completed = Array.isArray(parsed.completed) ? parsed.completed : [];
      const validIds = new Set(window.__SPROUT_CAMPAIGN__?.listLevels?.().map((entry) => entry.id) || []);
      return new Set(completed.filter((id) => validIds.has(id))).size;
    } catch {
      return 0;
    }
  }

  function normalizeVisibleCampaignUi() {
    const kicker = document.querySelector('.seed-campaign-kicker');
    if (kicker) kicker.textContent = `${TOTAL_LEVELS}-LEVEL CAMPAIGN · ${TOTAL_WORLDS} WORLDS · ${TOTAL_BOSSES} BOSSES`;

    const title = document.querySelector('#seed-campaign-title');
    if (title) {
      title.textContent = title.textContent
        .replace(/Level\s+(\d+)\s*\/\s*11/i, `Level $1 / ${TOTAL_LEVELS}`)
        .replace(/Level\s+(\d+)\s*\/\s*15/i, `Level $1 / ${TOTAL_LEVELS}`);
    }

    const progress = document.querySelector('#seed-campaign-progress');
    if (progress) progress.textContent = `${readCompletedCount()} / ${TOTAL_LEVELS} cleared`;

    const statusNodes = [
      document.querySelector('#load-status'),
      document.querySelector('#seed-objective-status'),
      document.querySelector('[data-seed-objective]')
    ].filter(Boolean);
    for (const node of statusNodes) {
      if (typeof node.textContent === 'string') node.textContent = node.textContent.replace(/Level\s+(\d+)\s*\/\s*11/gi, `Level $1/${TOTAL_LEVELS}`);
    }

    document.documentElement.dataset.sproutCampaignLevels = String(TOTAL_LEVELS);
    document.documentElement.dataset.sproutCampaignUi = VERSION;
  }

  function install() {
    const campaign = window.__SPROUT_CAMPAIGN__;
    const baseExperience = window.__SPROUT_CAMPAIGN_EXPERIENCE__;
    if (!campaign || campaign.levelCount !== TOTAL_LEVELS || !baseExperience) {
      console.error('Seed Man 15-level campaign UI contract could not initialize.');
      return;
    }
    if (baseExperience.version === VERSION) {
      normalizeVisibleCampaignUi();
      return;
    }

    const baseLevelIds = new Set(window.__SPROUT_CAMPAIGN_BASE_LEVELS__ || []);
    const frontierIds = new Set(campaign.listLevels().filter((entry) => entry.worldId === 'world-05').map((entry) => entry.id));

    const wrappedExperience = Object.freeze({
      ...baseExperience,
      version: VERSION,
      baseVersion: baseExperience.version,
      levelCount: TOTAL_LEVELS,
      newLevelCount: TOTAL_LEVELS - 1,
      bossCount: TOTAL_BOSSES,
      selectLevel(id) {
        if (frontierIds.has(id)) {
          const select = document.querySelector('#seed-man-level-select');
          if (select) {
            select.value = id;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          queueMicrotask(normalizeVisibleCampaignUi);
          return campaign.getLevel(id);
        }
        const selected = baseExperience.selectLevel(id);
        queueMicrotask(normalizeVisibleCampaignUi);
        return selected;
      }
    });

    window.__SPROUT_CAMPAIGN_EXPERIENCE__ = wrappedExperience;

    const select = document.querySelector('#seed-man-level-select');
    if (select) {
      select.addEventListener('change', () => {
        if (baseLevelIds.has(select.value)) queueMicrotask(normalizeVisibleCampaignUi);
        else requestAnimationFrame(normalizeVisibleCampaignUi);
      });
    }

    const finish = document.querySelector('#finish-panel');
    if (finish) {
      new MutationObserver(() => queueMicrotask(normalizeVisibleCampaignUi))
        .observe(finish, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
    }

    normalizeVisibleCampaignUi();
  }

  if (document.readyState === 'complete') setTimeout(install, 0);
  else window.addEventListener('load', () => setTimeout(install, 0), { once: true });
})();
