import assert from 'node:assert/strict';
import {stripNonRenderedMarkup,duplicateHtmlIds} from './lib/html-audit-markup.mjs';

const rendered=stripNonRenderedMarkup('<!-- <h1>Old title</h1> --><h1>Current title</h1>');
assert.equal((rendered.match(/<h1\b/gi)||[]).length,1,'comments must not create extra headings');
const links=stripNonRenderedMarkup('<!-- <a href="/obsolete/">Old</a> --><a href="/current/">Current</a>');
assert.doesNotMatch(links,/obsolete/,'comments must not create crawl targets');
assert.match(links,/current/);
const images=stripNonRenderedMarkup('<!-- <img src="/obsolete.png"> --><img src="/current.png" alt="Current">');
assert.doesNotMatch(images,/obsolete.png/,'comments must not create image findings');
const ids=stripNonRenderedMarkup('<!-- <div id="hidden"></div> --><div id="real"></div><span id="real"></span>');
assert.deepEqual(duplicateHtmlIds(ids),[{id:'real',count:2}],'genuine duplicate IDs must remain detectable');
console.log('HTML comment regression tests passed');
