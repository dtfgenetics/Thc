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
// Run the real normalization without credentials; import stops at its guard.
const { spawnSync } = await import('node:child_process');
const { mkdtempSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const temp = mkdtempSync(join(tmpdir(), 'dtf-eager-image-'));
try {
  const normalized = join(temp, 'publisher.mjs');
  const run = spawnSync(process.execPath, ['scripts/run-learning-v3-production.mjs'], {
    encoding: 'utf8', env: {...process.env, WP_API_USERNAME:'', WP_API_PASSWORD:'',
      NORMALIZED_TOPIC_LITERATURE_PATH:join(temp,'topics.json'), NORMALIZED_LEARNING_V3_PUBLISHER_PATH:normalized}
  });
  assert.notEqual(run.status, 0, 'credential guard must prevent publication');
  const source = readFileSync(normalized,'utf8');
  const renderer = source.match(/function img\(item, alt,[\s\S]*?\n\}/)?.[0];
  assert.ok(renderer, 'normalized image renderer must exist');
  const render = vm.runInNewContext(`(${renderer})`, {esc:String, imageUrl:x=>x.source_url, imageAlt:(_,alt)=>alt});
  const eager = render({source_url:'https://example.com/hero.jpg'},'Hero',{eager:true});
  assert.match(eager, /loading="eager" fetchpriority="high" data-no-lazy="1"/);
  const lazy = render({source_url:'https://example.com/card.jpg'},'Card');
  assert.match(lazy, /loading="lazy"/);
  assert.doesNotMatch(lazy, /data-no-lazy/);
} finally { rmSync(temp,{recursive:true,force:true}); }
assert.match(wrapper, /mangoRegular: reviewedGeneticsMedia\(reviewedStrainCards, media,/);
assert.doesNotMatch(wrapper, /mangoRegular: chooseMedia\(media, \[\['dtf-strain-card-/);
const finalOwner = readFileSync('.github/workflows/wordpress-home-release-visuals.yml','utf8');
const learningOwner = readFileSync('.github/workflows/wordpress-learning-experience-v3-production.yml','utf8');
const headerCheckImports = [...learningOwner.matchAll(/import \{ SITEWIDE_HEADER_MARKER \} from '([^']+)'/g)].map(x=>x[1]);
assert.deepEqual(headerCheckImports, Array(2).fill('./scripts/lib/sitewide-header-template-v6.mjs'), 'both live shell checks must follow the V6 publisher');
const shellPublisher = readFileSync('scripts/rebuild-wordpress-shared-shell-v3.mjs','utf8');
assert.match(shellPublisher, /from '\.\/lib\/sitewide-header-template-v6\.mjs'/);
assert.match(finalOwner, /node scripts\/verify-home-release-artwork\.mjs/);
const finalVerifier = readFileSync('scripts/verify-home-release-artwork.mjs','utf8');
assert.match(finalVerifier, /Current releases, shown with the real strain cards\./);
assert.match(wrapper, /publisher = publisher\.replace\('Current genetics stay simple and direct\.', releaseHeading\)/);
console.log('Reviewed genetics media: all cards survive education filtering; exact identities and education exclusion preserved.');
