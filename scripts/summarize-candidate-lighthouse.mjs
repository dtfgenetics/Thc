import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const clean = value => String(value ?? '').replace(/[\r\n\x00-\x1f|`<>]/g, ' ').slice(0, 180);

export function summarizeReports(reports) {
  if (!reports.length) throw new Error('No candidate Lighthouse reports found');
  const output = ['## Candidate Lighthouse measurements', '', 'Each row is one run; these diagnostics do not change acceptance thresholds.', ''];
  for (const report of reports) {
    if (report.runtimeError) throw new Error('Candidate Lighthouse runtime error: ' + clean(report.runtimeError.code));
    const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
    if (categories.some(key => !Number.isFinite(report.categories?.[key]?.score))) {
      throw new Error('Candidate Lighthouse report has missing category scores');
    }
    output.push('| Category | Score |', '| --- | --- |');
    for (const key of categories) output.push(`| ${key} | ${Math.round(report.categories[key].score * 100)} |`);
    output.push('', '| Metric | Value |', '| --- | --- |');
    for (const key of ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift']) {
      const audit = report.audits?.[key];
      if (audit) output.push(`| ${clean(key)} | ${clean(audit.displayValue ?? audit.numericValue)} |`);
    }
    output.push('', 'Audits below full score:', '');
    const audits = Object.entries(report.audits ?? {}).filter(([, audit]) => Number.isFinite(audit.score) && audit.score < 1 && !['notApplicable', 'manual', 'informative'].includes(audit.scoreDisplayMode));
    for (const [id, audit] of audits.sort((a, b) => a[1].score - b[1].score).slice(0, 20)) {
      output.push(`- ${clean(id)}: ${clean(audit.title)} (${clean(audit.displayValue ?? audit.score)})`);
    }
    if (!audits.length) output.push('- None.');
    output.push('');
  }
  return output.join('\n') + '\n';
}

export function readReports(directory) {
  const reports = [];
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) reports.push(...readReports(file));
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.lighthouseVersion && data.categories) reports.push(data);
    }
  }
  return reports;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const summary = summarizeReports(readReports(process.argv[2]));
    process.stdout.write(summary);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  } catch (error) {
    console.error('Candidate Lighthouse summary failed: ' + error.message);
    process.exitCode = 1;
  }
}
