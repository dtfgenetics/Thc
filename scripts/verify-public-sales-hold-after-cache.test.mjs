import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectHtml, purchasingLinks, verifyPage } from './verify-public-sales-hold-after-cache.mjs';

const home = { path: '/', marker: 'Genetics first. Learn the plant behind the pack.', hold: true };
const tools = { path: '/tools/', marker: 'Grow with records. Diagnose with evidence.' };
const goodHome = '<h1>Genetics first. Learn the plant behind the pack.</h1><p>Seed sales temporarily on hold</p><a href="/seeds/">Genetics</a>';

test('accepts an informational homepage with a clear hold notice', () => {
  assert.deepEqual(inspectHtml(goodHome, home), []);
});

test('rejects stale homepage copy even without a Shop link', () => {
  assert.match(inspectHtml('<h1>Genetics first. Learn the plant behind the pack.</h1>', home).join(','), /notice missing/);
});

test('rejects relative and absolute purchase controls and ignores external destinations', () => {
  const html = '<a href="/shop/">Shop</a><a href="https://dtfseeds.com/product/test/">Buy</a>'
    + '<a href="/cart/?add-to-cart=4">Cart</a><a href="https://external.example/shop/">External</a>';
  assert.deepEqual(purchasingLinks(html), ['/shop/', '/product/test/', '/cart/']);
  assert.match(inspectHtml(html + tools.marker, tools).join(','), /purchasing navigation/);
});

test('checks both plain and cache-busted requests separately', async () => {
  const received = [];
  const fetcher = async (url) => {
    received.push(url.toString());
    return { status: 200, url: url.toString(), text: async () => goodHome };
  };
  const plain = await verifyPage('https://dtfseeds.com', home, 'plain', '123', fetcher);
  const bypass = await verifyPage('https://dtfseeds.com', home, 'bypass-query', '123', fetcher);
  assert.deepEqual(plain.failures, []);
  assert.deepEqual(bypass.failures, []);
  assert.equal(received[0], 'https://dtfseeds.com/');
  assert.equal(received[1], 'https://dtfseeds.com/?dtf_sales_hold_verify=123');
});

test('fails closed on 403 and cross-domain redirects', async () => {
  const forbidden = await verifyPage('https://dtfseeds.com', tools, 'plain', 'x', async (url) => ({
    status: 403, url: url.toString(), text: async () => 'Forbidden'
  }));
  assert.deepEqual(forbidden.failures, ['HTTP 403']);
  const redirected = await verifyPage('https://dtfseeds.com', tools, 'plain', 'x', async () => ({
    status: 200, url: 'https://other.example/', text: async () => tools.marker
  }));
  assert.deepEqual(redirected.failures, ['unexpected cross-domain redirect']);
});

test('rejects encyclopedia assessments on reference-only chapters', () => {
  const reference = { path: '/learn/encyclopedia/thc-enc-001/', marker: 'How to Read Cannabis Plant Science Critically', referenceOnly: true };
  assert.deepEqual(inspectHtml('<h1>How to Read Cannabis Plant Science Critically</h1><h2>Worked example</h2>', reference), []);
  for (const bad of ['<h2 id="reasoning">Check your reasoning</h2>', '<h2>Check your reasoning</h2>', '<summary>Answer rationale 1:</summary>']) {
    assert.match(inspectHtml('<h1>How to Read Cannabis Plant Science Critically</h1>' + bad, reference).join(';'), /assessment content/);
  }
});

test('rejects Shop navigation on courses and games as well as tools', () => {
  for (const path of ['/courses/', '/games/']) {
    const route = { path, marker: 'Reference hub' };
    assert.match(inspectHtml('<h1>Reference hub</h1><a href="/shop/">Shop</a>', route).join(';'), /purchasing navigation/);
  }
});
