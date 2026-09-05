(()=>{
  const PREF_KEYS=['burnBudsUxV3','protectPlantsUxV2'];
  const PREF_NAME='confirmShots';

  function disableLegacyPreference(){
    for(const key of PREF_KEYS){
      try{
        const raw=localStorage.getItem(key);
        if(!raw)continue;
        const parsed=JSON.parse(raw);
        if(!parsed||typeof parsed!=='object'||parsed[PREF_NAME]===false)continue;
        parsed[PREF_NAME]=false;
        localStorage.setItem(key,JSON.stringify(parsed));
      }catch{}
    }
  }

  function removeLegacyControl(){
    document.querySelectorAll(`[data-ptp-pref="${PREF_NAME}"]`).forEach(input=>{
      input.checked=false;
      input.closest('label')?.remove();
    });
    document.querySelectorAll('.cell.ptp-shot-armed').forEach(cell=>cell.classList.remove('ptp-shot-armed'));
  }

  document.addEventListener('change',event=>{
    const input=event.target.closest?.(`[data-ptp-pref="${PREF_NAME}"]`);
    if(!input)return;
    input.checked=false;
    disableLegacyPreference();
    event.preventDefault();
    event.stopImmediatePropagation();
    removeLegacyControl();
  },true);

  disableLegacyPreference();
  removeLegacyControl();
  if(window.BurnBudsSync)window.BurnBudsSync.subscribe(removeLegacyControl,{immediate:false});
  window.BurnBudsTargetingPolicy='native-coarse-two-tap';
})();
