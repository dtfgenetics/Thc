const optionalNumber=(value,{min=-Infinity,max=Infinity}={})=>{
  if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<min||n>max)return null;
  return n;
};
const text=(value,max=500)=>String(value??'').trim().slice(0,max);
const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?Number((a-b).toFixed(6)):null;

export function numericDifference(a,b){const left=optionalNumber(a),right=optionalNumber(b);return delta(left,right)}

export function ecComparison(input={}){
  const sourceEc=optionalNumber(input.sourceEc,{min:0,max:20});
  const expectedEc=optionalNumber(input.expectedEc,{min:0,max:20});
  const feedEc=optionalNumber(input.feedEc,{min:0,max:20});
  const rootEc=optionalNumber(input.rootEc,{min:0,max:20});
  return {
    sourceEc,expectedEc,feedEc,rootEc,
    feedMinusSource:delta(feedEc,sourceEc),
    feedMinusExpected:delta(feedEc,expectedEc),
    rootMinusFeed:delta(rootEc,feedEc)
  };
}

export function ionBalanceScreening(input={}){
  const ca=optionalNumber(input.ca,{min:0}),mg=optionalNumber(input.mg,{min:0}),na=optionalNumber(input.na,{min:0}),k=optionalNumber(input.k,{min:0}),cl=optionalNumber(input.cl,{min:0}),nitrateN=optionalNumber(input.nitrateN??input.no3n,{min:0}),sulfateS=optionalNumber(input.sulfateS??input.so4s,{min:0}),alk=optionalNumber(input.alk,{min:0});
  const components={
    calcium:ca===null?null:ca/20.039,
    magnesium:mg===null?null:mg/12.1525,
    sodium:na===null?null:na/22.989769,
    potassium:k===null?null:k/39.0983,
    chloride:cl===null?null:cl/35.453,
    nitrate:nitrateN===null?null:nitrateN/14.0067,
    sulfate:sulfateS===null?null:sulfateS/16.0325,
    alkalinity:alk===null?null:alk/50
  };
  const cationKeys=['calcium','magnesium','sodium','potassium'],anionKeys=['chloride','nitrate','sulfate','alkalinity'];
  const total=keys=>keys.reduce((sum,key)=>sum+(components[key]??0),0);
  const cations=total(cationKeys),anions=total(anionKeys),denominator=cations+anions;
  const missing=[
    ...(ca===null?['calcium']:[]),...(mg===null?['magnesium']:[]),...(na===null?['sodium']:[]),...(k===null?['potassium']:[]),
    ...(cl===null?['chloride']:[]),...(nitrateN===null?['nitrate-N']:[]),...(sulfateS===null?['sulfate-S']:[]),...(alk===null?['alkalinity']:[])
  ];
  return {components,cationsMeqL:cations,anionsMeqL:anions,balanceErrorPercent:denominator>0?(cations-anions)/denominator*100:null,complete:missing.length===0,missing};
}

export function irrigationMetrics(input={}){
  const appliedMl=optionalNumber(input.appliedMl,{min:0});
  const runoffMl=optionalNumber(input.runoffMl,{min:0});
  const substrateMl=optionalNumber(input.substrateMl,{min:0});
  return {
    appliedMl,runoffMl,substrateMl,
    drainagePercent:appliedMl>0&&Number.isFinite(runoffMl)?runoffMl/appliedMl*100:null,
    shotPercent:substrateMl>0&&Number.isFinite(appliedMl)?appliedMl/substrateMl*100:null
  };
}

export function normalizeSolutionRecord(input={}){
  const startingEc=optionalNumber(input.startingEc,{min:0,max:20});
  const expectedEc=optionalNumber(input.expectedEc,{min:0,max:20});
  const finalEc=optionalNumber(input.finalEc,{min:0,max:20});
  const finalPh=optionalNumber(input.finalPh,{min:0,max:14});
  const mixedVolumeL=optionalNumber(input.mixedVolumeL,{min:0});
  return {
    name:text(input.name,120),
    sourceWaterName:text(input.sourceWaterName,160),
    startingEc,expectedEc,
    expectedEcBasis:text(input.expectedEcBasis,160),
    finalEc,finalPh,mixedVolumeL,
    mixingNotes:text(input.mixingNotes,500)
  };
}

export function normalizeWaterReport(input={}){
  const ph=optionalNumber(input.ph,{min:0,max:14});
  const ec=optionalNumber(input.ec??input.ec_ms_cm,{min:0,max:20});
  if(ph===null||ec===null)return null;
  const num=(...keys)=>{for(const key of keys){const v=optionalNumber(input[key],{min:0});if(v!==null)return v}return null};
  return {
    date:text(input.date,20),
    source:text(input.source||'Other',100),
    labName:text(input.labName??input.lab_name,120),
    reportId:text(input.reportId??input.report_id,100),
    samplePoint:text(input.samplePoint??input.sample_point,120),
    methodNotes:text(input.methodNotes??input.method_notes,500),
    ph,ec,
    alk:num('alk','alkalinity_as_caco3'),
    hard:num('hard','hardness_as_caco3'),
    n:num('n','n_mg_l'),p:num('p','p_mg_l'),k:num('k','k_mg_l'),
    no3n:num('no3n','nitrate_n_mg_l'),so4s:num('so4s','sulfate_s_mg_l'),
    ca:num('ca','calcium_mg_l'),mg:num('mg','magnesium_mg_l'),s:num('s','sulfur_mg_l'),
    fe:num('fe','iron_mg_l'),mn:num('mn','manganese_mg_l'),zn:num('zn','zinc_mg_l'),
    cu:num('cu','copper_mg_l'),b:num('b','boron_mg_l'),mo:num('mo','molybdenum_mg_l'),
    na:num('na','sodium_mg_l'),cl:num('cl','chloride_mg_l'),
    temp:num('temp','temp_c'),
    notes:text(input.notes,500),
    context:input.context&&typeof input.context==='object'?input.context:{},
    savedAt:text(input.savedAt||new Date().toISOString(),40)
  };
}

export function createFertigationHandoff(input={}){
  const solution=normalizeSolutionRecord({
    name:input.recipe?.name||input.name,
    sourceWaterName:input.sourceWaterName,
    startingEc:input.startingEc,
    expectedEc:input.expectedEc,
    expectedEcBasis:input.expectedEcBasis,
    finalEc:input.finalEc,
    finalPh:input.finalPh,
    mixedVolumeL:input.mixedVolumeL,
    mixingNotes:input.mixingNotes
  });
  return {
    version:1,
    createdAt:text(input.createdAt||new Date().toISOString(),40),
    recipe:input.recipe&&typeof input.recipe==='object'?input.recipe:{},
    sourceWaterName:solution.sourceWaterName,
    startingEc:solution.startingEc,
    expectedEc:solution.expectedEc,
    expectedEcBasis:solution.expectedEcBasis,
    finalEc:solution.finalEc,
    ecDelta:delta(solution.finalEc,solution.expectedEc),
    finalPh:solution.finalPh,
    mixedVolumeL:solution.mixedVolumeL,
    mixingNotes:solution.mixingNotes
  };
}

export function readFertigationHandoff(value){
  if(!value||value.version!==1||typeof value!=='object')return null;
  return value;
}
