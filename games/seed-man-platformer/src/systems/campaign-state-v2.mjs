export function createCampaignState(campaign){
  const first=campaign?.worlds?.[0]?.levels?.[0]?.id;
  if(!first)throw new Error('Seed Man campaign has no levels');
  return {currentLevelId:first,unlocked:new Set([first]),completed:new Set(),bossesDefeated:new Set(),percent:0};
}

export function completeLevel(state,campaign,levelId){
  const ordered=campaign.worlds.flatMap(world=>world.levels).sort((a,b)=>a.order-b.order);
  const current=ordered.find(level=>level.id===levelId);
  if(!current)throw new Error(`Unknown Seed Man level ${levelId}`);
  const completed=new Set(state.completed);completed.add(levelId);
  const unlocked=new Set(state.unlocked);const next=ordered.find(level=>level.order===current.order+1);if(next)unlocked.add(next.id);
  const bossesDefeated=new Set(state.bossesDefeated);if(current.boss)bossesDefeated.add(current.boss);
  return {...state,currentLevelId:next?.id||levelId,completed,unlocked,bossesDefeated,percent:Math.round(completed.size/ordered.length*100)};
}

export function canPlayLevel(state,levelId){return state.unlocked.has(levelId);}
export function campaignComplete(state,campaign){return state.completed.size===campaign.levelCount&&state.bossesDefeated.has(campaign.finalBoss);}
