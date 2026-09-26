import fs from 'node:fs';

const path = 'games/grower-conversations/data/prompt-bank-v2.json';
const bank = JSON.parse(fs.readFileSync(path, 'utf8'));

function fail(message) {
  throw new Error(`Grow Room Confessions production bank: ${message}`);
}

const expectedLanes = [
  'confessions',
  'hot_takes',
  'would_you_rather',
  'debates',
  'psychology',
  'call_your_shot',
  'strain_talk',
  'wild_cards'
];

const allowedIntensities = new Set(['chill', 'real', 'deep']);
const allowedTypes = new Set([
  'confession',
  'story-required',
  'hot-take',
  'choose-one',
  'debate',
  'psychology',
  'call-your-shot',
  'strain-talk',
  'table-vote',
  'callout',
  'wild'
]);

if (bank.schemaVersion !== 2) fail('schemaVersion must be 2');
if (bank.cardCount !== 200) fail('cardCount must be 200');
if (bank.visibleCardIds !== false) fail('visibleCardIds must remain false');
if (!Array.isArray(bank.cards) || bank.cards.length !== 200) fail('cards must contain exactly 200 entries');
if (!Array.isArray(bank.lanes) || bank.lanes.length !== 8) fail('lanes must contain exactly eight entries');

const laneIds = bank.lanes.map((lane) => lane.id);
if (JSON.stringify(laneIds) !== JSON.stringify(expectedLanes)) fail('lane order/IDs changed unexpectedly');

const ids = new Set();
const prompts = new Set();

for (const card of bank.cards) {
  if (!card || typeof card !== 'object') fail('every card must be an object');
  if (typeof card.id !== 'string' || !/^grc-[a-z0-9-]+-\d{2}$/.test(card.id)) fail(`invalid internal id ${card.id}`);
  if (ids.has(card.id)) fail(`duplicate id ${card.id}`);
  ids.add(card.id);

  if (!expectedLanes.includes(card.lane)) fail(`unknown lane ${card.lane}`);
  if (!allowedIntensities.has(card.intensity)) fail(`unknown intensity ${card.intensity}`);
  if (!allowedTypes.has(card.cardType)) fail(`unknown cardType ${card.cardType}`);

  if (typeof card.prompt !== 'string') fail(`${card.id} prompt must be text`);
  const prompt = card.prompt.trim();
  if (prompt.length < 35 || prompt.length > 260) fail(`${card.id} prompt length out of bounds`);
  const normalized = prompt.toLowerCase().replace(/\s+/g, ' ');
  if (prompts.has(normalized)) fail(`duplicate prompt text at ${card.id}`);
  prompts.add(normalized);
}

for (const lane of expectedLanes) {
  const cards = bank.cards.filter((card) => card.lane === lane);
  if (cards.length !== 25) fail(`${lane} must contain 25 cards`);
  const intensities = Object.fromEntries(['chill','real','deep'].map((key) => [key, cards.filter((card) => card.intensity === key).length]));
  if (Object.values(intensities).some((count) => count < 7)) fail(`${lane} intensity distribution is too imbalanced`);
}

if (bank.cards.some((card) => /\b(?:card\s*(?:id|number)|serial\s*number)\b/i.test(card.prompt))) {
  fail('prompt copy must not expose internal card identifiers');
}

console.log('Grow Room Confessions production bank validation passed', {
  cards: bank.cards.length,
  lanes: Object.fromEntries(expectedLanes.map((lane) => [lane, bank.cards.filter((card) => card.lane === lane).length])),
  intensity: Object.fromEntries(['chill','real','deep'].map((level) => [level, bank.cards.filter((card) => card.intensity === level).length]))
});
