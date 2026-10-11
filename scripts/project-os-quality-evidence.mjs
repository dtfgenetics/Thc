import fs from 'node:fs';
import path from 'node:path';

export const CATEGORIES = Object.freeze(['source','build','responsive','content','security','production']);
const SHA = /^[a-f0-9]{40}$/i;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export function evaluateEvidence(projects, apps, evidence, {now = new Date().toISOString()} = {}) {
  const errors = [];
  const seen = new Set();
  const records = new Map();
  const projectById = new Map();
  for (const project of projects) {
    if (!nonempty(project?.id) || projectById.has(project.id)) errors.push('Invalid or duplicate project id: ' + String(project?.id));
    else projectById.set(project.id, project);
  }
  for (const entry of evidence) {
    if (!nonempty(entry?.appId) || seen.has(entry.appId)) {
      errors.push('Invalid or duplicate evidence appId: ' + String(entry?.appId));
      continue;
    }
    seen.add(entry.appId);
    records.set(entry.appId, entry);
  }
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error('Invalid evaluation timestamp');
  const results = [];
  const appIds = new Set();
  for (const app of apps) {
    if (!nonempty(app?.id) || appIds.has(app.id)) {
      errors.push('Invalid or duplicate app id: ' + String(app?.id));
      continue;
    }
    appIds.add(app.id);
    const doc = records.get(app.id);
    const categories = {};
    for (const category of CATEGORIES) {
      const proof = doc?.categories?.[category];
      let reason = 'missing evidence';
      if (proof?.status === 'pass') {
        const time = Date.parse(proof.verifiedAt);
        if (!nonempty(proof.url) || !/^https:\/\//.test(proof.url)) reason = 'missing HTTPS evidence URL';
        else if (!SHA.test(proof.commitSha ?? '')) reason = 'missing immutable commit SHA';
        else if (!Number.isFinite(time) || time > nowMs) reason = 'invalid or future verification time';
        else if (nowMs - time > 30 * 86400000) reason = 'evidence older than 30 days';
        else if (!nonempty(doc.repository) || doc.repository !== app.repository) reason = 'repository mismatch';
        else if (!nonempty(doc.commitSha) || doc.commitSha !== proof.commitSha) reason = 'commit mismatch';
        else reason = null;
      } else if (proof?.status === 'fail') reason = 'reported failure';
      else if (proof && proof.status !== 'unknown') reason = 'invalid evidence status';
      categories[category] = {status: reason === null ? 'pass' : proof?.status === 'fail' ? 'fail' : 'unknown', reason};
    }
    const owner = projectById.get(app.id);
    const ownerMatch = owner ? owner.repo === app.repository : null;
    if (ownerMatch === false) errors.push('Repository ownership disagreement: ' + app.id);
    results.push({
      appId: app.id, route: app.route ?? null, repository: app.repository ?? null,
      projectRegistered: Boolean(owner), ownerMatch,
      ready: CATEGORIES.every(category => categories[category].status === 'pass') && ownerMatch === true,
      categories
    });
  }
  for (const id of records.keys()) if (!appIds.has(id)) errors.push('Evidence references unknown application: ' + id);
  return {
    schemaVersion: 1, evaluatedAt: now, requiredCategories: CATEGORIES,
    totalApps: results.length, readyApps: results.filter(row => row.ready).length,
    errors, results
  };
}

export function generateReport(root, {now} = {}) {
  const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  const projects = read('data/project-registry.json').projects;
  const apps = read('site/deployment/public-apps.json').apps;
  const file = path.join(root, 'data/project-os-quality-evidence.json');
  const evidence = fs.existsSync(file) ? read('data/project-os-quality-evidence.json').applications : [];
  if (!Array.isArray(evidence)) throw new TypeError('Quality evidence applications must be an array');
  return evaluateEvidence(projects, apps, evidence, {now});
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const report = generateReport(process.cwd());
  const destination = process.env.PROJECT_OS_EVIDENCE_REPORT || '.artifacts/project-os/quality-evidence.json';
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({totalApps: report.totalApps, readyApps: report.readyApps, errors: report.errors}, null, 2));
  if (report.errors.length || (process.argv.includes('--enforce') && report.readyApps !== report.totalApps)) process.exitCode = 1;
}
