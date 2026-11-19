import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reconcile=readFileSync('scripts/reconcile-wordpress-presentation-rest.mjs','utf8');
const repair=readFileSync('scripts/repair-wordpress-presentation-rest.mjs','utf8');

test('WordPress presentation reconciliation treats Shop/Cart/Checkout links as drift',()=>{
  const header = reconcile.split('function headerCompliant(text) {')[1]?.split('function footerCompliant')[0] || '';
  const footer = reconcile.split('function footerCompliant(text) {')[1]?.split('async function request')[0] || '';
  for (const url of ['/shop/','/cart/','/checkout/']) {
    assert.ok(header.includes(`'href="${url}"'`), `header must reject ${url}`);
    assert.ok(footer.includes(`'href="${url}"'`), `footer must reject ${url}`);
  }
});

test('canonical footer and presentation fallback do not republish Shop navigation',()=>{
  const footer = reconcile.split('const canonicalFooter = ')[1]?.split('const canonicalPageTemplate')[0] || '';
  assert.ok(footer.includes('href="/seeds/"'));
  assert.ok(footer.includes('href="/learn/"'));
  assert.ok(footer.includes('href="/games/"'));
  assert.ok(!footer.includes('href="/shop/"'));
  assert.ok(!footer.includes('href="/cart/"'));
  assert.ok(!footer.includes('href="/checkout/"'));
  const nav = repair.split('href="/seeds/"')[1]?.split('<!-- /wp:paragraph -->')[0] || '';
  assert.ok(nav.includes('href="/learn/"'));
  assert.ok(!nav.includes('href="/shop/"'));
});
