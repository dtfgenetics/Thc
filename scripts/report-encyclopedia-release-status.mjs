#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const readJson = (rel, fallback = null) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const writeText = (rel, value) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
};
const arr = (value) => Array.isArray(value) ? value : [];
const stableGeneratedAt = (rel) => {
  if (process.env.ENCYCLOPEDIA_BUILD_TIMESTAMP) return process.env.ENCYCLOPEDIA_BUILD_TIMESTAMP;
  const previous = readJson(rel, null);
  return previous?.generatedAt ?? 'source-controlled';
};
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const manifest = readJson('content/encyclopedia/canonical-420-manifest.json', { entries: [], parts: [], redirects: [] });
const scorecard = readJson('data/encyclopedia-completion-scorecard.json', { lessons: [], parts: [], readinessCounts: {} });
const evidence = readJson('data/encyclopedia-evidence-tracking.json', { summary: {} });
const visualQueue = readJson('content/encyclopedia/visual-production-queue-v1.json', { summary: {} });
const discovery = readJson('site/public-route-patch/learn/encyclopedia/encyclopedia-index.json', { lessons: [], topics: [], publicationCutoff: 0 });
const educationSearch = readJson('site/public-route-patch/learn/search/search-index.json', { documents: [] });
const productionBatch = readJson('site/wordpress/education/encyclopedia/current-production-batch.json', {});

const productionCandidates = arr(scorecard.lessons).filter((row) => row.readiness === 'production-candidate').length;
const publishedDiscoveryRows = arr(discovery.lessons).filter((row) => row.status === 'published').length;
const missingGateCounts = {};
for (const row of arr(scorecard.lessons)) {
  for (const missing of arr(row.missing)) {
    missingGateCounts[missing] = (missingGateCounts[missing] ?? 0) + 1;
  }
}

const blockers = [];
if (productionCandidates < 420) blockers.push(`${420 - productionCandidates} core entries are not production-candidate in the completion scorecard.`);
if ((evidence.summary?.withoutClaimEvidence ?? 0) > 0) blockers.push(`${evidence.summary.withoutClaimEvidence} entries still need claim-level evidence mapping.`);
if ((visualQueue.summary?.approvedAssets ?? 0) < 420) blockers.push(`${420 - (visualQueue.summary?.approvedAssets ?? 0)} entries still need approved teaching visual assets.`);
if (publishedDiscoveryRows < 420) blockers.push(`Public discovery marks ${publishedDiscoveryRows}/420 entries as published; the rest remain catalogued-review.`);
if (productionBatch.publicationAuthorized !== true) blockers.push('Current production batch is not explicitly publicationAuthorized=true.');

const report = {
  schemaVersion: 'thc-encyclopedia-release-status@1',
  generatedBy: 'scripts/report-encyclopedia-release-status.mjs',
  generatedAt: stableGeneratedAt('data/encyclopedia-release-status.json'),
  repository: {
    branch: git('branch', '--show-current'),
    head: git('rev-parse', 'HEAD'),
    dirty: Boolean(git('status', '--short'))
  },
  sourceState: {
    canonicalManifestEntries: arr(manifest.entries).length,
    canonicalParts: arr(manifest.parts).length,
    redirectCandidates: arr(manifest.redirects).length,
    expansionEntries: arr(manifest.expansionEntries).length,
    identityContract: manifest.identityContract
  },
  searchState: {
    encyclopediaIndexLessons: arr(discovery.lessons).length,
    encyclopediaIndexTopics: arr(discovery.topics).length,
    publishedDiscoveryRows,
    publicationCutoff: discovery.publicationCutoff ?? 0,
    educationSearchDocuments: arr(educationSearch.documents).length
  },
  productionReadiness: {
    averageScore: scorecard.averageScore ?? null,
    readinessCounts: scorecard.readinessCounts ?? {},
    productionCandidates,
    missingGateCounts
  },
  evidenceState: evidence.summary ?? {},
  visualState: visualQueue.summary ?? {},
  currentProductionBatch: {
    batch: productionBatch.batch ?? null,
    status: productionBatch.status ?? null,
    publicationAuthorized: productionBatch.publicationAuthorized ?? null,
    validationGate: productionBatch.validationGate ?? null,
    lessonFiles: arr(productionBatch.lessonFiles).length
  },
  deploymentStatus: {
    sourceUpdated: true,
    productionWriteAttemptedByThisReport: false,
    visitorFacingVerification: false,
    status: 'SOURCE_ONLY_NOT_VERIFIED_LIVE',
    rule: 'Do not treat source, build, CI, or WordPress write success as live. Only visitor-facing route verification can set this to live.'
  },
  blockers
};

writeText('data/encyclopedia-release-status.json', `${JSON.stringify(report, null, 2)}\n`);

const md = `# THC Encyclopedia Release Status

Generated: ${report.generatedAt}

## Source State

- Canonical core entries: ${report.sourceState.canonicalManifestEntries}/420
- Parts: ${report.sourceState.canonicalParts}/21
- Redirect candidates: ${report.sourceState.redirectCandidates}
- Expansion entries: ${report.sourceState.expansionEntries}

## Readiness

- Average score: ${report.productionReadiness.averageScore}/100
- Production candidates: ${report.productionReadiness.productionCandidates}/420
- Readiness counts: ${Object.entries(report.productionReadiness.readinessCounts).map(([key, value]) => `${key}=${value}`).join(', ')}

## Evidence And Visuals

- Claim evidence mapped: ${report.evidenceState.withClaimEvidence ?? 0}/420
- Claim evidence pending: ${report.evidenceState.withoutClaimEvidence ?? 0}
- Approved teaching visuals: ${report.visualState.approvedAssets ?? 0}/420
- Visual briefs ready: ${report.visualState.briefsReady ?? 0}/420

## Search And Publication

- Encyclopedia search rows: ${report.searchState.encyclopediaIndexLessons}/420
- Published discovery rows: ${report.searchState.publishedDiscoveryRows}/420
- Education search documents: ${report.searchState.educationSearchDocuments}
- Current production batch: ${report.currentProductionBatch.batch ?? 'unknown'} (${report.currentProductionBatch.status ?? 'unknown'})

## Deployment Status

${report.deploymentStatus.status}

No live deployment or visitor-facing verification was performed by this report.

## Remaining Blockers

${report.blockers.map((blocker) => `- ${blocker}`).join('\n')}
`;

writeText('docs/ENCYCLOPEDIA_RELEASE_STATUS.md', md);
console.log(`Encyclopedia release status: ${report.productionReadiness.productionCandidates}/420 production candidates; ${report.deploymentStatus.status}.`);
