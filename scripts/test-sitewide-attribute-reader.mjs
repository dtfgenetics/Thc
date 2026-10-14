import assert from 'node:assert/strict';
import { getHtmlAttribute } from './lib/html-audit-markup.mjs';

assert.equal(getHtmlAttribute('<a data-href="/decoy/" href="/real/">', 'href'), '/real/');
assert.equal(getHtmlAttribute('<a data-href="/decoy/">', 'href'), null);
assert.equal(getHtmlAttribute('<img data-alt="false" src="/photo.png">', 'alt'), null);
assert.equal(getHtmlAttribute('<img alt="" src="/photo.png">', 'alt'), '');
assert.equal(getHtmlAttribute('<a href=/docs/ rel=noopener>', 'href'), '/docs/');
assert.equal(getHtmlAttribute('<a title="a > b" href="/valid/">', 'href'), '/valid/');
assert.equal(getHtmlAttribute('<IMG ALT="Sample">', 'alt'), 'Sample');
console.log('sitewide HTML attribute reader regression tests passed');
