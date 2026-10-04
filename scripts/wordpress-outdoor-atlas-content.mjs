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
    const candidates=FALLBACK_STARTS.map(marker=>clean.indexOf(marker)).filter(index=>index>=0&&index<end);
    if(candidates.length===0) throw new Error('Truncated Outdoor atlas closing marker has no recoverable atlas start.');
    clean=`${clean.slice(0,Math.min(...candidates))}${clean.slice(end+END.length)}`;
  }
  const residualStarts=FALLBACK_STARTS.map(marker=>clean.indexOf(marker)).filter(index=>index>=0);
  if(residualStarts.length){
    const start=Math.min(...residualStarts);
    const boundaries=['<!-- dtf-learning-v4:start -->','<!-- dtf-outdoor-v6:start -->']
      .map(marker=>clean.indexOf(marker,start))
      .filter(index=>index>start);
    if(boundaries.length===0) throw new Error('Markerless Outdoor atlas fragment has no safe following owner boundary.');
    const end=Math.min(...boundaries);
    clean=`${clean.slice(0,start)}${clean.slice(end)}`;
  }
  if(clean.includes(START)||clean.includes(END)||/class="outv6(?:-|")|data-outv6-/.test(clean)) throw new Error('Outdoor atlas cleanup left stale atlas markup.');
  return clean.trim();
}
