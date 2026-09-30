const FIELD_LABELS={
  title:'title',
  aliases:'grower-language match',
  terms:'key term',
  synonyms:'synonym',
  measurements:'measurement',
  misconceptions:'misconception',
  objective:'learning objective',
  topic:'subject',
  tools:'related tool',
  cultivation:'cultivation context',
  coreScience:'science content',
  keywords:'keyword'
};

const normalize=v=>String(v??'').toLowerCase().replace(/\s+/g,' ').trim();
const values=v=>Array.isArray(v)?v:[v].filter(Boolean);

export function explainSearchMatch(item,query){
  const needle=normalize(query);
  if(!needle)return null;
  const ordered=['title','aliases','terms','synonyms','measurements','misconceptions','objective','topic','tools','cultivation','coreScience','keywords'];
  for(const field of ordered){
    for(const raw of values(item?.[field])){
      const text=String(raw??'').replace(/\s+/g,' ').trim();
      const lower=normalize(text);
      if(!lower||!lower.includes(needle))continue;
      const at=lower.indexOf(needle);
      const start=Math.max(0,at-54);
      const end=Math.min(text.length,at+needle.length+74);
      const snippet=(start>0?'…':'')+text.slice(start,end)+(end<text.length?'…':'');
      return {field,label:FIELD_LABELS[field]||field,snippet};
    }
  }
  const tokens=needle.split(/[^a-z0-9]+/).filter(x=>x.length>2);
  for(const field of ordered){
    for(const raw of values(item?.[field])){
      const text=String(raw??'').replace(/\s+/g,' ').trim();
      const lower=normalize(text);
      const token=tokens.find(x=>lower.includes(x));
      if(!token)continue;
      const at=lower.indexOf(token);
      const start=Math.max(0,at-54);
      const end=Math.min(text.length,at+token.length+74);
      return {field,label:FIELD_LABELS[field]||field,snippet:(start>0?'…':'')+text.slice(start,end)+(end<text.length?'…':'')};
    }
  }
  return null;
}
