#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildLessonAssessmentV2 } from './lib/encyclopedia-assessment-v2.mjs';

const base={id:'THC-ENC-043',title:'Root Respiration and Oxygen Demand',objective:'Explain oxygen demand.',coreScience:['Roots respire.']};
const stringCase=buildLessonAssessmentV2({...base,misconceptions:['Roots only need water and nutrients: Root metabolism also requires oxygen.']});
assert.match(stringCase.prompts[1],/A learner claims, "Roots only need water and nutrients"/);
assert.doesNotMatch(stringCase.prompts[1],/Root metabolism also requires oxygen/);
const objectCase=buildLessonAssessmentV2({...base,misconceptions:[{claim:'Bubbles always solve hypoxia',correction:'Other variables matter.'}]});
assert.match(objectCase.prompts[1],/A learner claims, "Bubbles always solve hypoxia"/);
assert.doesNotMatch(objectCase.prompts[1],/Other variables matter/);
const fallback=buildLessonAssessmentV2({...base,misconceptions:[]});
assert.match(fallback.prompts[1],/A common shortcut is reliable without context/);
console.log('Encyclopedia assessment claim isolation tests passed.');
