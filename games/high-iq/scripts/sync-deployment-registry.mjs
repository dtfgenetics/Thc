import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const manifestPath = resolve(root, 'games/high-iq/data/manifest.json');
const registryPath = resolve(root, 'site/deployment/public-apps.json');
const checkOnly = process.argv.includes('--check');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const app = registry.apps?.find((entry) => entry.id === 'high-iq');
if (!app) throw new Error('High IQ deployment registry sync could not find app id high-iq');

const expected = {
  version: manifest.datasetVersion,
  questions: manifest.questionCount,
  sources: manifest.sourceCount,
  validator: 'node games/high-iq/scripts/validate-data.mjs',
  publicRuntimeValidator: 'node games/high-iq/scripts/validate-public-runtime.mjs',
  manifestDriven: true
};

const current = app.machineData || {};
const matches = Object.entries(expected).every(([key, value]) => current[key] === value)
  && Object.keys(current).every((key) => key in expected);

if (checkOnly) {
  if (!matches) throw new Error(`High IQ deployment registry is stale; expected v${manifest.datasetVersion} / ${manifest.questionCount} questions / ${manifest.sourceCount} sources.`);
  console.log(`High IQ deployment registry matches v${manifest.datasetVersion}: ${manifest.questionCount} questions / ${manifest.sourceCount} sources.`);
  process.exit(0);
}

if (!matches) {
  app.machineData = expected;
  app.notes = `Self-hosted manifest-driven High IQ runtime. Dataset v${manifest.datasetVersion} currently declares ${manifest.questionCount} Approved/PASS questions and ${manifest.sourceCount} registered sources. The older Base44 build is legacy fallback only.`;
  registry.updated = new Date().toISOString().slice(0, 10);
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

console.log(`High IQ deployment registry synchronized to v${manifest.datasetVersion}: ${manifest.questionCount} questions / ${manifest.sourceCount} sources.`);
