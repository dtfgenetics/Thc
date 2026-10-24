import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyHomeReleaseArtwork } from './verify-home-release-artwork.mjs';

const {cards} = JSON.parse(readFileSync('site/wordpress/products/strain-card-images.json','utf8'));
const article = card => `<article class="release"><img class="dtf-img dtf-release-card-image" src="https://example.com/card.jpg" alt="${card.altText}" style="aspect-ratio:2/3;object-fit:contain"><a href="/product/${card.productSlug}/">Open</a></article>`;
const section = `<section><h2>Current releases, shown with the real strain cards.</h2><div class="release-grid">${cards.map(article).join('')}</div></section>`;
// Reproduce live CSS text preceding the actual section and ending at header copy.
const decoy = `<style>.shop:before{content:'Current releases'}.brand:after{content:'Teaching Healthy Cultivation'}</style><header>Teaching Healthy Cultivation</header>`;
const html = decoy + section + '<section>Teaching Healthy Cultivation</section>';
assert.ok(verifyHomeReleaseArtwork(html,cards).ok);
assert.equal(verifyHomeReleaseArtwork(decoy,cards).ok,false);
for (const wrapper of [s=>`<!--${s}-->`,s=>`<script>${JSON.stringify(s)}</script>`,s=>`<template>${s}</template>`]) {
  assert.equal(verifyHomeReleaseArtwork(wrapper(section),cards).ok,false);
}
for (const broken of [
  html.replace(article(cards[0]),''),
  html.replace(cards[0].altText,'Unreviewed card'),
  html.replace('aspect-ratio:2/3','aspect-ratio:1/1'),
  html.replace('Current releases, shown with the real strain cards.','Old heading'),
  html.replaceAll('class="dtf-img','data-class="dtf-img'),
  html.replaceAll('href="/product/','data-href="/product/'),
  html + section
]) assert.equal(verifyHomeReleaseArtwork(broken,cards).ok,false);
const workflow = readFileSync('.github/workflows/wordpress-home-release-visuals.yml','utf8');
assert.ok(workflow.includes('node scripts/verify-home-release-artwork.mjs "$body" "$attempt"'));
assert.ok(!workflow.includes("html.indexOf('Current releases')"));
console.log('Home release artwork: rendered section survives CSS decoys; missing, wrong and ambiguous artwork fails closed.');
