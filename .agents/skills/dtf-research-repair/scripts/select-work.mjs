#!/usr/bin/env node
import fs from 'node:fs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: node select-work.mjs <work-records.json> [limit]');
  process.exit(2);
}
const limit = Number(process.argv[3] || 3);
const now = Date.now();
const records = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(records)) throw new Error('expected an array of work records');

const n = (v, fallback = 1) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const emergency = new Set(['production-outage','security','privacy','data-loss','broken-core-flow']);

function score(r) {
  if (emergency.has(r.priorityClass)) return 1e12;
  const severity=n(r.severity), impact=n(r.userImpact), confidence=n(r.confidence), readiness=n(r.readiness);
  const cost=Math.max(n(r.cost),1);
  const inspected=r.lastInspectedAt ? Date.parse(r.lastInspectedAt) : 0;
  const days=inspected ? Math.max(0,(now-inspected)/86400000) : 30;
  const stalenessBoost=Math.min(2,1+days/30);
  return severity*impact*confidence*readiness*stalenessBoost/cost;
}
const ready = records.filter(r => {
  if (r.blocked || r.closed) return false;
  if (!r.nextExecutableAction) return false;
  if (r.nextEligibleInspectionAt && Date.parse(r.nextEligibleInspectionAt) > now && /inspect|audit/i.test(r.nextExecutableAction)) return false;
  if ((r.consecutiveNoopInspections || 0) >= 2 && /inspect|audit/i.test(r.nextExecutableAction)) return false;
  return true;
});
ready.sort((a,b)=>score(b)-score(a));
process.stdout.write(JSON.stringify(ready.slice(0,limit).map(r=>({...r,selectionScore:score(r)})),null,2)+'\n');
