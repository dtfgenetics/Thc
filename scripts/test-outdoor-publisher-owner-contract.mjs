import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const atlas=await readFile('scripts/publish-wordpress-outdoor-visuals-v6.mjs','utf8');
const chapters=await readFile('scripts/publish-wordpress-outdoor-chapter-visuals-v1.mjs','utf8');

for(const [name,source] of [['atlas',atlas],['chapter visuals',chapters]]){
  assert.match(source,/wordpress-learning-page-query\.mjs/,`${name} must use the shared canonical page-query helper`);
  assert.match(source,/pageBySlug\('learn'\)/,`${name} must resolve the canonical Learning root`);
  assert.match(source,/pageBySlug\('outdoor',learnPage\.id\)/,`${name} must scope Outdoor to the canonical Learning parent`);
  assert.doesNotMatch(source,/pages\?slug=\$\{encodeURIComponent\(slug\)\}/,`${name} must not restore a site-wide slug query`);
}
assert.ok((atlas.match(/data-dtf-learning-v4=/g)||[]).length>=3,'atlas must require the V4 owner marker before write, after write, and on the visitor surface');
console.log('Outdoor publisher ownership contract tests passed.');
