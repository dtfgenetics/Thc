import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripNonRenderedMarkup, duplicateHtmlIds } from './lib/html-audit-markup.mjs';

const html=`<!doctype html>
<html><head><style>.x::after{content:'<h1>style title</h1>'}</style></head>
<body>
<h1>Visible title</h1>
<a href="/visible/">Visible</a>
<script>
const card='<h1>Generated title</h1><a href="/grow-planner/'+w[2]+'">Open</a>';
</script>
<template><h1>Template title</h1><a href="/template-only/">Template</a></template>
</body></html>`;
const rendered=stripNonRenderedMarkup(html);
assert.equal((rendered.match(/<h1\b/gi)||[]).length,1);
assert.match(rendered,/href="\/visible\/"/);
assert.doesNotMatch(rendered,/grow-planner/);
assert.doesNotMatch(rendered,/template-only/);
assert.doesNotMatch(rendered,/style title/);
const visualAudit=await readFile(new URL('./audit-sitewide-visual-integrity.mjs',import.meta.url),'utf8');
assert.match(visualAudit,/const h1=count\(rendered,\/<h1\\b\/gi\);/);

const lessonWithVisual='<main id="THC-ENC-041"><figure data-thc-lesson-visual-id="THC-ENC-041"></figure></main>';
assert.deepEqual(duplicateHtmlIds(lessonWithVisual),[], 'visual data-*-id must not count as a duplicate HTML id');
assert.deepEqual(duplicateHtmlIds('<div id="same"></div><span id="same"></span>'),[{id:'same',count:2}], 'real duplicate ids must still fail');
assert.deepEqual(duplicateHtmlIds('<!-- <div id="same"></div> --><main id="same"></main>'),[], 'commented-out ids are inert');
assert.deepEqual(duplicateHtmlIds('<div data-id="same" id="same"></div><span id="same"></span>'),[{id:'same',count:2}], 'data-id must not hide a real duplicate');
assert.deepEqual(duplicateHtmlIds(stripNonRenderedMarkup('<script><div id="same"></div></script><main id="same"></main>')),[], 'non-rendered scripts must not count');
assert.ok(visualAudit.includes('duplicateHtmlIds(rendered)'), 'sitewide auditor must use the tested ID parser');

console.log('html audit markup tests passed');
