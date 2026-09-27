import assert from 'node:assert/strict';
import {
  assertCanonicalHeaderAssets,
  replaceShell,
} from './lib/wordpress-shared-shell-reconcile.mjs';

const original=`
<style id="dtf-commerce-archive-style">.shop{display:grid}</style>
<style id="dtf-content-density-v1-style">old</style>
<script id="dtf-content-density-v1-script">if(open&#038;&#038;headingTitle){}</script>
<script id="dtf-sitewide-visual-repair-v2-script">if(card&#038;&#038;image){}</script>
<header class="legacy">Old header</header>
<p>Seeds &amp; education</p>`;

const replacement=`<!-- wp:html -->
<style id="dtf-content-density-v1-style">new</style>
<header data-dtf-shell="header-v6">Canonical header</header>
<script id="dtf-sitewide-header-v6-script">(()=>{const open=true;if(open&&document.body){}})();</script>
<script id="dtf-content-density-v1-script">(()=>{const open=true;if(open&&document.body){}})();</script>
<script id="dtf-sitewide-visual-repair-v2-script">(()=>{const card=true;if(card&&document.body){}})();</script>
<!-- /wp:html -->`;

const reconciled=replaceShell(original,'header',replacement);
assertCanonicalHeaderAssets(reconciled);
assert.match(reconciled,/dtf-commerce-archive-style/);
assert.match(reconciled,/Seeds &amp; education/);
assert.doesNotMatch(reconciled,/open&#038;&#038;headingTitle/);
assert.equal((reconciled.match(/id="dtf-content-density-v1-script"/g)||[]).length,1);
assert.equal((reconciled.match(/id="dtf-sitewide-visual-repair-v2-script"/g)||[]).length,1);

assert.throws(
  ()=>assertCanonicalHeaderAssets(reconciled.replace('open&&document.body','open&#038;&#038;document.body')),
  /HTML-entity corruption/,
);
assert.throws(
  ()=>assertCanonicalHeaderAssets(`${reconciled}<script id="dtf-sitewide-header-v6-script">true;</script>`),
  /Expected exactly one dtf-sitewide-header-v6-script/,
);

console.log(JSON.stringify({ok:true,scenario:'bare-header-with-corrupted-owned-scripts'}));
