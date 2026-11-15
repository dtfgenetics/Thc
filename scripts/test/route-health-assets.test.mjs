import test from 'node:test';
import assert from 'node:assert/strict';
import {firstPartyAssets} from '../lib/route-health-assets.mjs';
const base='https://dtfseeds.com';
const route=base+'/learn/';
test('detects fallback and responsive image assets without external URLs',()=>{
  const html='<picture><source srcset="/img/small.webp 1x, /img/large.webp 2x"><img src="/img/fallback.jpg" srcset="/img/mobile.jpg 400w, /img/desktop.jpg 900w"></picture><script src="/app.js"></script>';
  assert.deepEqual(new Set(firstPartyAssets(html,route,base)),new Set([
    base+'/img/small.webp',base+'/img/large.webp',base+'/img/fallback.jpg',
    base+'/img/mobile.jpg',base+'/img/desktop.jpg',base+'/app.js'
  ]));
});
test('supports image preloads, lazy candidates, query strings and safe filtering',()=>{
  const html='<link rel="preload" as="image" href="/a.jpg" imagesrcset="/b.jpg?rev=1 1x, /c.jpg 2x"><img data-src="/lazy.jpg" data-srcset="/lazy2.jpg 2x" srcset="data:image/png;base64,abc 1x, https://outside.example/x.jpg 2x">';
  const assets=firstPartyAssets(html,route,base);
  for(const pathname of ['/a.jpg','/b.jpg?rev=1','/c.jpg','/lazy.jpg','/lazy2.jpg']) assert.ok(assets.includes(base+pathname),pathname);
  assert.ok(assets.every(url=>url.startsWith(base+'/')));
  assert.ok(assets.every(url=>!url.includes('base64')));
});
test('attribute matching distinguishes src and srcset and rejects foreign assets',()=>{
  const html='<img srcset="/only-responsive.webp 1x, /retina.webp 2x"><source src="https://outside.example/elsewhere.webp"><link rel="canonical" href="/not-an-asset/">';
  assert.deepEqual(new Set(firstPartyAssets(html,route,base)),new Set([base+'/only-responsive.webp',base+'/retina.webp']));
});

test('comments and non-rendered blocks do not invent network assets',()=>{
  const html=[
    '<!-- <img src="/missing-comment.png"> -->',
    '<script>const example = \'<img src="/missing-script.png">\';</script>',
    '<style>/* <img src="/missing-style.png"> */</style>',
    '<template><img src="/missing-template.png"></template>',
    '<img src="/real.webp">',
    '<script src="/real-runtime.js">const example = \'<img src="/missing-external-script.png">\';</script>'
  ].join('');
  assert.deepEqual(new Set(firstPartyAssets(html,route,base)),
    new Set([base+'/real.webp',base+'/real-runtime.js']));
});
