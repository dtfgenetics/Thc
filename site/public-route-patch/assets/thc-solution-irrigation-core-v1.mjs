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

export function alkalinityContext(input={}){
  const alkalinityAsCaCO3=optionalNumber(input.alkalinityAsCaCO3??input.alk,{min:0});
  const ph=optionalNumber(input.ph,{min:0,max:14});
  if(alkalinityAsCaCO3===null)return {alkalinityAsCaCO3:null,alkalinityMeqL:null,bicarbonateEquivalentMgL:null,ph};
  return {
    alkalinityAsCaCO3,
    alkalinityMeqL:alkalinityAsCaCO3/50,
    bicarbonateEquivalentMgL:alkalinityAsCaCO3*61.0168/50,
    ph
  };
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

const importHeaderKey=(value)=>String(value??'').trim().toLowerCase().replaceAll('µ','u').replaceAll('μ','u').replace(/caco[₃3]/g,'caco3').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const waterImportAliases=Object.freeze({
  date:['date','sample_date','collection_date','collected_date'],
  source:['source','water_source','source_name'],
  labName:['lab_name','laboratory','laboratory_name','lab'],
  reportId:['report_id','sample_id','report_number','report_no'],
  samplePoint:['sample_point','sampling_point','location','sample_location'],
  methodNotes:['method_notes','method','analytical_method','lab_method'],
  notes:['notes','comments','comment'],
  ph:['ph'],
  ec:['ec_ms_cm','ec_ms_per_cm','conductivity_ms_cm','conductivity_ms_per_cm','electrical_conductivity_ms_cm'],
  ecUs:['ec_us_cm','ec_us_per_cm','conductivity_us_cm','conductivity_us_per_cm','electrical_conductivity_us_cm'],
  alk:['alkalinity_as_caco3','alkalinity_mg_l_as_caco3','alkalinity_mg_l_caco3'],
  hard:['hardness_as_caco3','hardness_mg_l_as_caco3','total_hardness_mg_l_as_caco3'],
  n:['n_mg_l','nitrogen_mg_l','total_nitrogen_mg_l'],
  p:['p_mg_l','phosphorus_mg_l','total_phosphorus_mg_l'],
  k:['k_mg_l','potassium_mg_l'],
  no3n:['nitrate_n_mg_l','nitrate_as_n_mg_l','no3_n_mg_l'],
  so4s:['sulfate_s_mg_l','sulfate_as_s_mg_l','so4_s_mg_l'],
  ca:['calcium_mg_l','ca_mg_l'],
  mg:['magnesium_mg_l','mg_mg_l'],
  s:['sulfur_mg_l','total_sulfur_mg_l','s_mg_l'],
  fe:['iron_mg_l','fe_mg_l'],
  mn:['manganese_mg_l','mn_mg_l'],
  zn:['zinc_mg_l','zn_mg_l'],
  cu:['copper_mg_l','cu_mg_l'],
  b:['boron_mg_l','b_mg_l'],
  mo:['molybdenum_mg_l','mo_mg_l'],
  na:['sodium_mg_l','na_mg_l'],
  cl:['chloride_mg_l','cl_mg_l'],
  temp:['temp_c','temperature_c','sample_temperature_c']
});
export function normalizeWaterImportRow(row={}){
  if(!row||typeof row!=='object'||Array.isArray(row))return {row:null,recognized:[],unmapped:[],warnings:['Import row is not an object.']};
  const keyed=new Map(Object.entries(row).map(([key,value])=>[importHeaderKey(key),value]));
  const pick=(aliases)=>{for(const alias of aliases){const key=importHeaderKey(alias);if(keyed.has(key)&&String(keyed.get(key)??'').trim()!=='')return {key,value:keyed.get(key)}}return {key:null,value:null}};
  const out={},recognized=new Set(),warnings=[];
  for(const [field,aliases] of Object.entries(waterImportAliases)){
    const hit=pick(aliases);if(!hit.key)continue;recognized.add(hit.key);
    if(field==='ecUs'){const n=Number(hit.value);if(Number.isFinite(n)&&n>=0)out.ec=n/1000;else out.ec=hit.value;warnings.push('Conductivity imported from uS/cm and converted to mS/cm by dividing by 1000.');continue}
    out[field]=hit.value;
  }
  const ambiguous=[...keyed.keys()].filter(key=>/(^|_)ppm($|_)/.test(key));
  if(ambiguous.length)warnings.push('PPM-labelled columns were not auto-mapped because ppm is not treated as universally identical to mg/L without an explicit basis.');
  const unmapped=[...keyed.keys()].filter(key=>!recognized.has(key));
  return {row:out,recognized:[...recognized],unmapped,warnings};
}

export function mapWaterReportToFertigationSource(input={}){
  const report=normalizeWaterReport(input);
  if(!report)return null;
  const direct=(key)=>report[key]===null||report[key]===undefined?{value:null,source:null}:{value:report[key],source:key};
  const fallback=(primary,secondary)=>report[primary]!==null&&report[primary]!==undefined?{value:report[primary],source:primary}:report[secondary]!==null&&report[secondary]!==undefined?{value:report[secondary],source:secondary}:{value:null,source:null};
  const nutrients={
    N:fallback('n','no3n'),
    P:direct('p'),
    K:direct('k'),
    Ca:direct('ca'),
    Mg:direct('mg'),
    S:fallback('s','so4s'),
    Fe:direct('fe'),
    Mn:direct('mn'),
    Zn:direct('zn'),
    Cu:direct('cu'),
    B:direct('b'),
    Mo:direct('mo')
  };
  return {
    report,
    nutrients,
    values:Object.fromEntries(Object.entries(nutrients).map(([key,row])=>[key,row.value])),
    fallbacks:Object.fromEntries(Object.entries(nutrients).filter(([,row])=>row.source==='no3n'||row.source==='so4s').map(([key,row])=>[key,row.source]))
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
