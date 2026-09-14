import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

// RETIRED PRODUCTION MUTATOR.
//
// The former implementation uploaded source infographic files as dtf-edu-*
// WordPress media and rebuilt the legacy visual library. That media identity is
// now explicitly quarantined sitewide. Keep this file as a fail-closed guard so
// historical workflows cannot silently revive the retired visual family.

const policyPath = process.env.DTF_VISUAL_QUALITY_POLICY || join(process.cwd(), 'site/wordpress/visual-quality-policy.json');
const policy = JSON.parse(await readFile(policyPath, 'utf8'));

if (Number(policy?.schemaVersion || 0) < 3 || policy?.mode !== 'quarantine') {
  throw new Error('Visual quality quarantine policy v3+ is required before evaluating the retired infographic uploader.');
}
if (policy?.replacementPolicy?.legacyAutomaticInfographicPublishingAllowed !== false) {
  throw new Error('Legacy automatic infographic publishing must remain disabled.');
}
if (policy?.replacementPolicy?.legacyInfographicReuseAllowed !== false) {
  throw new Error('Legacy infographic reuse must remain disabled.');
}
if (!(policy?.bannedMedia?.slugPrefixes || []).includes('dtf-edu-')) {
  throw new Error('Visual quality policy no longer quarantines dtf-edu-*; refusing an ambiguous legacy-media state.');
}

throw new Error(
  'deploy-wordpress-infographic-library-rest.mjs is retired: dtf-edu-* media is quarantined. ' +
  'Publish only role-specific reviewed replacements through the dtf-approved-visual-* production path.'
);
