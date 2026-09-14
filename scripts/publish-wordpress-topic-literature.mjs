import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

// RETIRED PRODUCTION MUTATOR.
//
// This file previously rewrote canonical Learning subject pages and the
// infographic library by selecting every WordPress attachment whose slug began
// with dtf-edu-. Learning Experience V3 now owns those subject routes and the
// approved visual library owns /learn/infographics/. Keeping this script
// fail-closed prevents an older workflow from racing those canonical owners.

const policyPath = process.env.DTF_VISUAL_QUALITY_POLICY || join(process.cwd(), 'site/wordpress/visual-quality-policy.json');
const literaturePath = process.env.TOPIC_LITERATURE_CONFIG || join(process.cwd(), 'site/wordpress/education/topic-literature.json');
const [policy, literature] = await Promise.all([
  readFile(policyPath, 'utf8').then(JSON.parse),
  readFile(literaturePath, 'utf8').then(JSON.parse),
]);

if (Number(policy?.schemaVersion || 0) < 3 || policy?.mode !== 'quarantine') {
  throw new Error('Visual quality quarantine policy v3+ is required before evaluating the retired topic publisher.');
}
if (policy?.replacementPolicy?.legacyAutomaticInfographicPublishingAllowed !== false) {
  throw new Error('Legacy automatic infographic publishing must remain disabled.');
}
if (policy?.replacementPolicy?.legacyInfographicReuseAllowed !== false) {
  throw new Error('Legacy infographic reuse must remain disabled.');
}
if (policy?.replacementPolicy?.automaticKeywordMediaSelectionAllowed !== false) {
  throw new Error('Automatic keyword media selection must remain disabled.');
}
if (!Array.isArray(literature?.topics) || literature.topics.length < 10) {
  throw new Error('Canonical topic literature is incomplete; refusing to infer a legacy fallback.');
}

throw new Error(
  'publish-wordpress-topic-literature.mjs is retired: Learning V3 is the sole canonical subject-page owner and ' +
  'the legacy dtf-edu infographic population is quarantined. Use the approved Learning transaction and ' +
  'publish-wordpress-approved-visual-library.mjs instead.'
);
