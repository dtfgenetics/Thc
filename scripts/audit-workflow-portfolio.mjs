#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowsDir = path.join(root, '.github', 'workflows');
const files = fs.existsSync(workflowsDir)
  ? fs.readdirSync(workflowsDir).filter((name) => /\.ya?ml$/i.test(name)).sort()
  : [];

const trigger = (text, name) => new RegExp('(^|\\n)\\s{2,}' + name + '\\s*:', 'm').test(text);
const has = (text, needle) => text.toLowerCase().includes(needle);
const classifyName = (name) => {
  const n = name.toLowerCase();
  if (n.includes('repair')) return 'repair';
  if (n.includes('recover') || n.includes('recovery')) return 'recovery';
  if (n.includes('deploy')) return 'deploy';
  if (n.includes('publish')) return 'publish';
  if (n.includes('audit')) return 'audit';
  if (n.includes('validate') || n.includes('guard')) return 'validation';
  if (n.includes('-ci') || n.endsWith('ci.yml') || n.endsWith('ci.yaml')) return 'ci';
  if (n.includes('sync')) return 'sync';
  if (n.includes('diagnose') || n.includes('diagnostic')) return 'diagnostic';
  if (n.includes('force')) return 'force';
  return 'other';
};

const entries = files.map((file) => {
  const rel = path.posix.join('.github/workflows', file);
  const text = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
  const triggers = {
    workflow_dispatch: /workflow_dispatch\s*:/.test(text),
    repository_dispatch: /repository_dispatch\s*:/.test(text),
    schedule: /schedule\s*:/.test(text),
    pull_request: /pull_request\s*:/.test(text),
    push: trigger(text, 'push'),
    workflow_run: /workflow_run\s*:/.test(text),
    workflow_call: /workflow_call\s*:/.test(text)
  };
  const automatic = triggers.repository_dispatch || triggers.schedule || triggers.pull_request || triggers.push || triggers.workflow_run;
  const manualOnly = triggers.workflow_dispatch && !automatic && !triggers.workflow_call;
  const productionSignals = [
    'environment: production',
    'wp_api_username',
    'wp_site_url',
    'hostinger',
    'git push',
    'ssh_',
    'deployment'
  ];
  const productionWriter = productionSignals.some((token) => has(text, token));
  const category = classifyName(file);
  const historicalCandidate = manualOnly && ['repair','recovery','diagnostic','force','publish','deploy'].includes(category);
  return { file: rel, category, triggers, manualOnly, productionWriter, historicalCandidate };
});

const categories = {};
for (const entry of entries) categories[entry.category] = (categories[entry.category] || 0) + 1;

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  workflowCount: entries.length,
  categories,
  manualOnlyCount: entries.filter((x) => x.manualOnly).length,
  productionWriterCount: entries.filter((x) => x.productionWriter).length,
  historicalCandidateCount: entries.filter((x) => x.historicalCandidate).length,
  historicalCandidates: entries.filter((x) => x.historicalCandidate).map((x) => x.file),
  workflows: entries
};

const writeIndex = process.argv.indexOf('--write');
if (writeIndex >= 0) {
  const target = process.argv[writeIndex + 1] || 'reports/workflow-portfolio.json';
  const out = path.join(root, target);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log('Wrote ' + target);
}

console.log(JSON.stringify({
  workflowCount: report.workflowCount,
  categories: report.categories,
  manualOnlyCount: report.manualOnlyCount,
  productionWriterCount: report.productionWriterCount,
  historicalCandidateCount: report.historicalCandidateCount
}, null, 2));
