#!/usr/bin/env node
// Low-cost regression checks for public THC education navigation.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const read = path => readFileSync(resolve(path), 'utf8');
const sectionCss = read('site/public-route-patch/learn/section-v1.css');
const sectionJs = read('site/public-route-patch/learn/section-v1.mjs');
const searchHtml = read('site/public-route-patch/learn/search/index.html');
const landing = read('site/public-route-patch/learn/index.html');

assert.doesNotMatch(sectionCss, /\.nav\s*\{\s*display\s*:\s*none\s*[;}]*/, 'Learning section must retain mobile navigation');
assert.match(sectionCss, /\.nav\{[^}]*overflow-x:auto/, 'Learning section navigation must scroll on mobile');
assert.match(sectionCss, /:focus-visible/, 'Learning section needs focus indication');
assert.doesNotMatch(searchHtml, /\.nav\s*\{\s*display\s*:\s*none\s*[;}]*/, 'Search must retain mobile navigation');
assert.match(searchHtml, /overflow-x:auto/, 'Search mobile navigation must scroll');
assert.match(sectionJs, /cards\.replaceChildren\(/, 'Section cards must be rendered through DOM nodes');
assert.doesNotMatch(sectionJs, /\.innerHTML\s*=/, 'Do not interpolate learning links through innerHTML');
assert.match(sectionJs, /parsed\.origin\s*===\s*window\.location\.origin/, 'Navigation links need same-origin validation');
assert.match(sectionJs, /aria-busy/, 'Section loading status must be accessible');
for (const route of ['/learn/encyclopedia/', '/learn/search/', '/learn/beginner-guides/']) {
  assert.ok(landing.includes('href="' + route + '"'), 'Learning homepage lacks route ' + route);
}
console.log('THC education navigation regression checks passed');
