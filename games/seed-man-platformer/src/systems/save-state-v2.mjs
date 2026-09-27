import { field, safeParseJson, validateObjectShape } from '../../../shared-platform/src/validation.mjs';

const SAVE_VERSION='seed-man-save-v2';
const SAVE_SCHEMA=Object.freeze({
  version:field.literal(SAVE_VERSION),
  currentLevelId:field.string({min:1,max:120}),
  unlocked:field.stringArray({maxItems:100}),
  completed:field.stringArray({maxItems:100}),
  bossesDefeated:field.stringArray({maxItems:50}),
  percent:field.number({min:0,max:100}),
});

export function serializeCampaignState(state){
  return JSON.stringify({
    version:SAVE_VERSION,
    currentLevelId:state.currentLevelId,
    unlocked:[...state.unlocked],
    completed:[...state.completed],
    bossesDefeated:[...state.bossesDefeated],
    percent:state.percent||0
  });
}

export function deserializeCampaignState(raw,{fallback}={}){
  const result=safeParseJson(raw,(value)=>validateObjectShape(value,SAVE_SCHEMA,{allowUnknown:false}));
  if(!result.success){
    if(fallback)return fallback;
    const message=result.error.issues.map((issue)=>`${issue.path.join('.')||'save'}: ${issue.message}`).join('; ');
    const error=new Error(`Invalid Seed Man save: ${message}`);
    error.issues=result.error.issues;
    throw error;
  }

  const parsed=result.data;
  return {
    currentLevelId:parsed.currentLevelId,
    unlocked:new Set(parsed.unlocked),
    completed:new Set(parsed.completed),
    bossesDefeated:new Set(parsed.bossesDefeated),
    percent:parsed.percent,
  };
}

export function saveCampaignState(storage,state,key='seed-man-campaign-v2'){storage.setItem(key,serializeCampaignState(state));}
export function loadCampaignState(storage,fallback,key='seed-man-campaign-v2'){const raw=storage.getItem(key);return raw?deserializeCampaignState(raw,{fallback}):fallback;}
