import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const GAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.json'), 'utf8'));
const DIRECTION = fs.readFileSync(path.resolve(ROOT, '../../docs/SEED_MAN_GAME_DIRECTION.md'), 'utf8');

// Deterministic contract QA: protect progression/game-feel requirements without
// introducing browser automation into DTF game validation.
test('Seed Man keeps the production campaign scope explicit', () => {
  const features = new Set(GAME.features ?? []);
  assert.ok(features.has('twenty-level-campaign'), 'game.json must retain the 20-level campaign contract');
  assert.ok(features.has('twenty-authored-level-recipes'), 'all 20 levels must remain authored rather than generated placeholders');
  assert.ok(features.has('five-approved-visual-world-contracts'), 'the five worlds must retain distinct visual contracts');
});

test('production direction protects progression readability', () => {
  for (const requirement of [
    'current level', 'current world', 'collectible progress',
    'phenotype state and remaining time', 'boss state', 'checkpoint state',
    'whether the finish is available', 'campaign completion', 'optional completion goals',
  ]) assert.ok(DIRECTION.includes(requirement), `missing progression requirement: ${requirement}`);
});

test('production direction protects responsive movement and game feel', () => {
  for (const mechanic of [
    'acceleration and deceleration', 'double jump', 'coyote time', 'jump buffering',
    'variable jump height', 'strong landing feedback', 'moving-platform attachment',
    'spring / bounce surfaces', 'slippery ice', 'wind zones',
  ]) assert.ok(DIRECTION.includes(mechanic), `missing movement/game-feel requirement: ${mechanic}`);
});

test('every world is required to differ beyond a background swap', () => {
  for (const layer of [
    'foreground tiles', 'background', 'midground layers', 'environmental props',
    'ambience', 'hazards', 'traversal mechanics', 'enemy mix', 'particles',
    'lighting treatment', 'audio palette', 'boss arena identity',
  ]) assert.ok(DIRECTION.includes(layer), `missing world differentiation requirement: ${layer}`);
  assert.ok(DIRECTION.includes('A new world cannot simply be the same platforms with a different background color.'));
});

test('all phenotype forms retain a complete core animation contract', () => {
  for (const form of ['Plant', 'Fire', 'Electric', 'Ice']) {
    const row = DIRECTION.split('\n').find((line) => line.startsWith(`| ${form} |`));
    assert.ok(row, `missing animation matrix row for ${form}`);
    assert.equal((row.match(/Required/g) ?? []).length, 9, `${form} must require all nine core animation states`);
  }
});
