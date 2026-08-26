import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = path.join(root, 'games/bud-or-bluff/data/playtest-v1.json');
const target = path.join(root, 'site/public-route-patch/games/bud-or-bluff/deck.php');

const parsed = JSON.parse(fs.readFileSync(source, 'utf8'));
if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length < 2) {
  throw new Error('Bud or Bluff playtest deck is missing or invalid.');
}

const allowed = new Set(['BUD', 'BLUFF']);
for (const card of parsed.cards) {
  for (const key of ['id', 'name', 'answer', 'difficulty', 'category', 'clue', 'reality', 'source']) {
    if (typeof card[key] !== 'string' || !card[key].trim()) throw new Error(`Card ${card.id || '(unknown)'} is missing ${key}.`);
  }
  if (!allowed.has(card.answer)) throw new Error(`Card ${card.id} has invalid answer ${card.answer}.`);
}

function phpString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

const rows = parsed.cards.map(card => {
  const fields = ['id','name','answer','difficulty','category','clue','reality','source']
    .map(key => `${phpString(key)}=>${phpString(card[key])}`)
    .join(',');
  return `  [${fields}],`;
});

const output = `<?php\ndeclare(strict_types=1);\n// Generated from games/bud-or-bluff/data/playtest-v1.json. Do not edit by hand.\nreturn [\n${rows.join('\n')}\n];\n`;
fs.writeFileSync(target, output);
console.log(`Generated private Bud or Bluff deck: ${parsed.cards.length} cards -> ${path.relative(root, target)}`);
