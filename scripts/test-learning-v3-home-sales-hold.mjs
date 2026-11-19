import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/rebuild-wordpress-learning-experience-v3.mjs', 'utf8');
const start = source.indexOf('function buildHome()');
const end = source.indexOf('function buildLearn(', start);
assert(start >= 0 && end > start, 'Learning V3 homepage renderer boundaries must be present');
const home = source.slice(start, end);

assert.match(home, /Seed sales are temporarily on hold/i, 'The homepage must communicate the sales hold');
assert.match(home, /role="status">Seed sales temporarily on hold/, 'Hold CTA must be visible and non-clickable');
assert.doesNotMatch(home, /btn\(['"]\/(?:shop|cart|checkout|product)\//i, 'Homepage must not render purchasing buttons');
assert.doesNotMatch(home, /href=["']\/(?:shop|cart|checkout|product)\//i, 'Homepage must not render purchasing anchors');
assert.match(home, /btn\('\/seeds\/', 'Read genetics context', true\)/, 'Retain the genetics library CTA');
for (const route of ['/seeds/blue-mango/', '/seeds/blue-bubblegum/']) {
  assert(home.includes("href: '" + route + "'"), 'Breeding cards must link to informational genetics routes: ' + route);
}
assert.match(source, /const homeMarkup = buildHome\(\)/, 'Publisher must build once before checking its HTML');
assert.match(source, /Seed-sales hold: refusing to republish purchasing links/, 'Publisher must reject purchasing links at runtime');
assert.match(source, /Seed-sales hold: refusing to republish a homepage without the visible hold notice/, 'Publisher must require a visible hold notice');
assert.match(source, /await updatePage\(home, homeMarkup,/, 'Publisher must publish exactly the checked homepage HTML');
console.log('Learning V3 Home publisher sales-hold regression test passed.');
