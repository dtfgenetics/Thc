#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./publish-wordpress-encyclopedia-canonical-batch.mjs',import.meta.url),'utf8');
const line=source.split('\n').find(line=>line.startsWith('const paired=a=>'));
assert.ok(line,'Misconception renderer exists');
const paired=vm.runInNewContext(line.replace(/^const paired=/,'(').replace(/;$/,'')+')', {
  esc: value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
});
const html=paired([['Plants never need oxygen','Roots need oxygen'],['<unsafe>', '']]);
assert.match(html,/<p><strong>Misconception:<\/strong> Plants never need oxygen<\/p>/);
assert.match(html,/<p><strong>Correction:<\/strong> Roots need oxygen<\/p>/);
assert.doesNotMatch(html,/<br\s*\/?\s*>/i);
assert.match(html, /&lt;unsafe&gt;/);
assert.equal((html.match(/<article>/g)||[]).length,2);
console.log('Encyclopedia misconception renderer: semantic, escaped, and paired checks passed');
