#!/usr/bin/env node
// Deterministic portfolio roll-up. Never equates user-submitted links with verified evidence.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validate, REQUIRED } from './verify-release-evidence.mjs';
import { createHash } from 'node:crypto';

export const fingerprint = manifest => createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
export function reviewRecordValid(manifest, review) {
  if (!review || review.project !== manifest.project || review.release !== manifest.release) return false;
  if (review.manifestSha256 !== fingerprint(manifest)) return false;
  if (review.decision !== 'approved' || typeof review.reviewer !== 'string' || !review.reviewer.trim()) return false;
  if (typeof review.reviewUrl !== 'string' || !/^https:\/\/github\.com\/dtfgenetics\/Thc\/pull\/\d+(?:\/.*)?$/.test(review.reviewUrl)) return false;
  if (typeof review.reviewedAt !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T.*(?:Z|[+-]\\d{2}:\\d{2})$/.test(review.reviewedAt)) return false;
  const reviewedAt = Date.parse(review.reviewedAt);
  if (!Number.isFinite(reviewedAt) || reviewedAt > Date.now()) return false;
  return true;
}


export function summarize(entries, reviews = []) {
  const projects = entries.map(({file, manifest}) => {
    const issues = validate(manifest);
    const matching = reviews.filter(review => reviewRecordValid(manifest,review));
    const hasReview = matching.length > 0;
    return {
      file, project: manifest?.project ?? 'unknown', release: manifest?.release ?? 'unknown',
      status: issues.length ? 'not-accepted' : hasReview ? 'review-recorded-provenance-unverified' : 'evidence-submitted-needs-human-verification',
      review: hasReview ? {reviewer:matching[0].reviewer,reviewUrl:matching[0].reviewUrl,manifestSha256:fingerprint(manifest)} : null,
      gates: Object.fromEntries(REQUIRED.map(k => [k, manifest?.gates?.[k]?.status === 'passed' ? 'claimed-passed' : 'blocked'])),
      blockers: issues
    };
  });
  return {schema:'dtf-project-os-quality@1', projects, totals: {
    projects:projects.length,
    blocked:projects.filter(p=>p.status==='not-accepted').length,
    pendingReview:projects.filter(p=>p.status==='evidence-submitted-needs-human-verification').length,
    reviewRecorded:projects.filter(p=>p.status==='review-recorded-provenance-unverified').length,
    independentlyVerified:0
  }};
}

export const acceptedForRelease = report => report.totals.projects > 0 && report.totals.blocked === 0 && report.totals.pendingReview === 0 && report.totals.independentlyVerified === report.totals.projects;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) {console.error('Usage: node scripts/build-project-quality-report.mjs <manifest-directory>');process.exit(2);}
  try {
    const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort();
    const entries=files.map(f=>({file:f,manifest:JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))}));
    const reviewDir=process.argv[3];
    const reviews=reviewDir ? fs.readdirSync(reviewDir).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(fs.readFileSync(path.join(reviewDir,f),'utf8'))) : [];
    const report=summarize(entries,reviews);
    console.log(JSON.stringify(report,null,2));
    // A structurally valid manifest is not independent release approval.
    if (!acceptedForRelease(report)) process.exitCode=1;
  } catch(err) {console.error(err.message);process.exitCode=2;}
}
