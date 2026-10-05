const ATOMIC_WEIGHTS=Object.freeze({H:1.008,C:12.011,N:14.007,O:15.999,F:18.998403163,P:30.973761998,S:32.06,Cl:35.45,Br:79.904,I:126.90447});
const HALOGENS=new Set(['F','Cl','Br','I']);
export function parseMolecularFormula(formula){
  const text=String(formula??'').trim();
  if(!text)return null;
  const tokens=[...text.matchAll(/([A-Z][a-z]?)(\d*)/g)];
  if(!tokens.length||tokens.map(m=>m[0]).join('')!==text)return null;
  const counts={};
  for(const [,element,countText] of tokens){
    if(!(element in ATOMIC_WEIGHTS))return null;
    const count=countText?Number(countText):1;
    if(!Number.isInteger(count)||count<=0)return null;
    counts[element]=(counts[element]||0)+count;
  }
  return counts;
}
export function formulaDerivedProperties(formula){
  const counts=parseMolecularFormula(formula);
  if(!counts)return {formula:String(formula??''),valid:false,molarMassGmol:null,dbe:null,counts:null};
  const molarMassGmol=Object.entries(counts).reduce((sum,[element,count])=>sum+ATOMIC_WEIGHTS[element]*count,0);
  const C=counts.C||0,H=counts.H||0,N=counts.N||0,X=[...HALOGENS].reduce((sum,key)=>sum+(counts[key]||0),0);
  const dbe=(2*C+2+N-H-X)/2;
  return {formula:String(formula),valid:true,molarMassGmol:Number(molarMassGmol.toFixed(4)),dbe:Number(dbe.toFixed(4)),counts};
}
