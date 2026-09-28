const NUTRIENTS=Object.freeze(['N','P','K','Ca','Mg','S']);

const finite=(v,label)=>{const n=Number(v);if(!Number.isFinite(n))throw new RangeError(label+' must be finite');return n};
const nonnegative=(v,label)=>{const n=finite(v,label);if(n<0)throw new RangeError(label+' must be non-negative');return n};
const positive=(v,label)=>{const n=finite(v,label);if(n<=0)throw new RangeError(label+' must be greater than zero');return n};
const pct=(v,label)=>{const n=nonnegative(v,label);if(n>100)throw new RangeError(label+' cannot exceed 100%');return n};
const pFromP2o5=v=>pct(v,'P2O5')*0.4364;
const kFromK2o=v=>pct(v,'K2O')*0.8301;

export function normalizedAnalysis(product={}){
  return {
    N:pct(product.N??0,'N'),
    P:pFromP2o5(product.P2O5??product.P??0),
    K:kFromK2o(product.K2O??product.K??0),
    Ca:pct(product.Ca??0,'Ca'),
    Mg:pct(product.Mg??0,'Mg'),
    S:pct(product.S??0,'S'),
  };
}

export function contributionPerGram(product,volumeL){
  const L=positive(volumeL,'Final volume');
  const analysis=normalizedAnalysis(product);
  return Object.fromEntries(NUTRIENTS.map(k=>[k,1000*(analysis[k]/100)/L]));
}

export function evaluateRecipe({volumeL,sourceWater={},products=[],amounts=[]}){
  const L=positive(volumeL,'Final volume');
  const achieved=Object.fromEntries(NUTRIENTS.map(k=>[k,nonnegative(sourceWater[k]??0,'Source '+k)]));
  products.forEach((product,index)=>{
    const grams=nonnegative(amounts[index]??0,'Product grams');
    const perGram=contributionPerGram(product,L);
    for(const k of NUTRIENTS)achieved[k]+=grams*perGram[k];
  });
  return achieved;
}

export function optimizeRecipe({volumeL,sourceWater={},targets={},products=[],maxGrams=5000,iterations=600}){
  const L=positive(volumeL,'Final volume');
  if(!Array.isArray(products)||!products.length)throw new RangeError('At least one product is required');
  const max=positive(maxGrams,'Maximum grams per product');
  const target=Object.fromEntries(NUTRIENTS.map(k=>[k,nonnegative(targets[k]??0,'Target '+k)]));
  const source=Object.fromEntries(NUTRIENTS.map(k=>[k,nonnegative(sourceWater[k]??0,'Source '+k)]));
  const vectors=products.map(p=>contributionPerGram(p,L));
  const amounts=new Array(products.length).fill(0);
  const scale=Object.fromEntries(NUTRIENTS.map(k=>[k,Math.max(target[k],20)]));
  const weights=Object.fromEntries(NUTRIENTS.map(k=>[k,1/(scale[k]*scale[k])]));

  for(let iter=0;iter<iterations;iter++){
    let maxChange=0;
    for(let j=0;j<products.length;j++){
      const other={...source};
      for(let p=0;p<products.length;p++){
        if(p===j)continue;
        for(const k of NUTRIENTS)other[k]+=amounts[p]*vectors[p][k];
      }
      let numerator=0,denominator=0;
      for(const k of NUTRIENTS){
        const a=vectors[j][k],w=weights[k];
        numerator+=w*a*(target[k]-other[k]);
        denominator+=w*a*a;
      }
      const next=denominator>0?Math.min(max,Math.max(0,numerator/denominator)):0;
      maxChange=Math.max(maxChange,Math.abs(next-amounts[j]));
      amounts[j]=next;
    }
    if(maxChange<1e-7)break;
  }

  const achieved=evaluateRecipe({volumeL:L,sourceWater:source,products,amounts});
  const difference=Object.fromEntries(NUTRIENTS.map(k=>[k,achieved[k]-target[k]]));
  const active=NUTRIENTS.filter(k=>target[k]>0||source[k]>0||vectors.some(v=>v[k]>0));
  const weightedRmsPct=active.length?Math.sqrt(active.reduce((sum,k)=>sum+Math.pow(difference[k]/scale[k],2),0)/active.length)*100:0;
  return {amounts,achieved,difference,weightedRmsPct,nutrients:NUTRIENTS.slice()};
}

export {NUTRIENTS};
