import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..', '..');
const dataRoot = path.join(projectRoot, 'data');
const publicRoot = path.join(repoRoot, 'site', 'public-route-patch', 'games', 'strain-showdown');

export function buildBrowserBundle() {
  const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, 'roster-manifest.json'), 'utf8'));
  const families = JSON.parse(fs.readFileSync(path.join(dataRoot, 'families.json'), 'utf8'));
  const cards = manifest.files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(dataRoot, file), 'utf8')));

  if (manifest.cardCount !== 96 || cards.length !== manifest.cardCount) {
    throw new Error(`Expected ${manifest.cardCount} canonical Strain Showdown cards, found ${cards.length}.`);
  }
  if (!Array.isArray(families) || families.length !== manifest.families.length) {
    throw new Error('Canonical Strain Showdown family data is incomplete.');
  }

  const familyIds = new Set(families.map((family) => family.id));
  for (const familyId of manifest.families) {
    if (!familyIds.has(familyId)) throw new Error(`Missing canonical family metadata: ${familyId}`);
    const familyCards = cards.filter((card) => card.family === familyId);
    if (familyCards.length !== 12) throw new Error(`Expected 12 ${familyId} cards, found ${familyCards.length}.`);
  }

  const bundle = {
    schemaVersion: 1,
    rosterVersion: manifest.rosterVersion,
    cardCount: manifest.cardCount,
    familyCount: manifest.families.length,
    families,
    cards
  };

  const target = path.join(publicRoot, 'data', 'browser-bundle.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(bundle)}\n`);
  return { target, bundle };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { target, bundle } = buildBrowserBundle();
  console.log(`Built Strain Showdown browser bundle: ${bundle.cards.length} cards / ${bundle.families.length} families -> ${path.relative(repoRoot, target)}`);
}
