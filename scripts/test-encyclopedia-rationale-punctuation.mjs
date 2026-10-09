#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildLessonAnswerRationalesV1 } from './lib/encyclopedia-assessment-v2.mjs';

const lesson={
  id:'THC-ENC-TEST',title:'Root oxygen',objective:'Record oxygen.',
  coreScience:['Roots respire.','Pores exchange gases.'],
  misconceptions:['Water alone supplies oxygen: roots also require gas exchange.'],
  cultivationRelevance:['Compare drainage.'],
  measureAndRecord:[
    {field:'Irrigation',requirement:'Log changes.'},
    {field:'Temperature',requirement:'Compare measurements!'}
  ],
  evidenceLimits:['Symptoms overlap.']
};
const report=buildLessonAnswerRationalesV1(lesson);
assert.equal(report.rationales.length,3);
for(const row of report.rationales){
  for(const point of row.points) {
    assert.doesNotMatch(point, /[.!?]{2,}$/, 'duplicated sentence-ending punctuation');
  }
}
assert.ok(report.rationales[0].points.includes('The most useful verification evidence includes Irrigation: Log changes.'));
assert.ok(report.rationales[1].points.includes('A useful discriminator is Temperature: Compare measurements.'));
assert.ok(report.rationales[2].points.includes('Also record: Temperature: Compare measurements.'));
console.log('Encyclopedia rationale punctuation PASS');
