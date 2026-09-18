import fs from 'node:fs';

const site=(process.env.SITE||'https://dtfseeds.com').replace(/\/$/,'');
const base=`${site}/games/who-took-it/`;
const revisionFile=fs.readFileSync('site/public-route-patch/games/who-took-it/source-revision.txt','utf8');
const expectedRevision=revisionFile.match(/^commit=([0-9a-f]{40})$/m)?.[1];
if(!expectedRevision) throw new Error('Who Took It pinned revision is missing.');

async function get(path,label){
  const response=await fetch(new URL(path,base),{
    redirect:'follow',
    cache:'no-store',
    signal:AbortSignal.timeout(15000),
    headers:{'user-agent':'DTFSeeds-Who-Took-It-live-verifier/1.0','cache-control':'no-cache, no-store, max-age=0',pragma:'no-cache'}
  });
  if(!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return {text:await response.text(),type:response.headers.get('content-type')||'',url:response.url};
}

const page=await get('./','Who Took It route');
if(!/text\/html/i.test(page.type)) throw new Error('Who Took It route did not return HTML.');
for(const marker of ['Who Took It?','25 suspect','five missing items']) {
  if(!page.text.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Who Took It HTML missing identity marker: ${marker}`);
}
if(page.text.includes('/src/main.jsx')) throw new Error('Who Took It live HTML is serving the development Vite entry.');

const scriptSrc=page.text.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/i)?.[1]
  || page.text.match(/<script[^>]+src=["']([^"']+\.js)["'][^>]+type=["']module["']/i)?.[1];
const cssHref=page.text.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["']/i)?.[1]
  || page.text.match(/<link[^>]+href=["']([^"']+\.css)["'][^>]+rel=["']stylesheet["']/i)?.[1];
if(!scriptSrc || !cssHref) throw new Error('Who Took It built JS/CSS assets were not discoverable from live HTML.');
if(!scriptSrc.includes('/games/who-took-it/assets/') || !cssHref.includes('/games/who-took-it/assets/')) {
  throw new Error('Who Took It built assets are not rooted under the canonical game path.');
}

const [bundle,styles,revision]=await Promise.all([
  get(scriptSrc,'Who Took It JS bundle'),
  get(cssHref,'Who Took It CSS bundle'),
  get('./source-revision.txt','Who Took It source revision')
]);

for(const marker of ['Build accusation','LOCK ACCUSATION','Open another case','Yes, I am 21+']) {
  if(!bundle.text.includes(marker)) throw new Error(`Who Took It production bundle missing gameplay marker: ${marker}`);
}
const compactCss=styles.text.replace(/\s+/g,'');
for(const marker of ['min-height:44px','touch-action:manipulation','@media(prefers-reduced-motion:reduce)','@media(forced-colors:active)']) {
  if(!compactCss.includes(marker)) throw new Error(`Who Took It production CSS missing accessibility marker: ${marker}`);
}
if(!revision.text.includes(`commit=${expectedRevision}`)) throw new Error(`Who Took It live source revision does not match ${expectedRevision}`);
if(!revision.text.includes('repository=dtfgenetics/Thc-guess-who')) throw new Error('Who Took It live source repository marker missing.');

console.log(`Who Took It live verification passed at ${base} (pinned ${expectedRevision}).`);
