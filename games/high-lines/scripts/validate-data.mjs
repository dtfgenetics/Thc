import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '../..');
const canonicalDataPath = path.join(projectRoot, 'data/scenes.json');
const publicRoot = path.join(repoRoot, 'site/public-route-patch/games/high-lines');
const publicDataPath = path.join(publicRoot, 'data/scenes.json');
const canonical = JSON.parse(fs.readFileSync(canonicalDataPath, 'utf8'));
const publicCopy = JSON.parse(fs.readFileSync(publicDataPath, 'utf8'));

assert.deepEqual(publicCopy, canonical, 'Public High Lines scene data must exactly match canonical data.');
assert.equal(canonical.schemaVersion, 1);
assert.equal(canonical.palette.length, 8);
assert.equal(canonical.scenes.length, 4);

const paletteIds = canonical.palette.map((color) => color.id);
assert.equal(new Set(paletteIds).size, paletteIds.length, 'Palette ids must be unique.');
for (const color of canonical.palette) {
  assert.match(color.id, /^[a-z][a-z0-9-]*$/);
  assert.ok(color.label?.trim());
  assert.match(color.hex, /^#[0-9A-F]{6}$/i, `${color.id} needs a six-digit hex color.`);
}

const sceneIds = canonical.scenes.map((scene) => scene.id);
assert.equal(new Set(sceneIds).size, sceneIds.length, 'Scene ids must be unique.');

function attributeValues(svg, attribute) {
  const values = [];
  const pattern = new RegExp(`${attribute}="([^"]+)"`, 'g');
  let match;
  while ((match = pattern.exec(svg))) values.push(match[1]);
  return values;
}

for (const scene of canonical.scenes) {
  assert.match(scene.id, /^[a-z][a-z0-9-]*$/);
  assert.ok(scene.title?.trim());
  assert.ok(scene.description?.trim());
  assert.match(scene.asset, /^assets\/[a-z0-9-]+\.svg$/);
  assert.ok(scene.regions.length >= 10, `${scene.id} should have at least ten fillable regions.`);
  assert.equal(new Set(scene.regions).size, scene.regions.length, `${scene.id} region ids must be unique.`);
  assert.equal(scene.hiddenObjects.length, 3, `${scene.id} must contain three hidden objects.`);
  assert.equal(new Set(scene.hiddenObjects.map((item) => item.id)).size, 3, `${scene.id} hidden ids must be unique.`);
  assert.ok(scene.prompts.length >= 3, `${scene.id} should provide at least three creative prompts.`);
  for (const prompt of scene.prompts) assert.ok(prompt.trim().length >= 35, `${scene.id} prompt is too thin.`);

  const canonicalAsset = path.join(projectRoot, scene.asset);
  const publicAsset = path.join(publicRoot, scene.asset);
  assert.ok(fs.existsSync(canonicalAsset), `Missing canonical SVG: ${scene.asset}`);
  assert.ok(fs.existsSync(publicAsset), `Missing public SVG: ${scene.asset}`);
  const canonicalSvg = fs.readFileSync(canonicalAsset, 'utf8');
  const publicSvg = fs.readFileSync(publicAsset, 'utf8');
  assert.equal(publicSvg, canonicalSvg, `Public SVG drifted from canonical source: ${scene.asset}`);

  assert.match(canonicalSvg, /^<svg[\s\S]*viewBox="0 0 1000 700"/);
  assert.match(canonicalSvg, /<title[^>]*>/);
  assert.match(canonicalSvg, /<desc[^>]*>/);
  assert.ok(!/<script\b/i.test(canonicalSvg), `${scene.asset} must not contain script tags.`);
  assert.ok(!/<foreignObject\b/i.test(canonicalSvg), `${scene.asset} must not contain foreignObject.`);
  assert.ok(!/(?:href|xlink:href)="https?:/i.test(canonicalSvg), `${scene.asset} must not load external resources.`);

  const regionIds = attributeValues(canonicalSvg, 'data-region');
  const hiddenIds = attributeValues(canonicalSvg, 'data-hidden');
  assert.deepEqual([...regionIds].sort(), [...scene.regions].sort(), `${scene.id} SVG region ids must match scene data exactly.`);
  assert.deepEqual([...hiddenIds].sort(), scene.hiddenObjects.map((item) => item.id).sort(), `${scene.id} SVG hidden ids must match scene data exactly.`);
}

console.log('High Lines scene data and SVG validation passed.');
