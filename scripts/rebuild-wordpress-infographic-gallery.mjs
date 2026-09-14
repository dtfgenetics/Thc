import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

// COMPATIBILITY WRAPPER ONLY.
//
// The former implementation rebuilt /learn/infographics/ from every dtf-edu-*
// attachment it could find. That behavior directly conflicts with the current
// visual-quality quarantine. Keep this filename because several historical
// workflows still reference it, but route every invocation through the approved-
// only, image-less fallback publisher instead of ever selecting legacy media.

const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-visual-rebuild';
const requestedApply = String(process.env.APPLY_INFOGRAPHIC_GALLERY || '').toLowerCase() === 'true';
process.env.APPLY_APPROVED_VISUAL_LIBRARY = requestedApply ? 'true' : 'false';
process.env.BACKUP_ROOT = backupRoot;
process.env.DTF_VISUAL_QUALITY_POLICY = process.env.DTF_VISUAL_QUALITY_POLICY || join(process.cwd(), 'site/wordpress/visual-quality-policy.json');

const policy = JSON.parse(await readFile(process.env.DTF_VISUAL_QUALITY_POLICY, 'utf8'));
if (Number(policy?.schemaVersion || 0) < 3 || policy?.mode !== 'quarantine') throw new Error('Visual quality quarantine policy v3+ is required');
if (policy?.replacementPolicy?.legacyAutomaticInfographicPublishingAllowed !== false) throw new Error('Legacy automatic infographic publishing must remain disabled');
if (policy?.replacementPolicy?.legacyInfographicReuseAllowed !== false) throw new Error('Legacy infographic reuse must remain disabled');
if (policy?.replacementPolicy?.automaticKeywordMediaSelectionAllowed !== false) throw new Error('Automatic keyword media selection must remain disabled');

await import(`${pathToFileURL(join(process.cwd(), 'scripts/publish-wordpress-approved-visual-library.mjs')).href}?compat=${Date.now()}`);

const latestPath = join(backupRoot, 'approved-visual-library-latest.txt');
const safeDir = (await readFile(latestPath, 'utf8')).trim();
if (!safeDir) throw new Error('Approved visual library publisher did not record its backup directory');
const safeReport = JSON.parse(await readFile(join(safeDir, 'approved-visual-library-report.json'), 'utf8'));
if (safeReport.imageCount !== 0 || safeReport.imagePolicy !== 'role-specific-approved-only') {
  throw new Error('Compatibility gallery wrapper received a non-fail-closed visual-library result');
}

const compatibilityReport = {
  generatedAt: new Date().toISOString(),
  apply: requestedApply,
  mediaCount: 0,
  pageId: safeReport.libraryPageId,
  groups: {},
  retiredLegacyGallery: true,
  delegatedPublisher: 'publish-wordpress-approved-visual-library.mjs',
  imagePolicy: safeReport.imagePolicy,
  marker: safeReport.marker,
  backupDir: safeDir,
};
await writeFile(join(safeDir, 'gallery-report.json'), `${JSON.stringify(compatibilityReport, null, 2)}\n`);
await writeFile(join(backupRoot, 'infographic-gallery-backup-path.txt'), `${safeDir}\n`);
console.log(JSON.stringify(compatibilityReport, null, 2));
