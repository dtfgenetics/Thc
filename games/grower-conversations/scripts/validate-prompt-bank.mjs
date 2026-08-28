import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(gameRoot, 'data');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'prompt-bank.json'), 'utf8'));
const categoryFile = JSON.parse(fs.readFileSync(path.join(root, 'categories.json'), 'utf8'));
const categories = categoryFile.map((category) => category.id);
const runtimePath = path.resolve(gameRoot, '..', '..', 'site', 'public-route-patch', 'games', 'grower-conversations', 'app.js');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const expectedBands = [
  { depth: 'easy', start: 1, end: 4 },
  { depth: 'reflective', start: 5, end: 8 },
  { depth: 'technical', start: 9, end: 12 }
];

function fail(message) { throw new Error(`Grower Conversations prompt bank: ${message}`); }

if (bank.schemaVersion !== 1 || bank.version !== '1.0.0') fail('unexpected schema/version');
if (bank.cardCount !== 96) fail('cardCount must be 96');
if (JSON.stringify(bank.depthBands) !== JSON.stringify(expectedBands)) fail('depth bands changed unexpectedly');
if (JSON.stringify(Object.keys(bank.categories)) !== JSON.stringify(categories)) fail('prompt categories must match categories.json in order');

const materialized = [];
for (const category of categories) {
  const prompts = bank.categories[category];
  if (!Array.isArray(prompts) || prompts.length !== 12) fail(`${category} must contain 12 prompts`);
  prompts.forEach((prompt, index) => {
    if (typeof prompt !== 'string' || prompt.length < 30 || prompt.length > 220) fail(`invalid prompt length ${category} #${index + 1}`);
    if (!prompt.endsWith('?')) fail(`prompt must be a question ${category} #${index + 1}`);
    const depth = index < 4 ? 'easy' : index < 8 ? 'reflective' : 'technical';
    materialized.push({ id: `gc-${category}-${String(index + 1).padStart(2, '0')}`, category, depth, prompt });
  });
}

if (materialized.length !== 96) fail('materialized prompt total must be 96');
if (new Set(materialized.map((card) => card.id)).size !== 96) fail('IDs must be unique');
if (new Set(materialized.map((card) => card.prompt.toLowerCase())).size !== 96) fail('prompts must be unique');

for (const category of categories) {
  const cards = materialized.filter((card) => card.category === category);
  for (const depth of ['easy', 'reflective', 'technical']) {
    if (cards.filter((card) => card.depth === depth).length !== 4) fail(`${category}/${depth} must contain four prompts`);
  }
}

const stems = materialized.map((card) => card.prompt.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).slice(0, 5).join(' '));
if (new Set(stems).size < 88) fail('too many prompts begin with near-identical wording');

const filtered = materialized.filter((card) => card.category === 'genetics' && card.depth === 'technical');
const usedFixture = new Set([
  filtered[0].id,
  filtered[1].id,
  materialized.find((card) => card.category === 'community' && card.depth === 'easy').id,
  materialized.find((card) => card.category === 'future' && card.depth === 'reflective').id
]);
const available = filtered.filter((card) => !usedFixture.has(card.id));
if (filtered.length !== 4 || available.length !== 2 || filtered.length - available.length !== 2) {
  fail('filtered progress fixture must count only used cards inside the active view');
}

const runtimeContracts = [
  ['active-filter matcher', 'function matchesActiveFilters(card)'],
  ['filtered used count', 'const usedMatching = filtered.length - available.length;'],
  ['filter/current synchronization', 'function syncCurrentToFilters()'],
  ['stale current clearing', 'if (current && !matchesActiveFilters(current)) current = null;'],
  ['category change sync', "ui.category.addEventListener('change', syncCurrentToFilters);"],
  ['depth change sync', "ui.depth.addEventListener('change', syncCurrentToFilters);"]
];
for (const [label, source] of runtimeContracts) {
  if (!runtimeSource.includes(source)) fail(`browser runtime missing ${label}`);
}

console.log('Grower Conversations prompt bank validation passed', {
  cards: materialized.length,
  categories: categories.length,
  depthCounts: Object.fromEntries(['easy','reflective','technical'].map((depth) => [depth, materialized.filter((card) => card.depth === depth).length])),
  filterProgressFixture: { matching: filtered.length, unused: available.length, usedMatching: filtered.length - available.length }
});
