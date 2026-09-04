import { readdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const checkOnly = process.argv.includes('--check');
const registryUrl = new URL('../site/deployment/public-apps.json', import.meta.url);
const contractsUrl = new URL('../site/deployment/external-games/', import.meta.url);
const registry = JSON.parse(await readFile(registryUrl, 'utf8'));
const names = (await readdir(contractsUrl)).filter(name => name.endsWith('.json')).sort();
const contracts = [];
for (const name of names) contracts.push(JSON.parse(await readFile(new URL(name, contractsUrl), 'utf8')));

const errors = [];
let changed = false;
for (const contract of contracts) {
  const index = registry.apps.findIndex(app => app.id === contract.id);
  if (index < 0) {
    errors.push(`public registry is missing external game id ${contract.id}`);
    continue;
  }
  const current = registry.apps[index];
  if (current.repository !== contract.repository) {
    errors.push(`${contract.id}: registry repository ${current.repository} != contract ${contract.repository}`);
    continue;
  }
  const next = {
    ...current,
    title: contract.title,
    repository: contract.repository,
    route: contract.route,
    runtime: contract.runtime,
    status: contract.status,
    build: contract.build,
    machineData: contract.machineData,
    notes: contract.notes
  };
  if (contract.verifiedRevision) next.verifiedRevision = contract.verifiedRevision;
  for (const stale of ['sourcePath', 'canonicalDataPath', 'appTarget', 'apiTarget']) {
    if (next[stale] === undefined) continue;
    delete next[stale];
  }
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    changed = true;
    registry.apps[index] = next;
  }
}

if (errors.length) {
  console.error('External game registry reconciliation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (checkOnly) {
  if (changed) {
    console.error('Public app registry is stale relative to external game contracts.');
    process.exit(1);
  }
  console.log(`External game registry parity valid: ${contracts.length} contract(s).`);
  process.exit(0);
}

if (!changed) {
  console.log('Public app registry already matches external game contracts.');
  process.exit(0);
}

await writeFile(registryUrl, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Reconciled ${contracts.length} external game contract(s) into public-apps.json.`);
