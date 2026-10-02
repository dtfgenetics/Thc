#!/usr/bin/env node
import fs from 'node:fs';

const reportPath = 'data/encyclopedia-release-status.json';
const docPath = 'docs/ENCYCLOPEDIA_RELEASE_STATUS.md';
const errors = [];
if (!fs.existsSync(reportPath)) errors.push(`${reportPath} missing`);
if (!fs.existsSync(docPath)) errors.push(`${docPath} missing`);

if (!errors.length) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.schemaVersion !== 'thc-encyclopedia-release-status@1') errors.push('release report schemaVersion mismatch');
  if (report.sourceState?.canonicalManifestEntries !== 420) errors.push('release report must show 420 canonical entries');
  if (report.sourceState?.canonicalParts !== 21) errors.push('release report must show 21 canonical parts');
  if (report.searchState?.encyclopediaIndexLessons !== 420) errors.push('release report must show 420 encyclopedia search rows');
  if (typeof report.deploymentStatus?.visitorFacingVerification !== 'boolean') errors.push('visitor-facing verification must be explicit boolean');
  if (report.deploymentStatus?.visitorFacingVerification === false && report.deploymentStatus?.status !== 'SOURCE_ONLY_NOT_VERIFIED_LIVE') {
    errors.push('unverified release report must not claim live status');
  }
  if (!Array.isArray(report.blockers)) errors.push('release report blockers must be an array');
  if (report.productionReadiness?.productionCandidates === 420 && report.blockers.length) {
    errors.push('release report cannot list blockers when all production gates are complete');
  }
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const marker of ['Source State', 'Readiness', 'Evidence And Visuals', 'Deployment Status', 'Remaining Blockers']) {
    if (!doc.includes(marker)) errors.push(`release status markdown missing ${marker}`);
  }
}

if (errors.length) {
  console.error('Encyclopedia release-status validation failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log('Encyclopedia release-status validation passed.');
