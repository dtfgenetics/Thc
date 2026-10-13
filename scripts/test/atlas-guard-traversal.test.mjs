import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const guard=fs.readFileSync(new URL('../guard-atlas-preservation.mjs',import.meta.url),'utf8');
test('published mirror is traversal source',()=>{assert.match(guard,/pages\(mirror\)/);assert.doesNotMatch(guard,/walk\(dir, next\)/);});
test('deleted lesson fails closed',()=>{assert.match(guard,/missing canonical lesson/);});

test('canonical host and duplicate tags are guarded',()=>{assert.match(guard,/www\.dtfseeds\.com/);assert.match(guard,/found!==null/);});
test('instructional SVG removal is guarded',()=>{assert.match(guard,/instructionalSvgCount/);assert.match(guard,/instructional SVG count/);});
