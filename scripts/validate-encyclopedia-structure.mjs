import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ENC = path.join(ROOT, 'content', 'encyclopedia');
const strict420 = process.argv.includes('--strict-420');
const errors = [];
const warnings = [];

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const encId = n => `THC-ENC-${String(n).padStart(3, '0')}`;
const volId = n => `THC-ENC-V${String(n).padStart(2, '0')}`;

const parts = await readJson(path.join(ENC, 'parts.json'));
const catalog = await readJson(path.join(ENC, 'catalog.json'));

if (!Array.isArray(parts.parts) || parts.parts.length !== 21) {
  errors.push(`parts.json must define exactly 21 parts; found ${parts.parts?.length ?? 0}`);
}

for (let i = 0; i < (parts.parts || []).length; i++) {
  const part = parts.parts[i];
  const expectedPart = i + 1;
  const expectedStart = (expectedPart - 1) * 20 + 1;
  const expectedEnd = expectedStart + 19;
  if (part.part !== expectedPart) errors.push(`Part index ${expectedPart} has part=${part.part}`);
  if (part.startId !== encId(expectedStart) || part.endId !== encId(expectedEnd)) {
    errors.push(`Part ${expectedPart} must span ${encId(expectedStart)}-${encId(expectedEnd)}; found ${part.startId}-${part.endId}`);
  }
}

const catalogNumbers = new Set();
for (const entry of catalog.volumes || []) {
  if (catalogNumbers.has(entry.number)) errors.push(`Duplicate catalog volume number ${entry.number}`);
  catalogNumbers.add(entry.number);
  if (entry.id !== volId(entry.number)) errors.push(`Catalog volume ${entry.number} id mismatch: ${entry.id}`);
  const manifestPath = path.join(ROOT, entry.path);
  if (!(await exists(manifestPath))) {
    errors.push(`Catalog volume ${entry.number} points to missing manifest ${entry.path}`);
    continue;
  }
  const manifest = await readJson(manifestPath);
  if (manifest.number !== entry.number) errors.push(`Catalog/manifest number mismatch for volume ${entry.number}`);
  if (manifest.title !== entry.title) errors.push(`Catalog/manifest title mismatch for volume ${entry.number}`);
  if (manifest.volumeId && manifest.volumeId !== entry.id) errors.push(`Catalog/manifest id mismatch for volume ${entry.number}`);
  if (manifest.catalogRegistration === 'withheld_until_review_gate') {
    errors.push(`Blocked volume ${entry.number} is cataloged despite catalogRegistration=withheld_until_review_gate`);
  }
}

const dirNames = await readdir(ENC, { withFileTypes: true });
const sourceVolumes = dirNames
  .filter(d => d.isDirectory() && /^volume-\d{2}$/.test(d.name))
  .map(d => Number(d.name.slice(-2)))
  .sort((a,b) => a-b);

for (const n of sourceVolumes) {
  const manifestPath = path.join(ENC, `volume-${String(n).padStart(2,'0')}`, 'manifest.json');
  if (!(await exists(manifestPath))) {
    errors.push(`Volume ${n} directory has no manifest.json`);
    continue;
  }
  const manifest = await readJson(manifestPath);
  if (manifest.number !== n) errors.push(`Volume directory ${n} manifest reports number ${manifest.number}`);

  const range = manifest.controlledLessonRange || manifest.controlledRange;
  const titles = manifest.controlledTitles;
  const lessonPaths = manifest.lessonPaths;

  if (manifest.controlledLessonRange && Array.isArray(titles)) {
    const start = Number(manifest.controlledLessonRange.start);
    const end = Number(manifest.controlledLessonRange.end);
    const expectedCount = end - start + 1;
    if (titles.length !== expectedCount) errors.push(`Volume ${n} has ${titles.length}/${expectedCount} controlled titles`);
    for (let id = start; id <= end; id++) {
      const expected = encId(id);
      if (!titles.some(t => t.id === expected)) errors.push(`Volume ${n} missing controlled title ${expected}`);
    }
    if (Array.isArray(lessonPaths)) {
      if (lessonPaths.length !== expectedCount) errors.push(`Volume ${n} has ${lessonPaths.length}/${expectedCount} lesson paths`);
      for (const rel of lessonPaths) {
        const file = path.join(ENC, `volume-${String(n).padStart(2,'0')}`, rel);
        if (!(await exists(file))) errors.push(`Volume ${n} lesson path missing on disk: ${rel}`);
      }
    }
  }

  if (range?.lessonCount && Array.isArray(manifest.draftLessonCollections) && !manifest.draftLessonCollections.length) {
    errors.push(`Volume ${n} declares ${range.lessonCount} draft lessons but no draft lesson collections`);
  }

  const shouldCatalog = manifest.catalogRegistration !== 'withheld_until_review_gate';
  if (shouldCatalog && !catalogNumbers.has(n)) {
    errors.push(`Publication-oriented volume ${n} is missing from catalog.json`);
  }
}

let expectedCatalogCount = 0;
for (const n of sourceVolumes) {
  const manifestPath = path.join(ENC, `volume-${String(n).padStart(2,'0')}`, 'manifest.json');
  if (!(await exists(manifestPath))) continue;
  const manifest = await readJson(manifestPath);
  if (manifest.catalogRegistration !== 'withheld_until_review_gate') expectedCatalogCount++;
}
if (catalogNumbers.size !== expectedCatalogCount) {
  errors.push(`catalog.json has ${catalogNumbers.size} entries but ${expectedCatalogCount} source volumes are publishable`);
}

const missingSourceVolumes = [];
for (let n = 1; n <= 21; n++) if (!sourceVolumes.includes(n)) missingSourceVolumes.push(n);
if (missingSourceVolumes.length) {
  const msg = `420-entry architecture still lacks source volume directories: ${missingSourceVolumes.join(', ')}`;
  if (strict420) errors.push(msg); else warnings.push(msg);
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  console.error(`Encyclopedia structure validation failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Encyclopedia structure PASS: ${parts.parts.length} master parts, ${sourceVolumes.length} source volumes, ${catalog.volumes.length} cataloged volumes.`);
