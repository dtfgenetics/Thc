import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = '.agents/skills/dtf-game-development/SKILL.md';
assert.ok(fs.existsSync(path), 'dtf-game-development skill must exist');
const skill = fs.readFileSync(path, 'utf8');

for (const required of [
  'data/game-registry-v2.json',
  'aliasMap',
  'canonical game ID',
  'production.repository',
  'production.sourcePaths',
  'gameDesignDoc',
  'developmentLocations',
  'deprecatedLocations',
  'release.status',
  'public-verified',
  'Game Studio',
  'Burn Buds',
  'Seed Ascent',
  'Terpocalypse',
  'Autonomous playtest contract',
  'structured game state',
  'legal actions',
  '__SEED_MAN_AGENT__',
  '__SEED_MAN_GAME_STATE__',
  'must not teleport the player'
]) {
  assert.ok(skill.includes(required), `skill missing required contract marker: ${required}`);
}

assert.match(skill, /Use when/i);
assert.match(skill, /before implementation/i);
assert.match(skill, /update.*registry/i);
console.log('dtf-game-development skill contract passed');
