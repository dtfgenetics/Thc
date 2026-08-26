import { readFile, writeFile } from 'node:fs/promises';

const targets = [
  '.github/workflows/core-gaps-v6-route-repair.yml',
  '.github/workflows/wordpress-harvest-outdoor-v6-production.yml'
];

function addWorkflowRun(source, label) {
  if (source.includes('workflows:\n      - Enhance DTFSeeds Education V4')) return source;
  const needle = '  workflow_dispatch:\n';
  if (!source.includes(needle)) throw new Error(`${label}: workflow_dispatch anchor not found`);
  return source.replace(needle, `${needle}  workflow_run:\n    workflows:\n      - Enhance DTFSeeds Education V4\n    types: [completed]\n`);
}

function guardPublish(source, label) {
  const old = "    if: ${{ github.event_name != 'pull_request' }}";
  const next = "    if: ${{ github.event_name != 'pull_request' && (github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success') }}";
  if (source.includes(next)) return source;
  if (!source.includes(old)) throw new Error(`${label}: publish event guard anchor not found`);
  return source.replace(old, next);
}

const results = [];
for (const path of targets) {
  let source = await readFile(path, 'utf8');
  const before = source;
  source = addWorkflowRun(source, path);
  source = guardPublish(source, path);
  if (source !== before) await writeFile(path, source);
  results.push({ path, changed: source !== before, listensAfterV4: source.includes('workflows:\n      - Enhance DTFSeeds Education V4') });
}

const v3Path = '.github/workflows/wordpress-learning-experience-v3-production.yml';
let v3 = await readFile(v3Path, 'utf8');
const marker = '# Canonical education owner chain: V3 -> V4 -> subject V6 finalizers\n';
if (!v3.includes(marker)) {
  const anchor = 'name: Publish DTFSeeds Learning Experience V3\n\n';
  if (!v3.includes(anchor)) throw new Error('V3 workflow name anchor not found');
  v3 = v3.replace(anchor, `${anchor}${marker}`);
  await writeFile(v3Path, v3);
  results.push({ path: v3Path, changed: true, ownerChainMarker: true });
} else {
  results.push({ path: v3Path, changed: false, ownerChainMarker: true });
}

console.log(JSON.stringify({ repaired: true, results }, null, 2));
