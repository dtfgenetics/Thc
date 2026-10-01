#!/usr/bin/env node
import fs from 'node:fs';

const execution = JSON.parse(fs.readFileSync('data/project-execution-registry.json', 'utf8'));
const projects = JSON.parse(fs.readFileSync('data/project-registry.json', 'utf8'));
const externalContracts = JSON.parse(fs.readFileSync('data/external-agent-contract-registry.json', 'utf8'));
const externalContractByRepo = new Map((externalContracts.repositories || []).map(entry => [entry.repo, entry]));

const execById = new Map();
const execByAlias = new Map();
for (const entry of execution.projects || []) {
  execById.set(entry.id, entry);
  for (const alias of entry.aliases || []) execByAlias.set(alias, entry);
}

function resolveExecution(project) {
  const id = String(project.id || '').toLowerCase();
  if (execById.has(id)) return { source: 'direct', entry: execById.get(id) };

  if (id === 'dtf-platform') return { source: 'alias-map', entry: execById.get('platform') };
  if (id === 'plant-diagnostic') return { source: 'alias-map', entry: execById.get('grow-doc') };
  if (id === 'thc-academy-certification') return { source: 'alias-map', entry: execById.get('academy') };
  if (id === 'thc-plant-science') return { source: 'alias-map', entry: execById.get('encyclopedia') };

  const byAlias = execByAlias.get(id);
  if (byAlias) return { source: 'alias', entry: byAlias };

  if (project.repo === 'dtfgenetics/Thc') {
    return {
      source: 'registry-fallback',
      entry: {
        id,
        canonicalRepo: project.repo,
        validationCommand: 'npm run project:check && npm run games:preflight',
        integration: { repo: 'dtfgenetics/Thc', mode: 'canonical-or-monorepo-release' }
      }
    };
  }

  return {
    source: 'registry-fallback',
    entry: {
      id,
      canonicalRepo: project.repo,
      validationCommand: 'Use the canonical repository CI/tests before integration.',
      integration: { repo: 'dtfgenetics/Thc', mode: 'registered-external-project-handoff' }
    }
  };
}

const rows = (projects.projects || []).map(project => {
  const resolved = resolveExecution(project);
  const entry = resolved.entry;
  const contract = project.repo === externalContracts.controlRepository
    ? { mode: 'local', path: null }
    : externalContractByRepo.get(project.repo) || null;
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    canonicalRepo: project.repo,
    executionContract: entry.id,
    routeSource: resolved.source,
    validationCommand: entry.validationCommand,
    integrationRepo: entry.integration?.repo || null,
    integrationMode: entry.integration?.mode || null,
    agentExecutionMode: contract?.mode || 'undeclared',
    agentContractPath: contract ? (contract.path || externalContracts.contractPath || 'dtf-agent-contract.json') : null,
    branchPattern: 'work/' + project.id + '/<task>/<session-id>'
  };
});

const repoCounts = {};
for (const row of rows) repoCounts[row.canonicalRepo] = (repoCounts[row.canonicalRepo] || 0) + 1;

const summary = {
  generatedFrom: {
    projectRegistryUpdated: projects.updated || null,
    executionRegistryUpdated: execution.updated || null
  },
  totals: {
    registeredProjects: rows.length,
    explicitExecutionDomains: (execution.projects || []).length,
    canonicalRepos: Object.keys(repoCounts).length,
    fallbackRoutedProjects: rows.filter(r => r.routeSource === 'registry-fallback').length
  },
  repoCounts,
  projects: rows
};

const arg = String(process.argv[2] || '').trim();
if (arg === '--json') {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  process.exit(0);
}

console.log('DTF project execution dashboard');
console.log('registered projects:', summary.totals.registeredProjects);
console.log('explicit execution domains:', summary.totals.explicitExecutionDomains);
console.log('canonical repos:', summary.totals.canonicalRepos);
console.log('registry fallback routes:', summary.totals.fallbackRoutedProjects);
console.log('');
for (const row of rows) {
  console.log([
    row.id,
    row.status,
    row.canonicalRepo,
    row.executionContract,
    row.routeSource,
    row.integrationMode || 'no-integration-mode',
    row.agentExecutionMode
  ].join(' | '));
}
