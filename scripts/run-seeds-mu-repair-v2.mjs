import { readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';

const sourcePath = 'scripts/repair-seeds-mu-override.mjs';
let source = await readFile(sourcePath, 'utf8');

const replacements = new Map([
  ['Open Berry Blue profile', 'Berry Blue'],
  ['Open Berry Lemonade profile', 'Berry Lemonade'],
  ['Open Zestberry profile', 'Zestberry'],
  ['Open Blue Bubblegum profile', 'Blue Bubblegum'],
  ['Open Blue Cali Glue profile', 'Blue Cali Glue'],
  ['Open Blue Mango profile', 'Blue Mango'],
  ['Open Blue Mango BX1 profile', 'Blue Mango BX1'],
  ['Open Mango Bubbles profile', 'Mango Bubbles'],
  ['Open Blue Frequency profile', 'Blue Frequency'],
  ['Open Rainbow Bubblegum profile', 'Rainbow Bubblegum'],
  ['Open Mystery Line profile', 'Mystery Line'],
]);

for (const [oldMarker, canonicalMarker] of replacements) {
  const needle = `'${oldMarker}'`;
  const occurrences = source.split(needle).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one verifier marker ${needle}, found ${occurrences}. Refusing to patch an unexpected repair script.`);
  }
  source = source.replace(needle, `'${canonicalMarker}'`);
}

if (!source.includes("const canonicalSeeds = 'DTF Genetics library';")) {
  throw new Error('Canonical Genetics library guard is missing from the repair script.');
}
if (!source.includes("const staleSeeds = 'DTF Genetics catalog pages built around strain identity and grow context.';")) {
  throw new Error('Stale Seeds guard is missing from the repair script.');
}
if (!source.includes("growNotes: contains(text, 'Grow Notes')")) {
  throw new Error('Grow Notes stale-card guard is missing from the repair script.');
}
if (!source.includes('profileCount !== requiredSeedsMarkers.length')) {
  throw new Error('Eleven-marker completeness gate is missing from the repair script.');
}
if (!source.includes("/dtf-seeds-mu-repair/v1/restore")) {
  throw new Error('Automatic MU rollback endpoint is missing from the repair script.');
}

const patchedPath = join(tmpdir(), `dtf-seeds-mu-repair-v2-${process.pid}-${crypto.randomBytes(6).toString('hex')}.mjs`);
try {
  await writeFile(patchedPath, source, { mode: 0o600 });
  await import(`${pathToFileURL(patchedPath).href}?v=${Date.now()}`);
} finally {
  await unlink(patchedPath).catch(() => {});
}
