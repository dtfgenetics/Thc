import test from 'node:test';
import assert from 'node:assert/strict';
import { isOnSiteFinalDocument } from '../lib/route-health-origin.mjs';
const origin='https://dtfseeds.com';
test('allows normal same-site route and canonical internal redirects',()=>{
  assert.equal(isOnSiteFinalDocument(origin+'/tools/',origin+'/tools/',origin),true);
  assert.equal(isOnSiteFinalDocument(origin+'/tools',origin+'/tools/',origin),true);
});
test('rejects external and insecure destinations even when they return HTTP 200',()=>{
  for (const final of [
    'https://example.org/landing','https://dtfseeds.com.evil.example/',
    'http://dtfseeds.com/tools/','https://www.dtfseeds.com/tools/',
    'https://user:pass@dtfseeds.com/tools/','not-a-url'
  ]) assert.equal(isOnSiteFinalDocument(origin+'/tools/',final,origin),false,final);
});
test('rejects malformed or foreign requested route',()=>{
  assert.equal(isOnSiteFinalDocument('https://outside.example/',origin+'/tools/',origin),false);
  assert.equal(isOnSiteFinalDocument('not-a-url',origin+'/tools/',origin),false);
});
