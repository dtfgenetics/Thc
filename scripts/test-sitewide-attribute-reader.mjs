import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getHtmlAttribute } from './lib/html-audit-markup.mjs';

assert.equal(getHtmlAttribute('<a data-href="/decoy/" href="/real/">', 'href'), '/real/');
assert.equal(getHtmlAttribute('<a data-href="/decoy/">', 'href'), null);
assert.equal(getHtmlAttribute('<img data-alt="false" src="/photo.png">', 'alt'), null);
assert.equal(getHtmlAttribute('<img alt="" src="/photo.png">', 'alt'), '');
assert.equal(getHtmlAttribute('<a href=/docs/ rel=noopener>', 'href'), '/docs/');
assert.equal(getHtmlAttribute('<a title="a > b" href="/valid/">', 'href'), '/valid/');
assert.equal(getHtmlAttribute('<IMG ALT="Sample">', 'alt'), 'Sample');
const auditor = await readFile(new URL('./audit-sitewide-visual-integrity.mjs', import.meta.url), 'utf8');
assert.match(auditor, /import \\{[^}]*getHtmlAttribute[^}]*\\} from '\\.\\/lib\\/html-audit-markup\\.mjs'/, 'auditor must import the verified parser');
assert.match(auditor, /const getAttr=getHtmlAttribute;/, 'auditor must use the verified parser');
assert.match(auditor, /getAttr\\(tag,'href'\\)/, 'link extraction must use the verified parser');
assert.match(auditor, /getAttr\\(tag,'alt'\\)/, 'image accessibility audit must use the verified parser');
assert.doesNotMatch(auditor, /function getAttr\\(tag,name\\)/, 'unsafe legacy attribute reader must not return');
console.log('sitewide HTML attribute reader regression tests passed');
