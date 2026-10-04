import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripNonRenderedMarkup } from './lib/html-audit-markup.mjs';

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
console.log('html audit markup tests passed');
