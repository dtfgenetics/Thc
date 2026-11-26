import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('site/wordpress/templates/archive-product-sales-hold.html','utf8');
const legacy=fs.readFileSync('scripts/polish-wordpress-shop-storefront-v5.mjs','utf8');
const page=fs.readFileSync('site/wordpress/pages/shop.html','utf8');

test('Shop archive retains premium breeding cards and required block landmarks',()=>{
 assert.match(html,/<!-- wp:template-part \{"slug":"header"/);
 assert.match(html,/<!-- wp:template-part \{"slug":"footer"/);
 assert.match(html,/<!-- wp:html -->/);
 assert.match(html,/<!-- \/wp:html -->/);
 assert.match(html,/<h1 id="dtf-shop-v5-title">Seed sales on hold\. Explore the genetics\.<\/h1>/);
 assert.equal((html.match(/data-dtf-shop-storefront-v5="true"/g)||[]).length,1);
 assert.equal((html.match(/data-review-file=/g)||[]).length,4);
 assert.match(html,/\/seeds\/blue-mango\//);
 assert.match(html,/\/seeds\/blue-bubblegum\//);
});

test('Shop archive contains a prominent hold notice and no transaction links',()=>{
 assert.match(html,/Seed sales are temporarily on hold/);
 assert.match(html,/Purchasing is unavailable/);
 assert.doesNotMatch(html,/href=["']\/product\//i);
 assert.doesNotMatch(html,/woocommerce\/product-(?:button|collection|price)/i);
 assert.doesNotMatch(html,/Add to cart|View store listing|Price, availability & checkout|Shop the release/i);
 assert.match(page,/Seed sales are temporarily on hold/);
 assert.doesNotMatch(page, /href=["']\/(?:product|cart|checkout)\//i);
 assert.doesNotMatch(page, /commerce stays live|three active routes|the store handles the transaction|sales on hold — sales on hold/i);
 assert.match(page, /purchasing and checkout are unavailable/i);
});

test('legacy publisher cannot restore sale links while sales are suspended',()=>{
 assert.match(legacy,/if \(apply\) \{[\s\S]*shopSource\.includes\('Seed sales are temporarily on hold'\)/);
 assert.match(legacy,/refusing to republish transactional Shop V5/);
 assert.match(legacy,/throw new Error\('Seed sales hold active/);
});
