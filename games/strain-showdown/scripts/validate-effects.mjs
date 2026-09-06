import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = path.join(projectRoot, 'data');
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, 'roster-manifest.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(dataRoot, 'effect-profiles.json'), 'utf8'));
const cards = manifest.files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(dataRoot, file), 'utf8')));

const fail = (message) => { throw new Error(`Strain Showdown effect validation failed: ${message}`); };
const titleRole = (roleTag) => String(roleTag || '').split('-').filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
const allowedMechanics = new Set(catalog.mechanicVocabulary || []);

if (catalog.schemaVersion !== 1) fail('unsupported effect schema version');
if (catalog.status !== 'authoring-draft') fail('effect catalog must remain explicitly draft until balance integration is approved');
if (catalog.activeInBrowserRules !== false) fail('draft effects must not silently activate in the browser ruleset');
if (!Array.isArray(catalog.profiles) || catalog.profiles.length !== 24) fail('expected 24 family/stage profiles');
if (cards.length !== 96) fail(`expected 96 canonical cards, found ${cards.length}`);
if (allowedMechanics.size < 8) fail('mechanic vocabulary is incomplete');

const profileIds = new Set();
const profileKeys = new Set();
for (const profile of catalog.profiles) {
  if (!profile?.id || profileIds.has(profile.id)) fail(`duplicate or missing profile id: ${profile?.id}`);
  profileIds.add(profile.id);
  if (!manifest.families.includes(profile.family)) fail(`unknown family on ${profile.id}: ${profile.family}`);
  if (![1, 2, 3].includes(profile.stage)) fail(`invalid stage on ${profile.id}`);
  const key = `${profile.family}:${profile.stage}`;
  if (profileKeys.has(key)) fail(`duplicate family/stage profile: ${key}`);
  profileKeys.add(key);
  if (!profile.trigger || !profile.rulesText) fail(`missing trigger/rules text on ${profile.id}`);
  if (!profile.mechanic?.type || !allowedMechanics.has(profile.mechanic.type)) fail(`unsupported mechanic on ${profile.id}`);
  if (!Number.isInteger(profile.mechanic.value) || profile.mechanic.value < 1 || profile.mechanic.value > 3) fail(`invalid mechanic value on ${profile.id}`);
  if (profile.mechanic.secondaryType && !allowedMechanics.has(profile.mechanic.secondaryType)) fail(`unsupported secondary mechanic on ${profile.id}`);
  if (profile.mechanic.secondaryType && (!Number.isInteger(profile.mechanic.secondaryValue) || profile.mechanic.secondaryValue < 1 || profile.mechanic.secondaryValue > 3)) fail(`invalid secondary value on ${profile.id}`);
}

for (const family of manifest.families) {
  for (const stage of [1, 2, 3]) {
    if (!profileKeys.has(`${family}:${stage}`)) fail(`missing ${family} stage ${stage} profile`);
  }
}

const profileByKey = new Map(catalog.profiles.map((profile) => [`${profile.family}:${profile.stage}`, profile]));
const derived = cards.map((card) => {
  const profile = profileByKey.get(`${card.family}:${card.stage}`);
  if (!profile) fail(`no effect profile for ${card.id}`);
  const abilityName = titleRole(card.roleTag);
  if (!abilityName) fail(`card ${card.id} cannot derive an ability name from roleTag`);
  return {
    cardId: card.id,
    family: card.family,
    stage: card.stage,
    profileId: profile.id,
    abilityName,
    rulesText: profile.rulesText,
    mechanic: profile.mechanic
  };
});

if (derived.length !== 96 || new Set(derived.map((effect) => effect.cardId)).size !== 96) fail('derived effect coverage is not exactly 96 unique cards');
for (const family of manifest.families) {
  const familyEffects = derived.filter((effect) => effect.family === family);
  if (familyEffects.length !== 12) fail(`${family} does not derive exactly 12 card effects`);
}

const preview = derived.slice(0, 3).map((effect) => `${effect.cardId}=${effect.abilityName}: ${effect.rulesText}`).join(' | ');
console.log(`Strain Showdown draft effects validated: ${derived.length} cards / ${catalog.profiles.length} profiles / ${allowedMechanics.size} mechanics.`);
console.log(`Preview: ${preview}`);
