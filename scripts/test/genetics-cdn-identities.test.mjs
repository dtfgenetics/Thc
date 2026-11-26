import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCdnIdentities} from '../validate-genetics-cdn-identities.mjs';
const card={wordpressSlug:'card-a',cdnByteLength:100,cdnSha256:'a'.repeat(64),mimeType:'image/jpeg',width:1024,height:1536};
test('approved CDN identity passes without drift',()=>assert.deepEqual(compareCdnIdentities({rows:[card]},{cards:[card]}),[]));
test('changed bytes and hash remain release-blocking',()=>{
  const changed={...card,cdnByteLength:101,cdnSha256:'b'.repeat(64)};
  const result=compareCdnIdentities({rows:[changed]},{cards:[card]});
  assert.equal(result.length,1);
  assert.deepEqual(result[0].changed,['cdnByteLength','cdnSha256']);
});
test('missing and duplicate CDN cards are reported',()=>{
  assert.equal(compareCdnIdentities({rows:[]},{cards:[card]}).length,1);
  assert.equal(compareCdnIdentities({rows:[card,card]},{cards:[card]}).length,1);
  assert.equal(compareCdnIdentities({rows:[card]},{cards:[]}).length,1);
});
