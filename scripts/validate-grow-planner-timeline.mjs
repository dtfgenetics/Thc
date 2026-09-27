import fs from 'node:fs';

const html=fs.readFileSync('site/public-route-patch/grow-planner/index.html','utf8');

function ok(value,message){ if(!value) throw new Error(message); }

for(const marker of [
  'id="growTimeline"',
  'Cycle timeline',
  'function renderTimeline(p)',
  'grow-timeline-track',
  'grow-stage',
  'grow-today',
  'total planned span',
  'Today falls inside this plan.',
  'Create GrowLens stage tasks'
]) ok(html.includes(marker),`Grow Planner timeline missing: ${marker}`);

ok(html.includes('overflow-x:auto'),'Grow Planner timeline must preserve mobile horizontal scrolling');
ok(html.includes('const visible=p.filter(x=>x.days>0)'),'zero-day stages must not consume visual timeline width');
ok(html.includes('offset/total'),'today marker must be positioned relative to the planned span');

console.log('Grow Planner timeline contract passed.');
