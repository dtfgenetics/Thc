const SAVE_VERSION='seed-man-save-v2';

export function serializeCampaignState(state){
  return JSON.stringify({version:SAVE_VERSION,currentLevelId:state.currentLevelId,unlocked:[...state.unlocked],completed:[...state.completed],bossesDefeated:[...state.bossesDefeated],percent:state.percent||0});
}

export function deserializeCampaignState(raw,{fallback}={}){
  try{
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    if(parsed?.version!==SAVE_VERSION)throw new Error('unsupported save version');
    return {currentLevelId:parsed.currentLevelId,unlocked:new Set(parsed.unlocked||[]),completed:new Set(parsed.completed||[]),bossesDefeated:new Set(parsed.bossesDefeated||[]),percent:Number(parsed.percent||0)};
  }catch(error){
    if(fallback)return fallback;
    throw error;
  }
}

export function saveCampaignState(storage,state,key='seed-man-campaign-v2'){storage.setItem(key,serializeCampaignState(state));}
export function loadCampaignState(storage,fallback,key='seed-man-campaign-v2'){const raw=storage.getItem(key);return raw?deserializeCampaignState(raw,{fallback}):fallback;}
