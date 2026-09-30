#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { effectiveLessonAssessment } from './lib/encyclopedia-assessment-v2.mjs';
import { readCanonicalEncyclopediaLessons, relativePath } from './lib/encyclopedia-canonical-lessons.mjs';

const root = process.cwd();
const outPath = path.join(root, 'data', 'encyclopedia-assessment-rationale-package.json');
const arr = value => Array.isArray(value) ? value.filter(Boolean) : [];
const text = value => typeof value === 'string' ? value : `${value?.field || 'Record'}: ${value?.requirement || ''}`;
const term = value => typeof value === 'string' ? value : value?.term;

function buildRationales(lesson, prompts) {
  const science = arr(lesson.coreScience);
  const records = arr(lesson.measureAndRecord).map(text);
  const misconceptions = arr(lesson.misconceptions).map(String);
  const limits = arr(lesson.evidenceLimits).map(String);
  const relevance = arr(lesson.cultivationRelevance).map(String);
  return [
    {
      questionId: `${lesson.id}-Q1`,
      expectedReasoning: [
        `Connect the answer to the controlled objective: ${lesson.objective}`,
        `Use the lesson mechanism or workflow: ${science[0] || 'Apply the controlled core-science statements.'}`,
        `Select a discriminating observation or measurement: ${records[0] || 'Record the relevant condition and outcome.'}`,
        'State what result would support the interpretation and what result would weaken it.'
      ]
    },
    {
      questionId: `${lesson.id}-Q2`,
      expectedReasoning: [
        `Identify the shortcut being tested: ${misconceptions[0] || 'Treating an unsupported shortcut as a universal rule.'}`,
        `Correct it using controlled lesson science: ${science[1] || science[0] || 'Use the lesson mechanism and context.'}`,
        `Apply the stated transfer limit: ${limits[0] || 'Do not generalize beyond the tested context and method.'}`,
        `Name a measurement that could distinguish the explanations: ${records[1] || records[0] || 'Use a repeatable lesson-specific measure.'}`
      ]
    },
    {
      questionId: `${lesson.id}-Q3`,
      expectedReasoning: [
        `Frame the practical decision: ${relevance[0] || lesson.objective}`,
        `Record a baseline and the intervention with the same method: ${records.slice(0, 3).join(' | ') || 'Use consistent before-and-after records.'}`,
        'Compare like units, sampling positions, timing, and environmental context.',
        `Revise the interpretation when the measured response conflicts with the proposed mechanism or falls outside this limit: ${limits[0] || 'the lesson evidence boundary'}.`
      ]
    }
  ];
}

const lessons = readCanonicalEncyclopediaLessons(root);
const records = lessons.map(lesson => {
  const assessment = effectiveLessonAssessment(lesson);
  const prompts = arr(assessment.prompts).slice(0, 3);
  return {
    lessonId: lesson.id,
    number: Number(lesson.number),
    part: lesson.__part,
    title: lesson.title,
    canonicalFile: lesson.__path,
    assessmentVersion: Number(assessment.version || 2),
    pattern: assessment.pattern,
    prompts,
    rationales: buildRationales(lesson, prompts),
    sourceAnchors: arr(lesson.sourceNotes).map(note => typeof note === 'string' ? note : (note?.title || note?.id || '')).filter(Boolean).slice(0, 4),
    evidenceLimits: arr(lesson.evidenceLimits).map(String).slice(0, 2),
    keyTerms: arr(lesson.terms).length ? arr(lesson.terms).map(term).filter(Boolean) : arr(lesson.termsToKnow).map(term).filter(Boolean),
    reviewState: 'generated_draft_needs_independent_review',
    learnerFacing: false,
    publicationEffect: 'none_review_state_unchanged'
  };
});

const output = {
  schemaVersion: '1.0.0',
  artifactId: 'thc-encyclopedia-assessment-rationale-package',
  generatedBy: 'scripts/build-encyclopedia-assessment-rationales.mjs',
  scope: 'All 420 controlled THC-ENC lessons. Rationales are draft reviewer aids, not approved answer keys.',
  releaseRule: 'No rationale becomes learner-facing or changes lesson publication state without independent assessment and science review.',
  summary: {
    lessonCount: records.length,
    promptCount: records.reduce((sum, row) => sum + row.prompts.length, 0),
    rationaleCount: records.reduce((sum, row) => sum + row.rationales.length, 0),
    pendingIndependentReview: records.filter(row => row.reviewState.includes('pending') || row.reviewState.includes('needs')).length,
    approved: 0
  },
  lessons: records
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia assessment rationale package: ${records.length}/420 lessons · ${output.summary.rationaleCount} draft rationales · 0 approved`);
console.log(`Wrote ${relativePath(root, outPath)}`);
