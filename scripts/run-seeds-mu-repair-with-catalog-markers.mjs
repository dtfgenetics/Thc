import { readFile, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import process from 'node:process';

const catalogPath = process.env.SEED_LINE_CATALOG || 'site/wordpress/products/seed-line-catalog.json';
const repairPath = 'scripts/repair-seeds-mu-override.mjs';

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog?.lines) || catalog.lines.length !== 11) {
  throw new Error(`Expected the canonical genetics catalog to contain exactly 11 lines; found ${Array.isArray(catalog?.lines) ? catalog.lines.length : 'invalid catalog'}.`);
}

const routeMarkers = catalog.lines.map((line) => {
  if (!line?.slug || !/^[a-z0-9-]+$/.test(String(line.slug))) {
    throw new Error(`Invalid genetics line slug in canonical catalog: ${line?.slug || 'missing'}`);
  }
  return `/seeds/${line.slug}/`;
});
if (new Set(routeMarkers).size !== routeMarkers.length) {
  throw new Error('Canonical genetics catalog contains duplicate profile routes.');
}

const source = await readFile(repairPath, 'utf8');
const markerBlockPattern = /const requiredSeedsMarkers = \[[\s\S]*?\n\];/;
const match = source.match(markerBlockPattern);
if (!match) throw new Error('Could not locate requiredSeedsMarkers in the reviewed MU repair script.');
if (!match[0].includes('Open Berry Blue profile') || !match[0].includes('Open Mystery Line profile')) {
  throw new Error('Reviewed MU repair marker block changed unexpectedly; refusing runtime patch.');
}

const replacement = `const requiredSeedsMarkers = ${JSON.stringify(routeMarkers, null, 2)};`;
const patched = source.replace(markerBlockPattern, replacement);
if (patched === source) throw new Error('MU repair verifier marker replacement did not change the script.');
for (const route of routeMarkers) {
  if (!patched.includes(`'${route}'`) && !patched.includes(`\"${route}\"`)) {
    throw new Error(`Patched MU repair script is missing canonical route marker ${route}.`);
  }
}

const tempPath = join(process.env.RUNNER_TEMP || '/tmp', `dtf-seeds-mu-repair-${process.env.GITHUB_RUN_ID || Date.now()}-${process.pid}.mjs`);
await writeFile(tempPath, patched, { mode: 0o600 });
try {
  await import(`${pathToFileURL(tempPath).href}?run=${encodeURIComponent(process.env.GITHUB_RUN_ID || Date.now())}`);
} finally {
  await rm(tempPath, { force: true });
}
