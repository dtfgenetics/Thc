import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { reviewedGeneticsMedia } from './lib/reviewed-genetics-media.mjs';

const { cards } = JSON.parse(readFileSync('site/wordpress/products/strain-card-images.json', 'utf8'));
// Reproduce the education filter: the input may contain no strain-card media.
for (const card of cards) {
  const result = reviewedGeneticsMedia(cards, [], card.wordpressSlug);
  assert.equal(result.source_url, card.sourceUrl);
  assert.equal(result.alt_text, card.altText);
}
const card = cards[0];
const media = [{slug: card.wordpressSlug, source_url: 'https://dtfseeds.com/reviewed.jpg', alt_text: 'wrong generation'}];
assert.equal(reviewedGeneticsMedia(cards, media, card.wordpressSlug).source_url, media[0].source_url);
assert.equal(reviewedGeneticsMedia(cards, media, card.wordpressSlug).alt_text, card.altText);
assert.equal(reviewedGeneticsMedia(cards, [{...media[0],slug:card.wordpressSlug+'-unreviewed'}], card.wordpressSlug).source_url, card.sourceUrl);
assert.throws(() => reviewedGeneticsMedia(cards, media, 'unknown'), /Missing reviewed/);
assert.throws(() => reviewedGeneticsMedia([{...card,sourceUrl:'javascript:bad'}], media, card.wordpressSlug), /Missing reviewed/);
// The normalized publisher runs in /tmp: embedded selection must have no imports.
const embedded = vm.runInNewContext(`(${reviewedGeneticsMedia.toString()})`);
assert.equal(embedded(cards, [], card.wordpressSlug).source_url, card.sourceUrl);
const publisher = readFileSync('scripts/rebuild-wordpress-learning-experience-v3.mjs','utf8');
assert.match(publisher, /if \(slug\.startsWith\('dtf-strain-card-'\)\) return false/);
const wrapper = readFileSync('scripts/run-learning-v3-production.mjs','utf8');
assert.match(wrapper, /mangoRegular: reviewedGeneticsMedia\(reviewedStrainCards, media,/);
assert.doesNotMatch(wrapper, /mangoRegular: chooseMedia\(media, \[\['dtf-strain-card-/);
console.log('Reviewed genetics media: all cards survive education filtering; exact identities and education exclusion preserved.');
