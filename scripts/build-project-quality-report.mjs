#!/usr/bin/env node
// Deterministic portfolio roll-up. Never equates user-submitted links with verified evidence.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validate, REQUIRED } from './verify-release-evidence.mjs';

export function summarize(entries) {
  const projects = entries.map(({file, manifest}) => {
    const issues = validate(manifest);
    return {
      file, project: manifest?.project ?? 'unknown', release: manifest?.release ?? 'unknown',
      status: issues.length ? 'not-accepted' : 'evidence-submitted-needs-human-verification',
      gates: Object.fromEntries(REQUIRED.map(k => [k, manifest?.gates?.[k]?.status === 'passed' ? 'claimed-passed' : 'blocked'])),
      blockers: issues
    };
  });
  return {schema:'dtf-project-os-quality@1', projects, totals: {
    projects:projects.length,
    blocked:projects.filter(p=>p.status==='not-accepted').length,
    pendingReview:projects.filter(p=>p.status==='evidence-submitted-needs-human-verification').length,
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
    const report=summarize(entries);
    console.log(JSON.stringify(report,null,2));
    // A structurally valid manifest is not independent release approval.
    if (!acceptedForRelease(report)) process.exitCode=1;
  } catch(err) {console.error(err.message);process.exitCode=2;}
}
