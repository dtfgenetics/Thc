// Shared natural-language lesson retrieval for both runtime and CI benchmark.
const STOP=new Set('a an and are as at be can do does for from how i in is it me my of on or the to what when where why with you your there while into during that this causes cause'.split(' '));
export function termsForQuery(query){
 return [...new Set(String(query).toLowerCase().match(/[a-z0-9]+/g)?.filter(x=>x.length>2&&!STOP.has(x))||[])];
}
function stem(w){return w.replace(/(ing|ed|es|s)$/,'');}
function lessonScore(item,terms){
 const title=String(item.title||'').toLowerCase();
 const titleWords=title.match(/[a-z0-9]+/g)||[];
 const aliases=[...(item.aliases||[]),...(item.synonyms||[]),...(item.terms||[])].join(' ').toLowerCase();
 const text=[item.objective,item.topic,item.coreScience,item.cultivation].join(' ').toLowerCase();
 let score=0,matched=0;
 for(const term of terms){
  const root=stem(term);
  const matchTitle=titleWords.some(w=>w===term||stem(w)===root||(root.length>5&&w.startsWith(root)));
  const matchAliases=aliases.includes(term)||(root.length>5&&aliases.includes(root));
  const matchText=text.includes(term);
  if(matchTitle){score+=6;matched++;}
  else if(matchAliases){score+=3;matched++;}
  else if(matchText){score+=1;matched++;}
 }
 return {score:score+matched*matched,matched};
}
export function searchLessons(fuse,query,limit=1000){
 const terms=termsForQuery(query);
 const original=fuse.search(query,{limit}).map(x=>x.item);
 if(terms.length<2)return original;
 const scores=new Map();
 for(const term of terms){
  for(const [rank,hit] of fuse.search(term,{limit}).entries()){
   const id=hit.item.id;
   const prev=scores.get(id)||{item:hit.item,fuse:0};
   prev.fuse+=(1/(rank+1));
   scores.set(id,prev);
  }
 }
 for(const item of original){if(!scores.has(item.id))scores.set(item.id,{item,fuse:0});}
 return [...scores.values()].map(x=>({...x,...lessonScore(x.item,terms)}))
  .sort((a,b)=>b.score-a.score||b.matched-a.matched||b.fuse-a.fuse||String(a.item.id).localeCompare(String(b.item.id)))
  .slice(0,limit).map(x=>x.item);
}
