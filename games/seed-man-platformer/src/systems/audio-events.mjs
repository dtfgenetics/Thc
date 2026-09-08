export const AUDIO_EVENTS=Object.freeze(['jump','double-jump','land','attack-plant','attack-fire','attack-electric','attack-ice','hit','enemy-defeat','boss-phase','boss-defeat','collect','checkpoint','level-clear','game-complete']);
export function audioEventForAttack(phenotype){return `attack-${phenotype||'plant'}`;}
