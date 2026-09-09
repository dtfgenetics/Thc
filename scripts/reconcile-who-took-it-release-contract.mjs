import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const registryPath = path.resolve('site/deployment/public-apps.json');
const checkOnly = process.argv.includes('--check');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const app = registry.apps?.find((entry) => entry.id === 'who-took-it');

if (!app) {
  console.error('Who Took It deployment registry entry is missing.');
  process.exit(1);
}

const expected = {
  repository: 'dtfgenetics/Thc-guess-who',
  sourcePath: '03_digital-game',
  route: '/games/who-took-it/',
  runtime: 'static',
  status: 'ready-to-package',
  build: 'npm run check',
  machineData: {
    modes: ['solo', 'shared', 'duel'],
    suspects: 25,
    missingItems: 5,
    artRegistry: 'src/data/suspect-art.json',
    portraitCount: 25,
    artStatus: 'production-art-pending',
    artValidator: 'node scripts/validate-art-registry.mjs',
    fullValidation: 'npm run check',
    playwright: false
  },
  notes: 'Canonical standalone React/Vite build from dtfgenetics/Thc-guess-who/03_digital-game. Full packaging gate is npm run check, which includes game-data and 25-character art-registry validation, deterministic smoke/balance checks, dependency audit, production build, and mystery-privacy verification. Procedural suspect heads remain explicitly ART PENDING until approved portrait files land through the canonical suspect-art registry.'
};

const before = JSON.stringify(app);
Object.assign(app, expected);
const after = JSON.stringify(app);

if (checkOnly) {
  if (before !== after) {
    console.error('Who Took It deployment registry is stale. Run node scripts/reconcile-who-took-it-release-contract.mjs');
    process.exit(1);
  }
  console.log('Who Took It deployment registry contract is current.');
  process.exit(0);
}

if (before === after) {
  console.log('Who Took It deployment registry already matches the canonical release contract.');
  process.exit(0);
}

registry.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log('Reconciled Who Took It deployment registry to the full release/art contract.');
