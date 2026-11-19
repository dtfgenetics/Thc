import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve('site/wordpress/pages/home.html'), 'utf8');
const purchaseLinks = [...html.matchAll(/<a\\b[^>]*\\bhref\\s*=\\s*["']\\/(?:shop|product|cart|checkout)\\/[^"']*["']/gi)];
assert.equal(purchaseLinks.length, 0, 'Homepage must not link directly to purchasing routes while seed sales are on hold');
assert.match(html, /Seed sales temporarily on hold/i, 'Homepage must explicitly communicate the sales hold');
assert.match(html, /href="\\/seeds\\/"/, 'Genetics library must remain accessible');

const geneticsLinks = [...html.matchAll(/href="\\/seeds\\/"[^>]*>Explore genetics/g)];
assert.equal(geneticsLinks.length, 3, 'All three strain-card CTAs must lead to informational genetics');
console.log('Homepage sales-hold contract passed: no purchasing CTAs, three genetics links, visible hold notice.');
