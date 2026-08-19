import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'roster-manifest.json'), 'utf8'));
const cards = manifest.files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')));
const expectedFamilies = ['kush','haze','skunk','gas','cookies','fruit','purple','frost'];
const expectedTierCounts = { 1: 6, 2: 4, 3: 2 };

function fail(message) { throw new Error(`Strain Showdown roster: ${message}`); }
function mean(group, key) { return group.reduce((sum, card) => sum + card[key], 0) / group.length; }

if (manifest.schemaVersion !== 1) fail('schemaVersion must be 1');
if (manifest.rosterVersion !== '0.1.0') fail('unexpected roster version');
if (cards.length !== manifest.cardCount || cards.length !== 96) fail('exactly 96 cards are required');
if (new Set(cards.map((card) => card.id)).size !== 96) fail('card IDs must be unique');
if (new Set(cards.map((card) => card.name.toLowerCase())).size !== 96) fail('card names must be unique');
if (JSON.stringify(manifest.families) !== JSON.stringify(expectedFamilies)) fail('family order or membership changed unexpectedly');

for (const card of cards) {
  if (!/^ss-[a-z]+-\d{2}$/.test(card.id)) fail(`invalid id ${card.id}`);
  if (!expectedFamilies.includes(card.family)) fail(`unknown family on ${card.id}`);
  if (![1,2,3].includes(card.tier) || card.stage !== card.tier) fail(`tier/stage mismatch on ${card.id}`);
  if (!Number.isInteger(card.vigor) || card.vigor < 1 || card.vigor > 10) fail(`invalid Vigor on ${card.id}`);
  if (!Number.isInteger(card.power) || card.power < 1 || card.power > 10) fail(`invalid Power on ${card.id}`);
  if (!card.roleTag || typeof card.roleTag !== 'string') fail(`missing role tag on ${card.id}`);
}

const familyStats = {};
for (const family of expectedFamilies) {
  const familyCards = cards.filter((card) => card.family === family);
  if (familyCards.length !== 12) fail(`${family} must contain 12 cards`);
  for (const [tier, count] of Object.entries(expectedTierCounts)) {
    if (familyCards.filter((card) => card.tier === Number(tier)).length !== count) fail(`${family} tier ${tier} must contain ${count} cards`);
  }
  const tierMeans = {};
  for (const tier of [1,2,3]) {
    const subset = familyCards.filter((card) => card.tier === tier);
    tierMeans[tier] = mean(subset, 'vigor') + mean(subset, 'power');
  }
  if (!(tierMeans[1] < tierMeans[2] && tierMeans[2] < tierMeans[3])) fail(`${family} combined stats must rise by tier`);
  familyStats[family] = { vigor: mean(familyCards, 'vigor'), power: mean(familyCards, 'power') };
}

if (familyStats.kush.vigor - familyStats.kush.power < 2) fail('Kush must retain high-vigor identity');
if (familyStats.gas.power - familyStats.gas.vigor < 2) fail('Gas must retain high-power identity');
if (familyStats.purple.vigor - familyStats.purple.power < 2) fail('Purple must retain defensive identity');
if (familyStats.haze.power <= familyStats.haze.vigor) fail('Haze must keep a slight power bias');
if (familyStats.frost.vigor <= familyStats.frost.power) fail('Frost must keep a protection/vigor bias');
if (Math.abs(familyStats.cookies.vigor - familyStats.cookies.power) > 1.5) fail('Cookies should remain flexible/balanced');
if (Math.abs(familyStats.fruit.vigor - familyStats.fruit.power) > 1.5) fail('Fruit should remain broadly balanced');

const dtfCards = cards.filter((card) => card.nameSource === 'DTF Genetics catalog');
const dtfNames = dtfCards.map((card) => card.name).sort();
const expectedDtf = ['Blue Bubblegum','Blue Mango','Blueberry Butcher','Mango Bubbles'].sort();
if (JSON.stringify(dtfNames) !== JSON.stringify(expectedDtf)) fail('DTF Genetics roster names changed unexpectedly');
if (!dtfCards.every((card) => card.family === 'fruit')) fail('current DTF Genetics roster cards must remain in Fruit family until intentionally redesigned');

const geneticsPath = path.resolve(root, '..', '..', '..', 'data', 'genetics', 'catalog.json');
if (!fs.existsSync(geneticsPath)) fail('DTF Genetics catalog is required for roster cross-check');
const genetics = JSON.parse(fs.readFileSync(geneticsPath, 'utf8'));
const catalogNames = new Set(genetics.lines.map((line) => line.name));
for (const name of dtfNames) if (!catalogNames.has(name)) fail(`DTF roster name missing from genetics catalog: ${name}`);

console.log('Strain Showdown roster validation passed', { cards: cards.length, familyStats });
