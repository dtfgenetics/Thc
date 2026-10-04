#!/usr/bin/env node
import fs from 'node:fs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const arr = value => Array.isArray(value) ? value : [];
const uniq = values => [...new Set(values)];

const readiness = read('data/encyclopedia-production-readiness.json');
const visualQueue = read('content/encyclopedia/visual-production-queue-v1.json');

const visualById = new Map(arr(visualQueue.items).map(row => [row.lessonId || row.id, row]));
const lessons = arr(readiness.lessons);

const machineProductionQueue = [];
const reviewQueue = [];
const externalHumanQueue = [];

for (const lesson of lessons) {
  const visual = visualById.get(lesson.id) || {};
  const machineActions = [];

  if (!lesson.content?.complete) {
    machineActions.push('repair_lesson_content_contract');
  }
  if (!lesson.evidence?.claimEvidenceMapped) {
    machineActions.push('map_atomic_claim_evidence');
  }
  if (!lesson.evidence?.sourcesResolved) {
    machineActions.push('resolve_source_authority_and_exact_locator');
  }

  const visualStatus = String(visual.assetQaStatus || lesson.visual?.assetQaStatus || '');
  const candidateExists = [
    'produced_pending_asset_qa',
    'review_pending',
    'approved'
  ].includes(visualStatus) || Boolean(visual.canonicalAssetPath || visual.candidateAssetPath || lesson.visual?.approvedAssetId);

  if (!lesson.visual?.approved && !candidateExists) {
    machineActions.push('produce_teaching_visual_candidate');
  }

  if (machineActions.length) {
    machineProductionQueue.push({
      lessonId: lesson.id,
      number: lesson.number,
      part: lesson.part,
      title: lesson.title,
      state: lesson.state,
      priorityScore: Number(lesson.workPriority?.evidencePriorityScore || 0),
      riskScore: Number(lesson.workPriority?.evidenceRiskScore || 0),
      actions: uniq(machineActions),
      machineWorkComplete: false
    });
  }

  const reviewActions = [];
  if (lesson.evidence?.claimEvidenceMapped && !lesson.evidence?.claimEvidenceReviewed) {
    reviewActions.push('independent_claim_evidence_review');
  }
  if (!lesson.assessment?.reviewed) {
    reviewActions.push('independent_assessment_rationale_review');
  }
  if (!lesson.visual?.approved && candidateExists) {
    reviewActions.push('teaching_visual_accuracy_accessibility_qa');
  }

  if (reviewActions.length) {
    reviewQueue.push({
      lessonId: lesson.id,
      number: lesson.number,
      part: lesson.part,
      title: lesson.title,
      actions: uniq(reviewActions),
      machineWorkComplete: machineActions.length === 0
    });
  }

  const gates = [];
  if (!lesson.evidence?.claimEvidenceReviewed) gates.push('independent_science_review');
  if (!lesson.assessment?.reviewed) gates.push('assessment_rationale_review');
  if (!lesson.visual?.approved) gates.push('teaching_visual_approval');
  if (!lesson.publication?.authorized) gates.push('publication_authorization');

  if (gates.length) {
    externalHumanQueue.push({
      lessonId: lesson.id,
      number: lesson.number,
      part: lesson.part,
      title: lesson.title,
      gates: uniq(gates),
      machineWorkComplete: machineActions.length === 0
    });
  }
}

const sortWork = (a,b) =>
  Number(b.priorityScore || 0) - Number(a.priorityScore || 0) ||
  Number(b.riskScore || 0) - Number(a.riskScore || 0) ||
  Number(a.number || 0) - Number(b.number || 0);

machineProductionQueue.sort(sortWork);
reviewQueue.sort((a,b)=>Number(a.number||0)-Number(b.number||0));
externalHumanQueue.sort((a,b)=>Number(a.number||0)-Number(b.number||0));

const machineActionCounts = {};
for (const row of machineProductionQueue) {
  for (const action of row.actions) machineActionCounts[action] = (machineActionCounts[action] || 0) + 1;
}

const reviewActionCounts = {};
for (const row of reviewQueue) {
  for (const action of row.actions) reviewActionCounts[action] = (reviewActionCounts[action] || 0) + 1;
}

const output = {
  schemaVersion: '1.0.0',
  artifactId: 'thc-encyclopedia-machine-work-queue',
  generatedBy: 'scripts/build-encyclopedia-machine-work-queue.mjs',
  rule: 'Machine production work is separated from independent review and release authorization. Automation must not fabricate human, pilot, psychometric, accessibility-approval, science-review, or publication-authorization evidence.',
  summary: {
    lessonCount: lessons.length,
    machineProduction: machineProductionQueue.length,
    machineWorkComplete: lessons.length - machineProductionQueue.length,
    reviewPending: reviewQueue.length,
    externalHuman: externalHumanQueue.length,
    machineActionCounts,
    reviewActionCounts
  },
  machineProductionQueue,
  reviewQueue,
  externalHumanQueue
};

fs.writeFileSync('data/encyclopedia-machine-work-queue.json', JSON.stringify(output, null, 2) + '\n');

console.log('Encyclopedia machine-completion queue');
console.log(JSON.stringify(output.summary, null, 2));
