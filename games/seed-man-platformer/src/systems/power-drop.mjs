const PHENOTYPE_CARRIERS=Object.freeze({fire:'fire-carrier',electric:'electric-carrier',ice:'ice-carrier'});
export function phenotypeDropForEnemy(enemy){const phenotype=enemy?.phenotype;if(!phenotype||!PHENOTYPE_CARRIERS[phenotype])return null;return {type:'phenotype',phenotype,durationMs:30000,source:PHENOTYPE_CARRIERS[phenotype]};}
