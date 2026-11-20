import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPublicPurchaseControl } from './commerce-purchase-controls.mjs';

test('detects WooCommerce direct add-to-cart anchors and button classes', () => {
  for (const html of [
    '<a href="/shop/?add-to-cart=123">Buy</a>',
    '<a href="/?foo=1&amp;add-to-cart=10">Purchase</a>',
    '<a class="button add_to_cart_button" href="/product/blue-mango/">Add to cart</a>',
    '<button class="single_add_to_cart_button">Add to cart</button>',
    '<form class="variations_form cart" action="/product/x/">Order</form>',
    '<input type="submit" name="add-to-cart" value="Buy">',
    '<a aria-disabled="false" href="?add-to-cart=123">Still active</a>',
    '<a aria-disabled="true" href="?add-to-cart=123">Still navigable despite ARIA</a>',
  ]) assert.equal(hasPublicPurchaseControl(html), true, html);
});

test('does not mistake descriptions or nonrendered examples for active controls', () => {
  for (const html of [
    '<p>Purchasing is unavailable; add-to-cart links are disabled.</p>',
    '<!-- <a href="?add-to-cart=123">Hidden</a> -->',
    '<script>const sample = \'<a href="?add-to-cart=123">\';</script>',
    '<template><a href="?add-to-cart=123">Example</a></template>',
    '<a href="/seeds/">View genetics</a>',
    '<a aria-disabled="true" href="/seeds/">View genetics only</a>',
    '<button disabled name="add-to-cart">Unavailable</button>',
  ]) assert.equal(hasPublicPurchaseControl(html), false, html);
});
