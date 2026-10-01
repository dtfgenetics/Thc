#!/usr/bin/env node
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('data/external-agent-contract-registry.json','utf8'));
const errors = [];
const results = [];

async function fetchContract(entry) {
  if (entry.remoteAudit === 'controller-only') {
    return {
      repo: entry.repo,
      ok: true,
      mode: entry.mode,
      remoteAudit: 'controller-only',
      skipped: true,
      reason: 'private-repository-controller-verification-required',
      violations: [],
    };
  }
  const [owner, repo] = String(entry.repo || '').split('/');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${registry.contractPath}`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'user-agent': 'dtf-external-agent-contract-audit/1.0',
        accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    return { repo: entry.repo, ok: false, reason: 'network-error', detail: error.message };
  }

  if (!response.ok) {
    return { repo: entry.repo, ok: false, reason: 'http-error', detail: String(response.status) };
  }

  let contract;
  try {
    contract = JSON.parse(await response.text());
  } catch (error) {
    return { repo: entry.repo, ok: false, reason: 'invalid-json', detail: error.message };
  }

  const violations = [];
  if (contract.schemaVersion !== 1) violations.push('schemaVersion must be 1');
  if (contract.repository !== entry.repo) violations.push('repository field mismatch');
  if (contract.controlRepository !== registry.controlRepository) violations.push('controlRepository mismatch');
  if (contract.defaultBranch !== 'main') violations.push('defaultBranch must be main');
  if (!Array.isArray(contract.canonicalDomains) || contract.canonicalDomains.length === 0) violations.push('canonicalDomains missing');
  if (!Array.isArray(contract.sourceRoots) || contract.sourceRoots.length === 0) violations.push('sourceRoots missing');
  if (!contract.verificationProfiles || typeof contract.verificationProfiles !== 'object' || Object.keys(contract.verificationProfiles).length === 0) violations.push('verificationProfiles missing');
  if (!contract.production || typeof contract.production !== 'object') violations.push('production contract missing');
  if (entry.mode === 'migration-only' && contract.production?.directMutation !== false) violations.push('migration-only repo must disable direct production mutation');

  return {
    repo: entry.repo,
    ok: violations.length === 0,
    mode: entry.mode,
    remoteAudit: entry.remoteAudit || 'public',
    violations,
  };
}

for (const entry of registry.repositories || []) {
  const result = await fetchContract(entry);
  results.push(result);
  if (!result.ok) errors.push(result);
}

const report = {
  ok: errors.length === 0,
  checkedAt: new Date().toISOString(),
  controlRepository: registry.controlRepository,
  contractPath: registry.contractPath,
  checked: results.length,
  failures: errors.length,
  controllerOnly: results.filter(result => result.remoteAudit === 'controller-only').length,
  results,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
