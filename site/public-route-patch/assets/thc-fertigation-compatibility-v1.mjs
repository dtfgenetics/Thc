const finite=value=>{
  if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

export const CONCENTRATE_RULES=[
  {id:'calcium-phosphate',severity:'separate',classes:['calcium-salt','phosphate-salt'],message:'Calcium and phosphate chemistry classes are assigned to the same concentrated stock. Separate them unless the fertilizer manufacturer explicitly documents compatibility.'},
  {id:'calcium-sulfate',severity:'separate',classes:['calcium-salt','sulfate-salt'],message:'Calcium and sulfate chemistry classes are assigned to the same concentrated stock. Separate them unless the fertilizer manufacturer explicitly documents compatibility.'},
  {id:'iron-phosphate-review',severity:'review',classes:['iron-micro','phosphate-salt'],message:'Iron/micronutrient and phosphate chemistry classes are assigned to the same concentrated stock. Review the exact chelate/formulation and manufacturer guidance before co-concentrating.'}
];

export function normalizeCompatibilityRow(row={},index=0){
  return {
    id:String(row.id||index+1),
    name:String(row.name||('Product '+(index+1))),
    grams:Math.max(0,finite(row.grams??row.g)??0),
    stock:String(row.stock||''),
    chemistryClass:String((row.chemistryClass??row.chem)||''),
    stockVolumeL:finite(row.stockVolumeL??row.stockVol),
    solubilityLimitGL:finite(row.solubilityLimitGL??row.sol)
  };
}

export function evaluateFertigationCompatibility(rows,{finalVolumeL=null}={}){
  const products=(Array.isArray(rows)?rows:[]).map(normalizeCompatibilityRow);
  const issues=[];
  for(const stock of ['stock-a','stock-b']){
    const members=products.filter(row=>row.stock===stock&&row.chemistryClass);
    const classes=new Set(members.map(row=>row.chemistryClass));
    for(const rule of CONCENTRATE_RULES){
      if(rule.classes.every(value=>classes.has(value))){
        issues.push({type:'compatibility',severity:rule.severity,ruleId:rule.id,stock,productIds:members.filter(row=>rule.classes.includes(row.chemistryClass)).map(row=>row.id),message:stock+': '+rule.message});
      }
    }
  }
  const directVolume=finite(finalVolumeL);
  for(const row of products){
    const volume=row.stock==='direct'?directVolume:row.stockVolumeL;
    if(!(row.grams>0)||!(volume>0)||!(row.solubilityLimitGL>0))continue;
    const plannedGL=row.grams/volume;
    if(plannedGL>row.solubilityLimitGL){
      issues.push({type:'solubility',severity:'review',ruleId:'user-solubility-limit',stock:row.stock,productIds:[row.id],plannedGL,limitGL:row.solubilityLimitGL,message:row.name+': planned '+plannedGL.toFixed(1)+' g/L exceeds the user-entered solubility limit '+row.solubilityLimitGL.toFixed(1)+' g/L.'});
    }
  }
  return {products,issues,blockers:issues.filter(issue=>issue.severity==='separate'),reviews:issues.filter(issue=>issue.severity!=='separate')};
}
