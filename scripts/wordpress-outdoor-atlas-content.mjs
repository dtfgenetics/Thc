const START='<!-- dtf-outdoor-visuals-v6:start -->';
const END='<!-- dtf-outdoor-visuals-v6:end -->';
const FALLBACK_STARTS=[
  '<style id="dtf-outdoor-visuals-v6-style">',
  '<section class="outv6"',
  '<section class="outv6-group"'
];

export function stripOutdoorAtlas(html){
  let clean=String(html||'');
  clean=clean.replace(/<!-- dtf-outdoor-visuals-v6:start -->[\s\S]*?<!-- dtf-outdoor-visuals-v6:end -->/g,'');
  while(clean.includes(END)){
    const end=clean.indexOf(END);
    const candidates=FALLBACK_STARTS.map(marker=>clean.lastIndexOf(marker,end)).filter(index=>index>=0);
    if(candidates.length===0) throw new Error('Truncated Outdoor atlas closing marker has no recoverable atlas start.');
    clean=`${clean.slice(0,Math.min(...candidates))}${clean.slice(end+END.length)}`;
  }
  if(clean.includes(START)||/class="outv6(?:-|")|data-outv6-/.test(clean)) throw new Error('Outdoor atlas cleanup left stale atlas markup.');
  return clean.trim();
}
