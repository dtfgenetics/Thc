'use strict';

(() => {
  const VERSION='seed-man-release-truth-v1';
  const MARKER='LIVE RC · 20 AUTHORED LEVELS · AUTHORED WORLD ART · PHENOTYPE COMBAT';
  const CHARACTER_TARGET='classic-seed-man-oval-v1';
  const CHARACTER_CURRENT='green-armored-plant-hero';

  function applyTruth(){
    const root=document.documentElement;
    const body=document.body;
    const marker=document.querySelector('#seed-ui-release-marker');
    const eyebrow=document.querySelector('.hero .eyebrow');
    if(marker)marker.textContent=MARKER;
    if(eyebrow)eyebrow.textContent='Seed Man · 20-Level Campaign · 5 Worlds · Classic Character Target · Phenotype Combat';
    root.dataset.seedManReleaseTruth=VERSION;
    root.dataset.seedManCharacterTarget=CHARACTER_TARGET;
    root.dataset.seedManCharacterCurrent=CHARACTER_CURRENT;
    root.dataset.seedManWorldPresentation='authored-flat-transition';
    if(body){
      body.dataset.seedManArtStatus='classic-target-transition';
      delete body.dataset.seedManApprovedArt;
    }
    const meta=document.querySelector('meta[name="description"]');
    if(meta)meta.setAttribute('content','Play Seed Man, the DTF Genetics 20-level platform adventure across five worlds with six bosses, authored world art, phenotype combat, checkpoints, desktop controls, touch controls, and local high scores.');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyTruth,{once:true});
  else applyTruth();
  window.addEventListener('sprout:level-selected',applyTruth);
  window.addEventListener('seedman:campaign-complete',applyTruth);
  window.__SEED_MAN_RELEASE_TRUTH__=Object.freeze({version:VERSION,marker:MARKER,characterTarget:CHARACTER_TARGET,currentCharacterAsset:CHARACTER_CURRENT,applyTruth});
})();
