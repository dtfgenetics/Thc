'use strict';

(() => {
  const VERSION='seed-man-campaign-ui-v20';
  const TUTORIAL_VERSION='seed-man-tutorial-ui-v1';
  const SCOREBOARD_VERSION='seed-man-scoreboard-v1';
  const TOTAL_LEVELS=20;
  const TOTAL_WORLDS=5;
  const TOTAL_BOSSES=6;
  const PROGRESS_KEYS=['dtf-seed-man-campaign-v20','dtf-seed-man-campaign-v3'];
  const ACTIVE_PROGRESS_KEY=PROGRESS_KEYS[0];
  const TUTORIAL_SESSION_KEY='dtf-seed-man-tutorial-seen-v1';
  const SCOREBOARD_KEY='dtf-seed-man-high-scores-v1';
  const PLAYER_NAME_KEY='dtf-seed-man-player-name-v1';
  const SCORE_LIMIT=10;
  const NEXT_LEVEL_DELAY_MS=1100;
  const TUTORIAL_PRE_TRIGGER=90;
  const TUTORIAL_POST_TRIGGER=340;
  const TUTORIAL_AUTO_DISMISS_MS=5200;
  let advanceTimer=null;
  let transitionFromLevel=null;
  let tutorialRoot=null;
  let tutorialAction=null;
  let tutorialText=null;
  let tutorialDismiss=null;
  let tutorialFrame=null;
  let completionFrame=null;
  let activeTutorial=null;
  let activeTutorialStartedAt=0;
  const tutorialSeen=new Set(loadTutorialSeen());

  function loadTutorialSeen(){
    try{
      const parsed=JSON.parse(sessionStorage.getItem(TUTORIAL_SESSION_KEY)||'[]');
      return Array.isArray(parsed)?parsed.filter((value)=>typeof value==='string'):[];
    }catch{return [];}
  }

  function persistTutorialSeen(){
    try{sessionStorage.setItem(TUTORIAL_SESSION_KEY,JSON.stringify([...tutorialSeen]));}catch{}
  }

  function completedCount(){
    const valid=new Set(window.__SPROUT_CAMPAIGN__?.listLevels?.().map((entry)=>entry.id)||[]);
    const completed=new Set();
    for(const key of PROGRESS_KEYS){try{const parsed=JSON.parse(localStorage.getItem(key)||'{}');for(const id of Array.isArray(parsed.completed)?parsed.completed:[])if(valid.has(id))completed.add(id);}catch{}}
    return completed.size;
  }

  function markCompleted(levelId){
    if(!levelId)return;
    try{
      const parsed=JSON.parse(localStorage.getItem(ACTIVE_PROGRESS_KEY)||'{}');
      const completed=new Set(Array.isArray(parsed.completed)?parsed.completed:[]);
      completed.add(levelId);
      localStorage.setItem(ACTIVE_PROGRESS_KEY,JSON.stringify({...parsed,version:20,completed:[...completed]}));
    }catch(error){
      console.warn('[Seed Man] campaign completion could not be persisted.',error);
    }
  }

  function getNextLevelId(levelId){
    const campaign=window.__SPROUT_CAMPAIGN__;
    const levels=campaign?.listLevels?.()||[];
    const index=levels.findIndex((entry)=>entry.id===levelId);
    return index>=0&&index<levels.length-1?levels[index+1].id:null;
  }

  function sanitizePlayerName(value){
    const cleaned=String(value||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,16);
    return cleaned||'Seed Grower';
  }

  function storedPlayerName(){
    try{return localStorage.getItem(PLAYER_NAME_KEY)||'';}catch{return '';}
  }

  function loadScores(){
    try{
      const parsed=JSON.parse(localStorage.getItem(SCOREBOARD_KEY)||'{}');
      if(parsed&&typeof parsed==='object'&&parsed.levels&&typeof parsed.levels==='object')return parsed;
    }catch{}
    return {version:1,levels:{}};
  }

  function saveScores(board){
    try{localStorage.setItem(SCOREBOARD_KEY,JSON.stringify(board));}
    catch(error){console.warn('[Seed Man] high scores could not be persisted.',error);}
  }

  function currentPlayerName(){
    const input=document.querySelector('#score-player-name');
    const name=sanitizePlayerName(input?.value||storedPlayerName());
    if(input&&input.value!==name)input.value=name;
    try{localStorage.setItem(PLAYER_NAME_KEY,name);}catch{}
    return name;
  }

  function scoreForRun({seconds,collected,deaths,required}){
    const safeSeconds=Math.max(0,Number(seconds)||0);
    const safeCollected=Math.max(0,Number(collected)||0);
    const safeDeaths=Math.max(0,Number(deaths)||0);
    const safeRequired=Math.max(0,Number(required)||0);
    const completion=10000;
    const seedBonus=safeCollected*250;
    const allSeedsBonus=safeRequired>0&&safeCollected>=safeRequired?1500:0;
    const speedBonus=Math.max(0,10000-Math.floor(safeSeconds*40));
    const flawlessBonus=safeDeaths===0?2500:0;
    const fallPenalty=safeDeaths*500;
    return Math.max(0,completion+seedBonus+allSeedsBonus+speedBonus+flawlessBonus-fallPenalty);
  }

  function runSnapshot(levelId){
    let seconds=0,collected=0,deaths=0,required=0;
    try{seconds=Number(typeof elapsed!=='undefined'?elapsed:0)||0;}catch{}
    try{collected=Number(typeof player!=='undefined'&&player?.collected?.length)||0;deaths=Number(typeof player!=='undefined'&&player?.deaths)||0;}catch{}
    try{required=Number(typeof level!=='undefined'?(level?.requiredPickups??level?.pickups?.length):0)||0;}catch{}
    return {levelId,seconds,collected,deaths,required};
  }

  function recordScore(levelId){
    if(!levelId)return null;
    const snapshot=runSnapshot(levelId);
    const entry={
      id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      name:currentPlayerName(),
      score:scoreForRun(snapshot),
      time:Number(snapshot.seconds.toFixed(2)),
      deaths:snapshot.deaths,
      seeds:snapshot.collected,
      required:snapshot.required,
      completedAt:new Date().toISOString()
    };
    const board=loadScores();
    const current=Array.isArray(board.levels[levelId])?board.levels[levelId]:[];
    board.version=1;
    board.levels[levelId]=[...current,entry]
      .sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0)||(Number(a.time)||Infinity)-(Number(b.time)||Infinity)||(Number(a.deaths)||0)-(Number(b.deaths)||0))
      .slice(0,SCORE_LIMIT);
    saveScores(board);
    renderScoreboard(levelId);
    window.dispatchEvent(new CustomEvent('seedman:score-recorded',{detail:{levelId,entry:{...entry}}}));
    return entry;
  }

  function renderScoreboard(levelId=window.__SPROUT_CAMPAIGN__?.activeLevelId){
    const body=document.querySelector('#scoreboard-body');
    const label=document.querySelector('#scoreboard-level');
    if(!body)return;
    const campaign=window.__SPROUT_CAMPAIGN__;
    const meta=campaign?.getLevel?.(levelId);
    if(label)label.textContent=meta?`Level ${meta.order} · ${meta.title}`:'Current level';
    const entries=loadScores().levels[levelId]||[];
    body.textContent='';
    if(!entries.length){
      const row=document.createElement('tr');
      const cell=document.createElement('td');
      cell.colSpan=5;cell.className='score-empty';cell.textContent='No completed runs yet. Reach the flag to set the first score.';row.append(cell);body.append(row);return;
    }
    entries.forEach((entry,index)=>{
      const row=document.createElement('tr');
      const values=[`#${index+1}`,sanitizePlayerName(entry.name),Number(entry.score||0).toLocaleString(),`${Number(entry.time||0).toFixed(1)}s`,String(Number(entry.deaths)||0)];
      for(const value of values){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);
    });
  }

  function installScoreboard(){
    const input=document.querySelector('#score-player-name');
    if(input){
      input.value=sanitizePlayerName(storedPlayerName()||input.value);
      input.addEventListener('change',()=>{input.value=sanitizePlayerName(input.value);try{localStorage.setItem(PLAYER_NAME_KEY,input.value);}catch{}});
    }
    renderScoreboard();
    document.documentElement.dataset.seedManScoreboard=SCOREBOARD_VERSION;
    window.__SEED_MAN_SCOREBOARD__=Object.freeze({version:SCOREBOARD_VERSION,key:SCOREBOARD_KEY,limit:SCORE_LIMIT,render:renderScoreboard,scoreForRun});
  }

  function normalize(){
    const kicker=document.querySelector('.seed-campaign-kicker');if(kicker)kicker.textContent=`${TOTAL_LEVELS}-LEVEL CAMPAIGN · ${TOTAL_WORLDS} WORLDS · ${TOTAL_BOSSES} BOSSES`;
    const title=document.querySelector('#seed-campaign-title');if(title)title.textContent=String(title.textContent||'').replace(/Level\s+(\d+)\s*\/\s*(?:11|15|20)/i,`Level $1 / ${TOTAL_LEVELS}`);
    const progress=document.querySelector('#seed-campaign-progress');if(progress)progress.textContent=`${completedCount()} / ${TOTAL_LEVELS} cleared`;
    const marker=document.querySelector('#seed-ui-release-marker');if(marker)marker.textContent='LIVE UI · 20 LEVELS · APPROVED ART · PHENOTYPE COMBAT';
    document.querySelectorAll('.feature-strip article strong').forEach((node)=>{if(/15\s*levels/i.test(node.textContent||''))node.textContent='20 levels';});
    document.documentElement.dataset.sproutCampaignLevels=String(TOTAL_LEVELS);
    document.documentElement.dataset.sproutCampaignUi=VERSION;
  }

  function clearAdvance(){
    if(advanceTimer!==null){clearTimeout(advanceTimer);advanceTimer=null;}
  }

  function selectNextLevel(completedId,nextId){
    const campaign=window.__SPROUT_CAMPAIGN__;
    if(!campaign||campaign.activeLevelId!==completedId)return false;
    try{
      campaign.selectLevel(nextId);
      const select=document.querySelector('#seed-man-level-select');if(select)select.value=nextId;
      window.dispatchEvent(new CustomEvent('seedman:level-advanced',{detail:{from:completedId,to:nextId}}));
      return true;
    }catch(error){
      console.error('[Seed Man] next level failed to load.',error);
      transitionFromLevel=null;
      const retry=document.querySelector('#load-status');if(retry)retry.textContent='Level cleared, but the next level could not load. Choose it from Level Select to continue.';
      return false;
    }
  }

  function handleFinish(){
    const campaign=window.__SPROUT_CAMPAIGN__;
    let finished=false;
    try{finished=Boolean(typeof player!=='undefined'&&player?.finished);}catch{}
    const finish=document.querySelector('#finish-panel');
    if(!campaign||(!finished&&(!finish||finish.hidden)))return;
    const completedId=campaign.activeLevelId;
    if(!completedId||transitionFromLevel===completedId)return;

    transitionFromLevel=completedId;
    markCompleted(completedId);
    const scoreEntry=recordScore(completedId);
    dismissTutorial({remember:false});
    normalize();

    const nextId=getNextLevelId(completedId);
    const summary=document.querySelector('#finish-summary');
    const nextButton=document.querySelector('#next-level');
    if(summary&&scoreEntry)summary.textContent=`${summary.textContent||''} Score: ${scoreEntry.score.toLocaleString()} pts.`.trim();
    if(!nextId){
      clearAdvance();
      if(summary)summary.textContent=`${summary.textContent||''} Campaign complete — all ${TOTAL_LEVELS} levels cleared.`.trim();
      if(nextButton){nextButton.textContent='Play Campaign Again';nextButton.dataset.nextLevel='';}
      document.documentElement.dataset.seedManCampaignComplete='true';
      window.dispatchEvent(new CustomEvent('seedman:campaign-complete',{detail:{levelId:completedId,levelCount:TOTAL_LEVELS}}));
      return;
    }

    const next=campaign.getLevel?.(nextId);
    const status=document.querySelector('#load-status');
    if(status)status.textContent=`Level cleared · loading Level ${next?.order||''}${next?.title?` — ${next.title}`:''}…`;
    if(summary)summary.textContent=`${summary.textContent||''} Next: ${next?.title||nextId}.`.trim();
    if(nextButton){nextButton.textContent=`Next: ${next?.title||'Level'}`;nextButton.dataset.nextLevel=nextId;}

    clearAdvance();
    advanceTimer=setTimeout(()=>{advanceTimer=null;selectNextLevel(completedId,nextId);},NEXT_LEVEL_DELAY_MS);
  }

  function handleNextButton(){
    const campaign=window.__SPROUT_CAMPAIGN__;
    if(!campaign)return;
    const completedId=transitionFromLevel||campaign.activeLevelId;
    const nextId=getNextLevelId(completedId);
    clearAdvance();
    if(nextId){selectNextLevel(completedId,nextId);return;}
    const first=campaign.listLevels?.()[0]?.id;
    if(first){delete document.documentElement.dataset.seedManCampaignComplete;transitionFromLevel=null;campaign.selectLevel(first);}
  }

  function tickCompletion(){
    completionFrame=requestAnimationFrame(tickCompletion);
    let finished=false;
    try{finished=Boolean(typeof player!=='undefined'&&player?.finished);}catch{}
    if(finished)handleFinish();
  }

  function actionLabel(action){
    return ({move:'MOVE',jump:'DOUBLE JUMP',attack:'ATTACK',phenotype:'PHENOTYPE'})[action]||String(action||'TIP').toUpperCase();
  }

  function ensureTutorialUi(){
    if(tutorialRoot?.isConnected)return tutorialRoot;
    const shell=document.querySelector('.game-shell');
    if(!shell)return null;
    tutorialRoot=document.createElement('aside');
    tutorialRoot.className='seed-tutorial';
    tutorialRoot.hidden=true;
    tutorialRoot.setAttribute('role','status');
    tutorialRoot.setAttribute('aria-live','polite');
    tutorialRoot.setAttribute('aria-atomic','true');
    tutorialRoot.dataset.tutorialUi=TUTORIAL_VERSION;
    tutorialRoot.innerHTML='<span class="seed-tutorial-kicker">FIELD GUIDE</span><strong class="seed-tutorial-action"></strong><span class="seed-tutorial-text"></span><button class="seed-tutorial-dismiss" type="button" aria-label="Dismiss tutorial tip">GOT IT</button>';
    tutorialAction=tutorialRoot.querySelector('.seed-tutorial-action');
    tutorialText=tutorialRoot.querySelector('.seed-tutorial-text');
    tutorialDismiss=tutorialRoot.querySelector('.seed-tutorial-dismiss');
    tutorialDismiss?.addEventListener('click',()=>dismissTutorial({remember:true}));
    const canvas=shell.querySelector('#game');
    if(canvas?.nextSibling)shell.insertBefore(tutorialRoot,canvas.nextSibling);else shell.append(tutorialRoot);
    return tutorialRoot;
  }

  function tutorialKey(levelId,tutorialId){return `${levelId}:${tutorialId}`;}

  function showTutorial(levelId,tutorial){
    const root=ensureTutorialUi();
    if(!root||!tutorial?.id)return;
    const key=tutorialKey(levelId,tutorial.id);
    if(activeTutorial?.key===key)return;
    activeTutorial={key,levelId,tutorialId:tutorial.id};
    activeTutorialStartedAt=performance.now();
    root.dataset.action=tutorial.action||'tip';
    root.hidden=false;
    if(tutorialAction)tutorialAction.textContent=actionLabel(tutorial.action);
    if(tutorialText)tutorialText.textContent=tutorial.text||'';
    document.documentElement.dataset.seedManTutorial=tutorial.id;
    window.dispatchEvent(new CustomEvent('seedman:tutorial-shown',{detail:{levelId,tutorialId:tutorial.id,action:tutorial.action||null}}));
  }

  function dismissTutorial({remember=true}={}){
    if(activeTutorial&&remember){tutorialSeen.add(activeTutorial.key);persistTutorialSeen();}
    if(tutorialRoot)tutorialRoot.hidden=true;
    if(activeTutorial)window.dispatchEvent(new CustomEvent('seedman:tutorial-dismissed',{detail:{...activeTutorial,remembered:remember}}));
    activeTutorial=null;
    activeTutorialStartedAt=0;
    delete document.documentElement.dataset.seedManTutorial;
  }

  function activeLevelTutorials(){
    try{
      if(typeof level==='undefined'||!level||!Array.isArray(level.tutorials))return [];
      return level.tutorials;
    }catch{return [];}
  }

  function playerPosition(){
    try{return typeof player!=='undefined'&&player?Number(player.x):NaN;}catch{return NaN;}
  }

  function tickTutorial(now){
    tutorialFrame=requestAnimationFrame(tickTutorial);
    const campaign=window.__SPROUT_CAMPAIGN__;
    const levelId=campaign?.activeLevelId;
    const x=playerPosition();
    if(!levelId||!Number.isFinite(x)){if(activeTutorial)dismissTutorial({remember:false});return;}
    const tutorials=activeLevelTutorials();
    if(!tutorials.length){if(activeTutorial)dismissTutorial({remember:false});return;}

    if(activeTutorial){
      const tutorial=tutorials.find((entry)=>tutorialKey(levelId,entry.id)===activeTutorial.key);
      const passed=tutorial&&x>Number(tutorial.x)+TUTORIAL_POST_TRIGGER;
      const expired=activeTutorialStartedAt>0&&now-activeTutorialStartedAt>=TUTORIAL_AUTO_DISMISS_MS;
      if(passed||expired){dismissTutorial({remember:true});}
      return;
    }

    const candidate=tutorials.find((tutorial)=>{
      const triggerX=Number(tutorial.x);
      if(!tutorial?.id||!Number.isFinite(triggerX))return false;
      const key=tutorialKey(levelId,tutorial.id);
      return !tutorialSeen.has(key)&&x>=triggerX-TUTORIAL_PRE_TRIGGER&&x<=triggerX+TUTORIAL_POST_TRIGGER;
    });
    if(candidate)showTutorial(levelId,candidate);
  }

  function resetTutorialForLevel(){
    if(activeTutorial)dismissTutorial({remember:false});
    ensureTutorialUi();
  }

  function installTutorialController(){
    ensureTutorialUi();
    if(tutorialFrame===null)tutorialFrame=requestAnimationFrame(tickTutorial);
    window.__SEED_MAN_TUTORIAL_UI__=Object.freeze({
      version:TUTORIAL_VERSION,
      sessionKey:TUTORIAL_SESSION_KEY,
      dismiss:()=>dismissTutorial({remember:true}),
      resetSession:()=>{tutorialSeen.clear();try{sessionStorage.removeItem(TUTORIAL_SESSION_KEY);}catch{};dismissTutorial({remember:false});},
      get active(){return activeTutorial?{...activeTutorial}:null;},
      seen:()=>Object.freeze([...tutorialSeen])
    });
    document.documentElement.dataset.seedManTutorialUi=TUTORIAL_VERSION;
  }

  function install(){
    const campaign=window.__SPROUT_CAMPAIGN__;
    if(!campaign||campaign.levelCount!==TOTAL_LEVELS){setTimeout(install,25);return;}
    const base=window.__SPROUT_CAMPAIGN_EXPERIENCE__||{};
    window.__SPROUT_CAMPAIGN_EXPERIENCE__=Object.freeze({...base,version:VERSION,baseVersion:base.version||null,levelCount:TOTAL_LEVELS,newLevelCount:19,bossCount:TOTAL_BOSSES,tutorialUi:TUTORIAL_VERSION,scoreboard:SCOREBOARD_VERSION,selectLevel:(id)=>{clearAdvance();transitionFromLevel=null;resetTutorialForLevel();const selected=campaign.selectLevel(id);queueMicrotask(normalize);queueMicrotask(()=>renderScoreboard(id));return selected;}});
    const select=document.querySelector('#seed-man-level-select');if(select)select.addEventListener('change',()=>{requestAnimationFrame(normalize);requestAnimationFrame(()=>renderScoreboard(select.value));});
    const finish=document.querySelector('#finish-panel');if(finish)new MutationObserver(()=>{queueMicrotask(normalize);queueMicrotask(handleFinish);}).observe(finish,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});
    document.querySelector('#next-level')?.addEventListener('click',handleNextButton);
    window.addEventListener('seedman:level-completed',handleFinish);
    window.addEventListener('sprout:level-selected',(event)=>{clearAdvance();transitionFromLevel=null;resetTutorialForLevel();queueMicrotask(normalize);queueMicrotask(()=>renderScoreboard(event.detail?.levelId));});
    installTutorialController();
    installScoreboard();
    if(completionFrame===null)completionFrame=requestAnimationFrame(tickCompletion);
    normalize();
  }

  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
