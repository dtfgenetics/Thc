#!/usr/bin/env node
import fs from 'node:fs';

const repositories = JSON.parse(fs.readFileSync('data/repository-registry.json','utf8'));
const contracts = JSON.parse(fs.readFileSync('data/external-agent-contract-registry.json','utf8'));
const errors = [];
const ok = (value, message) => { if (!value) errors.push(message) };

ok(contracts.schemaVersion === 1, 'external agent contract registry must use schemaVersion 1');
ok(contracts.controlRepository === 'dtfgenetics/Thc', 'controlRepository must remain dtfgenetics/Thc');
ok(contracts.contractPath === 'dtf-agent-contract.json', 'contractPath must remain dtf-agent-contract.json');

const entries = new Map();
for (const entry of contracts.repositories || []) {
  ok(typeof entry.repo === 'string' && entry.repo.length > 0, 'every contract entry needs repo');
  ok(['external-executor','migration-only'].includes(entry.mode), 'invalid mode for ' + entry.repo);
  ok(!entries.has(entry.repo), 'duplicate external contract registry entry: ' + entry.repo);
  entries.set(entry.repo, entry);
}

const requiredStatuses = new Set(['canonical','standalone_canonical','migration']);
const expected = (repositories.repositories || [])
  .filter(entry => entry.repo !== contracts.controlRepository && requiredStatuses.has(entry.status));

for (const entry of expected) {
  ok(entries.has(entry.repo), 'missing external agent contract declaration for ' + entry.repo);
  const contract = entries.get(entry.repo);
  if (!contract) continue;
  if (entry.status === 'migration') {
    ok(contract.mode === 'migration-only', 'migration repository must use migration-only mode: ' + entry.repo);
  } else {
    ok(contract.mode === 'external-executor', 'canonical repository must use external-executor mode: ' + entry.repo);
  }
}

for (const repo of entries.keys()) {
  const registered = (repositories.repositories || []).find(entry => entry.repo === repo);
  ok(Boolean(registered), 'external contract registry references unregistered repo ' + repo);
  if (registered) ok(requiredStatuses.has(registered.status), 'contract entry is not active canonical/migration repo: ' + repo);
}

if (errors.length) {
  console.error('External agent contract registry invalid:');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('External agent contract registry valid: ' + entries.size + ' external canonical/migration repositories declared.');
