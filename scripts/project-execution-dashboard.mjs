#!/usr/bin/env node
import fs from 'node:fs';

const execution = JSON.parse(fs.readFileSync('data/project-execution-registry.json', 'utf8'));
const projects = JSON.parse(fs.readFileSync('data/project-registry.json', 'utf8'));
const repositories = JSON.parse(fs.readFileSync('data/repository-registry.json', 'utf8'));
const externalContracts = JSON.parse(fs.readFileSync('data/external-agent-contract-registry.json', 'utf8'));

const externalContractByRepo = new Map((externalContracts.repositories || []).map(entry => [entry.repo, entry]));
const repositoryByName = new Map((repositories.repositories || []).map(entry => [entry.repo, entry]));

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

function nextActionHint(projectStatus, repositoryStatus) {
  if (repositoryStatus === 'archive_ready') return 'Archive repository while preserving Git history.';
  if (repositoryStatus === 'migration') return 'Finish unique-value extraction, verify downstream ownership, then move toward archive-ready.';
  if (repositoryStatus === 'legacy_review') return 'Reconcile unique code/data and assign or retire ownership before new feature work.';
  if (projectStatus === 'canonical-preproduction') return 'Finish pinned release packaging, production publication, and live-route verification.';
  if (['browser-prototype', 'browser-vertical-slice', 'browser-deck-alpha', 'implementation-alpha', 'prototype'].includes(projectStatus)) {
    return 'Complete the product contract, deterministic QA, release package, and live verification before adding scope.';
  }
  if (projectStatus === 'placeholder') return 'Either implement a bounded minimum product or retire the placeholder from public planning.';
  if (projectStatus === 'merge-candidate') return 'Reconcile against the canonical owner and integrate only unique verified improvements.';
  if (projectStatus === 'archive-candidate') return 'Verify no unique canonical value remains, then archive rather than delete.';
  if (projectStatus === 'archive-ready') return 'Archive while preserving history.';
  return 'Close the highest-priority open blocker, verify the release artifact, and prove visitor-facing production state.';
}

const rows = (projects.projects || []).map(project => {
  const resolved = resolveExecution(project);
  const entry = resolved.entry;
  const repository = repositoryByName.get(project.repo) || null;
  let contract = null;
  if (project.repo === externalContracts.controlRepository) {
    contract = { mode: 'local', path: null };
  } else if (project.repo && externalContractByRepo.has(project.repo)) {
    contract = externalContractByRepo.get(project.repo);
  } else if (repository?.status === 'archive_ready') {
    contract = { mode: 'archive-only', path: null };
  } else if (!project.repo && project.status === 'drive-only') {
    contract = { mode: 'drive-only', path: null };
  }
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    canonicalRepo: project.repo,
    repositoryStatus: repository?.status || 'unregistered',
    repositoryDomain: repository?.domain || null,
    executionContract: entry.id,
    routeSource: resolved.source,
    validationCommand: entry.validationCommand,
    focusedValidationCommand: entry.focusedValidationCommand || null,
    buildCommand: entry.buildCommand || null,
    integrationRepo: entry.integration?.repo || null,
    integrationMode: entry.integration?.mode || null,
    agentExecutionMode: contract?.mode || 'undeclared',
    agentContractPath: contract ? (contract.path || externalContracts.contractPath || 'dtf-agent-contract.json') : null,
    branchPattern: 'work/' + project.id + '/<task>/<session-id>',
    nextActionHint: nextActionHint(project.status, repository?.status || 'unregistered')
  };
});

const repoCounts = {};
for (const row of rows) repoCounts[row.canonicalRepo] = (repoCounts[row.canonicalRepo] || 0) + 1;

const archiveReadyRepos = (repositories.repositories || []).filter(repo => repo.status === 'archive_ready').map(repo => repo.repo).sort();
const migrationRepos = (repositories.repositories || []).filter(repo => repo.status === 'migration').map(repo => repo.repo).sort();
const legacyReviewRepos = (repositories.repositories || []).filter(repo => repo.status === 'legacy_review').map(repo => repo.repo).sort();
const fallbackProjects = rows.filter(row => row.routeSource === 'registry-fallback').map(row => row.id);
const preproductionProjects = rows.filter(row => row.status === 'canonical-preproduction').map(row => row.id);
const prototypeProjects = rows.filter(row => ['browser-prototype', 'browser-vertical-slice', 'browser-deck-alpha', 'implementation-alpha', 'prototype'].includes(row.status)).map(row => row.id);

const summary = {
  generatedFrom: {
    projectRegistryUpdated: projects.updated || null,
    executionRegistryUpdated: execution.updated || null,
    repositoryRegistryUpdated: repositories.updated || null
  },
  totals: {
    registeredProjects: rows.length,
    explicitExecutionDomains: (execution.projects || []).length,
    registeredRepositories: (repositories.repositories || []).length,
    canonicalRepos: Object.keys(repoCounts).length,
    fallbackRoutedProjects: fallbackProjects.length,
    archiveReadyRepositories: archiveReadyRepos.length,
    migrationRepositories: migrationRepos.length,
    legacyReviewRepositories: legacyReviewRepos.length,
    preproductionProjects: preproductionProjects.length,
    prototypeStageProjects: prototypeProjects.length
  },
  completionQueues: {
    archiveReadyRepos,
    migrationRepos,
    legacyReviewRepos,
    fallbackProjects,
    preproductionProjects,
    prototypeProjects
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
console.log('registered repositories:', summary.totals.registeredRepositories);
console.log('canonical repos:', summary.totals.canonicalRepos);
console.log('registry fallback routes:', summary.totals.fallbackRoutedProjects);
console.log('archive-ready repositories:', summary.totals.archiveReadyRepositories);
console.log('migration repositories:', summary.totals.migrationRepositories);
console.log('preproduction projects:', summary.totals.preproductionProjects);
console.log('prototype-stage projects:', summary.totals.prototypeStageProjects);
console.log('');
for (const row of rows) {
  console.log([
    row.id,
    row.status,
    row.canonicalRepo,
    row.repositoryStatus,
    row.executionContract,
    row.routeSource,
    row.integrationMode || 'no-integration-mode',
    row.agentExecutionMode
  ].join(' | '));
  console.log('  next:', row.nextActionHint);
}
